import { BadRequestException, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { Module, TransactionTypeMapping } from '@prisma/client';
import { HelperGlobal } from '@src/common/utils/helper/helper';
import { DecodeTokenType } from '@src/modules/auth/authentikasi/authentikasi.controller';
import { PrismaService } from '@src/modules/common/prisma.service';
import { ShareModuleService } from '@src/modules/share-module/share-module.service';
import { CreateRawMaterialIssueDto } from './dto/create-raw-material-issue.dto';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { GetMaterialDto } from './dto/get-raw-material.dto';
import { UpdateRawMaterialDto, UpdateRawMaterialIssueDto } from './dto/update-raw-material.dto';

@Injectable({ scope: Scope.REQUEST })
export class RawMaterialService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly helperGlobal: HelperGlobal,
		private readonly shareModuleService: ShareModuleService,
	) {}

	async createJournal(plus = 1) {
		const code = await this.shareModuleService.getNextCode('JournalEntry', 'numberJurnal', 'JRN', plus);
		return code;
	}

	create(createRawMaterialDto: CreateRawMaterialDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(async (tx) => {
			if (!createRawMaterialDto.items || createRawMaterialDto.items.length === 0) {
				throw new BadRequestException('Item penerimaan bahan mentah wajib diisi');
			}

			for (const item of createRawMaterialDto.items) {
				if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
					throw new BadRequestException('Quantity harus lebih besar dari nol');
				}

				if (!Number.isFinite(Number(item.nilaiSatuan)) || Number(item.nilaiSatuan) < 0) {
					throw new BadRequestException('Nilai satuan tidak valid');
				}
			}

			// ADD hanya menyimpan draft.
			// Tidak membuat transaksi stok, jurnal, GL, atau Barang Jadi.
			return tx.rawMaterialReceipt.create({
				data: {
					documentCode: createRawMaterialDto.documentCode,
					documentNo: createRawMaterialDto.documentNo,
					supplierId: createRawMaterialDto.idSupplier,
					date: createRawMaterialDto.date,
					faktur: createRawMaterialDto.faktur,
					noRekening: createRawMaterialDto.noRekening,
					pengadaanBarang: createRawMaterialDto.pengadaanBarang,
					unitId: decoded.unitId,
					status: 'DRAFT',
					simpanKeBarangJadi: createRawMaterialDto.simpanKeBarangJadi === true,
					items: {
						create: createRawMaterialDto.items.map((item) => ({
							masterRawMaterialId: item.masterRawMaterialId,
							nilaiSatuan: Number(item.nilaiSatuan),
							quantity: Number(item.quantity),
							satuan: item.Satuan,
							Total: Number(item.quantity) * Number(item.nilaiSatuan),
							stok: 0,
						})),
					},
				},
				include: {
					items: true,
				},
			});
		});
	}

	async createIssue(createRawMaterialDto: CreateRawMaterialIssueDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Validasi item pengeluaran
				if (!createRawMaterialDto.items || createRawMaterialDto.items.length === 0) {
					throw new BadRequestException('Item pengeluaran barang mentah wajib diisi');
				}

				for (const item of createRawMaterialDto.items) {
					if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
						throw new BadRequestException('Quantity harus lebih besar dari nol');
					}

					if (!Number.isFinite(Number(item.nilaiSatuan)) || Number(item.nilaiSatuan) < 0) {
						throw new BadRequestException('Nilai satuan tidak valid');
					}
				}

				// 2. Cari mapping jurnal pengeluaran
				const mappings = await tx.accountMapping.findFirst({
					where: {
						module: Module.ISSUE,
						transactionType: TransactionTypeMapping.MATERIAL_ISSUE,
						deletedAt: null,
					},
				});

				if (!mappings) {
					throw new NotFoundException('Mapping jurnal pengeluaran tidak ditemukan');
				}

				// 3. Simpan header dan item pengeluaran.
				// Tidak mengurangi stok pada tahap Add.
				const issue = await tx.rawMaterialIssue.create({
					data: {
						documentCode: createRawMaterialDto.documentCode,
						documentNo: createRawMaterialDto.documentNo,
						date: createRawMaterialDto.date,
						keterangan: createRawMaterialDto.keterangan,
						noBppTerakhir: '-',
						diPergunakan: createRawMaterialDto.diPergunakan,
						items: {
							create: createRawMaterialDto.items.map((item) => ({
								masterRawMaterialId: item.masterRawMaterialId,
								nilaiSatuan: Number(item.nilaiSatuan),
								quantity: Number(item.quantity),
								Total: Number(item.quantity) * Number(item.nilaiSatuan),
								satuan: item.Satuan,
							})),
						},
					},
					include: {
						items: true,
					},
				});

				// 4. Siapkan detail jurnal.
				// Detail jurnal disimpan sebagai draft dan belum diposting.
				const journalDetails = createRawMaterialDto.items
					.map((item) => {
						const total = Number(item.quantity) * Number(item.nilaiSatuan);

						return [
							{
								accountCode: mappings.accountCode,
								debit: total,
								credit: 0,
								unitId: decoded.unitId,
								description: 'sesuaikan account',
							},
							{
								accountCode: item.accountCode,
								debit: 0,
								credit: total,
								unitId: decoded.unitId,
								description: item.accountName,
							},
						];
					})
					.flat();

				// 5. Buat nomor jurnal
				const numberJurnal = await this.createJournal();

				// 6. Simpan jurnal dalam status DRAFT.
				// isPosted, status, dan isRevert menggunakan default
				// dari schema Prisma: false, DRAFT, dan N.
				await tx.journalEntry.create({
					data: {
						staffId: decoded.id,
						module: 'PURCHASE',
						createdBy: 'System',
						description: 'Proses Produksi',
						referenceNumber: createRawMaterialDto.documentCode,
						numberJurnal,
						rawMaterialIssueId: issue.id,
						date: createRawMaterialDto.date,
						unitId: decoded.unitId,
						details: {
							create: journalDetails,
						},
					},
				});

				// 7. Kembalikan data pengeluaran yang baru disimpan.
				// Tidak membuat InventoryTransaction OUT.
				// Tidak mengubah StockSummary.
				// Tidak menambah saldo GeneralLedger.
				return issue;
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async findAll(query: GetMaterialDto, decoded: DecodeTokenType) {
		const { page = 1, limit = 10, sortBy, sortOrder, documentNumber, documentNo, supplier, isLunas, date } = query;

		const orderBy = this.helperGlobal.buildOrderBy(sortBy, sortOrder);

		const skip = (page - 1) * limit;
		const take = +limit;

		const whereCondition: any = {
			deletedAt: null,
		};

		if (!(decoded.isRoot === 'Y' || decoded.isPusat)) {
			whereCondition.unitId = decoded.unitId;
		}

		if (isLunas) {
			whereCondition.isLunas = isLunas;
		}
		if (date) {
			const startDate = new Date(date);
			const endDate = new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000 - 1);
			whereCondition.date = {
				gte: startDate,
				lte: endDate,
			};
		}

		if (documentNumber) {
			whereCondition.documentCode = {
				contains: documentNumber,
				mode: 'insensitive',
			};
		}

		if (documentNo) {
			whereCondition.documentNo = {
				contains: documentNo,
				mode: 'insensitive',
			};
		}

		if (supplier) {
			whereCondition.supplier = {
				namaRekanan: {
					contains: supplier,
					mode: 'insensitive',
				},
			};
		}

		const [data, totalData] = await this.prisma.$transaction([
			this.prisma.rawMaterialReceipt.findMany({
				skip,
				take,
				include: {
					supplier: {
						include: {
							account: true,
						},
					},
					items: true,
				},
				where: whereCondition,
				orderBy: orderBy ?? { createdAt: 'desc' },
			}),
			this.prisma.rawMaterialReceipt.count({ where: whereCondition }),
		]);

		return {
			data,
			totalData,
			page: +page,
			limit: +limit,
			totalPages: Math.ceil(totalData / +limit),
		};
	}

	async findAllIssue(query: GetMaterialDto) {
		const { page = 1, limit = 10, sortBy, sortOrder, date, documentNumber, documentNo, supplier, documentCode } = query;

		const orderBy = this.helperGlobal.buildOrderBy(sortBy, sortOrder);

		const skip = (page - 1) * limit;
		const take = +limit;

		const whereCondition: any = {
			deletedAt: null,
		};

		if (documentCode) {
			whereCondition.documentCode = {
				contains: documentCode,
				mode: 'insensitive',
			};
		}
		if (documentNumber) {
			whereCondition.documentNo = {
				contains: documentNumber,
				mode: 'insensitive',
			};
		}

		if (date) {
			const startDate = new Date(date);
			const endDate = new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000 - 1);
			whereCondition.date = {
				gte: startDate,
				lte: endDate,
			};
		}

		if (supplier) {
			whereCondition.supplier = {
				contains: supplier,
				mode: 'insensitive',
			};
		}

		const [data, totalData] = await this.prisma.$transaction([
			this.prisma.rawMaterialIssue.findMany({
				skip,
				take,
				where: whereCondition,
				orderBy: orderBy ?? { createdAt: 'desc' },
				include: {
					items: true,
					journalEntry: {
						where: {
							deletedAt: null,
						},
						select: {
							id: true,
							numberJurnal: true,
							isPosted: true,
							status: true,
							isRevert: true,
							isRevertOpen: true,
							date: true,
						},
					},
				},
			}),
			this.prisma.rawMaterialIssue.count({ where: whereCondition }),
		]);

		return {
			data,
			totalData,
			page: +page,
			limit: +limit,
			totalPages: Math.ceil(totalData / +limit),
		};
	}

	findOne(id: string) {
		return this.prisma.rawMaterialReceipt.findUnique({
			include: {
				items: {
					include: {
						masterRawMaterial: {
							include: {
								stockSummaryBarangMentah: true,
								unit: true,
							},
						},
					},
				},
			},
			where: {
				id,
			},
		});
	}

	findOneIssue(id: string) {
		return this.prisma.rawMaterialIssue.findUnique({
			include: {
				items: {
					where: {
						deletedAt: null,
					},
					include: {
						masterRawMaterial: {
							include: {
								unit: true,
								account: true,
							},
						},
					},
				},
				journalEntry: {
					where: {
						deletedAt: null,
					},
					select: {
						id: true,
						numberJurnal: true,
						isPosted: true,
						status: true,
						isRevert: true,
						isRevertOpen: true,
						date: true,
					},
				},
			},
			where: {
				id,
				deletedAt: null,
			},
		});
	}

	findOneStockSummary(id: string) {
		return this.prisma.stockSummaryBarangMentah.findUnique({
			where: {
				productId: id,
			},
		});
	}

	async findOneRawProduct(productId: string) {
		const transactions = await this.prisma.inventoryTransactionBarangMentah.findMany({
			where: {
				productId,
			},
		});

		const result = [];
		let currentStock = 0;
		for (const tx of transactions) {
			const stokAwal = currentStock;
			const qty = tx.quantity;
			const type = tx.transactionType;

			if (type === 'IN') {
				currentStock += qty;
			} else if (type === 'OUT') {
				currentStock -= qty;
			}

			result.push({
				...tx,
				stokAwal,
				stokAkhir: currentStock,
			});
		}
		return result;
	}

	async postIssue(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// =====================================================
				// 1. Ambil data pengeluaran dan jurnal aktif.
				// =====================================================
				const issue = await tx.rawMaterialIssue.findFirst({
					where: {
						id,
						deletedAt: null,
					},
					include: {
						items: {
							where: {
								deletedAt: null,
							},
						},
						journalEntry: {
							where: {
								deletedAt: null,
							},
						},
					},
				});

				if (!issue) {
					throw new NotFoundException('Pengeluaran barang mentah tidak ditemukan');
				}

				const journal = issue.journalEntry[0];

				if (!journal) {
					throw new NotFoundException('Jurnal pengeluaran tidak ditemukan');
				}

				// =====================================================
				// 2. Validasi akses unit.
				// =====================================================
				if (!(decoded.isRoot === 'Y' || decoded.isPusat) && journal.unitId !== decoded.unitId) {
					throw new BadRequestException('Tidak memiliki akses ke unit transaksi ini');
				}

				// =====================================================
				// 3. Validasi status transaksi.
				// =====================================================
				if (journal.isPosted) {
					throw new BadRequestException('Jurnal sudah diposting');
				}

				// Kondisi 1: Transaksi baru.
				const isDraft = journal.isRevert === 'N' && journal.status === 'DRAFT';

				// Kondisi 2: Transaksi sudah direvert.
				const isReverted = journal.isRevert === 'Y' && journal.status === 'CANCELLED';

				// Hanya DRAFT dan REVERTED yang boleh diposting.
				if (!isDraft && !isReverted) {
					throw new BadRequestException(`Jurnal tidak dapat diposting. Status saat ini: ${journal.status}`);
				}

				if (!issue.items || issue.items.length === 0) {
					throw new BadRequestException('Item pengeluaran barang mentah wajib diisi');
				}

				// =====================================================
				// 4. Klaim jurnal untuk mencegah POST ganda.
				// =====================================================
				// DRAFT dan REVERTED sama-sama boleh melakukan POST.
				// Update dilakukan secara kondisional agar dua request
				// POST bersamaan tidak memproses jurnal yang sama.
				const claim = await tx.journalEntry.updateMany({
					where: {
						id: journal.id,
						deletedAt: null,
						isPosted: false,
						OR: [
							{
								isRevert: 'N',
								status: 'DRAFT',
							},
							{
								isRevert: 'Y',
								status: 'CANCELLED',
							},
						],
					},
					data: {
						isPosted: true,
					},
				});

				if (claim.count !== 1) {
					throw new BadRequestException('Jurnal sedang diproses atau sudah diposting');
				}

				// Ambil ulang jurnal beserta detail yang masih aktif.
				const activeJournal = await tx.journalEntry.findFirst({
					where: {
						id: journal.id,
						deletedAt: null,
						isPosted: true,
					},
					include: {
						details: {
							where: {
								deletedAt: null,
							},
						},
					},
				});

				if (!activeJournal) {
					throw new NotFoundException('Data jurnal tidak ditemukan');
				}

				// =====================================================
				// 5. Validasi periode akuntansi.
				// =====================================================
				const period = new Date(activeJournal.date).toISOString().slice(0, 7);

				const accountingPeriod = await tx.accountingPeriod.findUnique({
					where: {
						period,
					},
				});

				if (accountingPeriod?.isLocked) {
					throw new BadRequestException('Periode akuntansi terkunci');
				}

				// =====================================================
				// 6. Validasi dan agregasi item pengeluaran.
				// =====================================================
				const aggregatedItems = new Map<
					string,
					{
						quantity: number;
						satuan: string;
					}
				>();

				for (const item of issue.items) {
					const quantity = Number(item.quantity);

					if (!Number.isFinite(quantity) || quantity <= 0) {
						throw new BadRequestException('Quantity harus lebih besar dari nol');
					}

					const productId = item.masterRawMaterialId;

					const current = aggregatedItems.get(productId);

					if (current) {
						current.quantity += quantity;
					} else {
						aggregatedItems.set(productId, {
							quantity,
							satuan: item.satuan,
						});
					}
				}

				// =====================================================
				// 7. Validasi keseimbangan jurnal.
				// =====================================================
				if (!activeJournal.details || activeJournal.details.length === 0) {
					throw new BadRequestException('Detail jurnal tidak ditemukan');
				}

				let totalDebit = 0;
				let totalCredit = 0;

				for (const detail of activeJournal.details) {
					const debit = Number(detail.debit);
					const credit = Number(detail.credit);

					if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
						throw new BadRequestException('Nilai debit atau kredit jurnal tidak valid');
					}

					if (!detail.accountCode) {
						throw new BadRequestException('Kode akun jurnal tidak ditemukan');
					}

					totalDebit += debit;
					totalCredit += credit;
				}

				if (totalDebit <= 0 || totalCredit <= 0 || Math.abs(totalDebit - totalCredit) > 0.000001) {
					throw new BadRequestException(`Jurnal tidak seimbang. Debit: ${totalDebit}, Kredit: ${totalCredit}`);
				}

				// =====================================================
				// 8. Ambil riwayat inventory dokumen ini.
				// =====================================================
				const inventoryHistory = await tx.inventoryTransactionBarangMentah.findMany({
					where: {
						sourceId: issue.id,
						deletedAt: null,
						source: {
							in: ['bahan produksi', 'revert pengeluaran bahan produksi'],
						},
					},
					select: {
						productId: true,
						quantity: true,
						transactionType: true,
						source: true,
					},
				});

				const stockHistory = new Map<
					string,
					{
						out: number;
						reverted: number;
					}
				>();

				for (const history of inventoryHistory) {
					const current = stockHistory.get(history.productId) ?? {
						out: 0,
						reverted: 0,
					};

					if (history.source === 'bahan produksi' && history.transactionType === 'OUT') {
						current.out += Number(history.quantity);
					}

					if (history.source === 'revert pengeluaran bahan produksi' && history.transactionType === 'IN') {
						current.reverted += Number(history.quantity);
					}

					stockHistory.set(history.productId, current);
				}

				// =====================================================
				// 9. Proses pengurangan stok.
				// =====================================================
				for (const [productId, item] of aggregatedItems) {
					const history = stockHistory.get(productId) ?? {
						out: 0,
						reverted: 0,
					};

					// Hitung OUT yang belum dikembalikan.
					const outstandingOut = history.out - history.reverted;

					if (outstandingOut < -0.000001) {
						throw new BadRequestException(`Riwayat stok tidak valid untuk bahan: ${productId}`);
					}

					// Kompatibilitas data lama:
					// Jika OUT sebelumnya masih berlaku dan quantity-nya
					// sama dengan detail transaksi, jangan kurangi stok lagi.
					if (outstandingOut > 0.000001) {
						if (Math.abs(outstandingOut - item.quantity) > 0.000001) {
							throw new BadRequestException(`Jumlah OUT tidak sesuai dengan detail pengeluaran untuk bahan: ${productId}`);
						}

						continue;
					}

					// Ambil ringkasan stok.
					const summary = await tx.stockSummaryBarangMentah.findUnique({
						where: {
							productId,
						},
					});

					if (!summary) {
						throw new NotFoundException(`Ringkasan stok tidak ditemukan untuk bahan: ${productId}`);
					}

					const currentStock = Number(summary.stock);

					if (!Number.isFinite(currentStock) || currentStock < item.quantity) {
						throw new BadRequestException(`Stok tidak cukup untuk bahan baku: ${productId}`);
					}

					const stockAfter = currentStock - item.quantity;

					// Catat transaksi inventory OUT.
					await tx.inventoryTransactionBarangMentah.create({
						data: {
							productId,
							unitId: activeJournal.unitId,
							transactionType: 'OUT',
							quantity: item.quantity,
							satuan: item.satuan,
							nilaiSatuan: Number(summary.averageCost),
							source: 'bahan produksi',
							sourceId: issue.id,
							stockAfter,
							averageCostAfter: summary.averageCost,
							transactionDate: activeJournal.date,
						},
					});

					// Perbarui ringkasan stok.
					await tx.stockSummaryBarangMentah.update({
						where: {
							productId,
						},
						data: {
							stock: stockAfter,
							transactionDate: activeJournal.date,
						},
					});
				}

				// =====================================================
				// 10. Posting jurnal ke General Ledger.
				// =====================================================
				for (const detail of activeJournal.details) {
					const debit = Number(detail.debit);
					const credit = Number(detail.credit);

					await tx.generalLedger.upsert({
						where: {
							unit_accountCode_periode: {
								unitId: activeJournal.unitId,
								accountCode: detail.accountCode,
								period,
							},
						},
						update: {
							debitTotal: {
								increment: debit,
							},
							creditTotal: {
								increment: credit,
							},
						},
						create: {
							unitId: activeJournal.unitId,
							accountCode: detail.accountCode,
							period,
							debitTotal: debit,
							creditTotal: credit,
							openingDebit: 0,
							openingCredit: 0,
							staffId: decoded.id,
						},
					});
				}

				// =====================================================
				// 11. Tandai jurnal sudah diposting.
				// =====================================================
				return tx.journalEntry.update({
					where: {
						id: activeJournal.id,
					},
					data: {
						isPosted: true,
						isRevert: 'N',
						status: 'CONFIRMED',
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async revertIssue(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// =====================================================
				// 1. Ambil data pengeluaran dan jurnal aktif.
				// =====================================================
				const issue = await tx.rawMaterialIssue.findFirst({
					where: {
						id,
						deletedAt: null,
					},
					include: {
						items: {
							where: {
								deletedAt: null,
							},
						},
						journalEntry: {
							where: {
								deletedAt: null,
							},
							include: {
								details: {
									where: {
										deletedAt: null,
									},
								},
							},
						},
					},
				});

				if (!issue) {
					throw new NotFoundException('Pengeluaran barang mentah tidak ditemukan');
				}

				const journal = issue.journalEntry[0];

				if (!journal) {
					throw new NotFoundException('Jurnal pengeluaran tidak ditemukan');
				}

				// =====================================================
				// 2. Validasi akses unit.
				// =====================================================
				if (!(decoded.isRoot === 'Y' || decoded.isPusat) && journal.unitId !== decoded.unitId) {
					throw new BadRequestException('Tidak memiliki akses ke unit transaksi ini');
				}

				// =====================================================
				// 3. Validasi status jurnal.
				// =====================================================
				if (!journal.isPosted || journal.status !== 'CONFIRMED' || journal.isRevert !== 'N') {
					throw new BadRequestException('Pengeluaran harus berstatus POSTED sebelum di-Revert');
				}

				if (!issue.items || issue.items.length === 0) {
					throw new BadRequestException('Detail pengeluaran tidak ditemukan');
				}

				// =====================================================
				// 4. Validasi periode akuntansi.
				// =====================================================
				const period = new Date(journal.date).toISOString().slice(0, 7);

				const accountingPeriod = await tx.accountingPeriod.findUnique({
					where: {
						period,
					},
				});

				if (accountingPeriod?.isLocked) {
					throw new BadRequestException('Periode akuntansi terkunci');
				}

				// =====================================================
				// 5. Klaim jurnal agar tidak terjadi REVERT ganda.
				// =====================================================
				// Perubahan ini berada di dalam transaksi.
				// Jika proses berikutnya gagal, semuanya rollback.
				const claim = await tx.journalEntry.updateMany({
					where: {
						id: journal.id,
						deletedAt: null,
						isPosted: true,
						isRevert: 'N',
						status: 'CONFIRMED',
					},
					data: {
						isPosted: false,
						isRevert: 'Y',
						status: 'CANCELLED',
					},
				});

				if (claim.count !== 1) {
					throw new BadRequestException('Jurnal sedang diproses atau sudah direvert');
				}

				// =====================================================
				// 6. Validasi dan agregasi item pengeluaran.
				// =====================================================
				const aggregatedItems = new Map<
					string,
					{
						quantity: number;
						satuan: string;
					}
				>();

				for (const item of issue.items) {
					const quantity = Number(item.quantity);

					if (!Number.isFinite(quantity) || quantity <= 0) {
						throw new BadRequestException('Quantity pengeluaran tidak valid');
					}

					const productId = item.masterRawMaterialId;

					const current = aggregatedItems.get(productId);

					if (current) {
						current.quantity += quantity;
					} else {
						aggregatedItems.set(productId, {
							quantity,
							satuan: item.satuan,
						});
					}
				}

				// =====================================================
				// 7. Validasi keseimbangan detail jurnal aktif.
				// =====================================================
				if (!journal.details || journal.details.length === 0) {
					throw new BadRequestException('Detail jurnal tidak ditemukan');
				}

				let totalDebit = 0;
				let totalCredit = 0;

				for (const detail of journal.details) {
					const debit = Number(detail.debit);
					const credit = Number(detail.credit);

					if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
						throw new BadRequestException('Nilai debit atau kredit jurnal tidak valid');
					}

					if (!detail.accountCode) {
						throw new BadRequestException('Kode akun jurnal tidak ditemukan');
					}

					totalDebit += debit;
					totalCredit += credit;
				}

				if (totalDebit <= 0 || totalCredit <= 0 || Math.abs(totalDebit - totalCredit) > 0.000001) {
					throw new BadRequestException(`Jurnal tidak seimbang. Debit: ${totalDebit}, Kredit: ${totalCredit}`);
				}

				// =====================================================
				// 8. Ambil riwayat OUT dan IN dokumen ini.
				// =====================================================
				const inventoryHistory = await tx.inventoryTransactionBarangMentah.findMany({
					where: {
						sourceId: issue.id,
						deletedAt: null,
						source: {
							in: ['bahan produksi', 'revert pengeluaran bahan produksi'],
						},
					},
					select: {
						id: true,
						productId: true,
						quantity: true,
						transactionType: true,
						source: true,
						revertedAt: true,
					},
				});

				const stockHistory = new Map<
					string,
					{
						out: number;
						reverted: number;
					}
				>();

				for (const history of inventoryHistory) {
					const current = stockHistory.get(history.productId) ?? {
						out: 0,
						reverted: 0,
					};

					if (history.source === 'bahan produksi' && history.transactionType === 'OUT') {
						current.out += Number(history.quantity);
					}

					if (history.source === 'revert pengeluaran bahan produksi' && history.transactionType === 'IN') {
						current.reverted += Number(history.quantity);
					}

					stockHistory.set(history.productId, current);
				}

				// =====================================================
				// 9. Pastikan tidak ada OUT yang tertinggal.
				// =====================================================
				for (const [productId, history] of stockHistory) {
					const outstandingOut = history.out - history.reverted;

					if (outstandingOut > 0.000001 && !aggregatedItems.has(productId)) {
						throw new BadRequestException(`Terdapat transaksi OUT yang belum dikembalikan untuk bahan: ${productId}`);
					}
				}

				// =====================================================
				// 10. Kembalikan stok dan tandai OUT dengan revertedAt.
				// =====================================================
				const revertDate = new Date();

				for (const [productId, item] of aggregatedItems) {
					const history = stockHistory.get(productId);

					if (!history) {
						throw new BadRequestException(`Riwayat transaksi OUT tidak ditemukan untuk bahan: ${productId}`);
					}

					const outstandingOut = history.out - history.reverted;

					if (outstandingOut <= 0.000001) {
						throw new BadRequestException(`Stok bahan ${productId} sudah pernah dikembalikan atau riwayat OUT tidak valid`);
					}

					if (Math.abs(outstandingOut - item.quantity) > 0.000001) {
						throw new BadRequestException(`Jumlah OUT tidak sesuai dengan detail pengeluaran untuk bahan: ${productId}`);
					}

					const summary = await tx.stockSummaryBarangMentah.findUnique({
						where: {
							productId,
						},
					});

					if (!summary) {
						throw new NotFoundException(`Ringkasan stok tidak ditemukan untuk bahan: ${productId}`);
					}

					const currentStock = Number(summary.stock);

					if (!Number.isFinite(currentStock) || currentStock < 0) {
						throw new BadRequestException(`Ringkasan stok tidak valid untuk bahan: ${productId}`);
					}

					const stockAfter = currentStock + outstandingOut;

					// Buat transaksi inventory IN.
					await tx.inventoryTransactionBarangMentah.create({
						data: {
							productId,
							unitId: journal.unitId,
							transactionType: 'IN',
							quantity: outstandingOut,
							satuan: item.satuan,
							nilaiSatuan: Number(summary.averageCost),
							source: 'revert pengeluaran bahan produksi',
							sourceId: issue.id,
							stockAfter,
							averageCostAfter: summary.averageCost,
							transactionDate: revertDate,
						},
					});

					// Perbarui ringkasan stok.
					await tx.stockSummaryBarangMentah.update({
						where: {
							productId,
						},
						data: {
							stock: stockAfter,
							transactionDate: revertDate,
						},
					});

					// Tandai transaksi OUT yang sudah dikembalikan.
					// OUT yang sebelumnya belum memiliki revertedAt
					// akan ditandai setelah seluruh sisa OUT dikembalikan.
					const markedOut = await tx.inventoryTransactionBarangMentah.updateMany({
						where: {
							sourceId: issue.id,
							productId,
							source: 'bahan produksi',
							transactionType: 'OUT',
							deletedAt: null,
							revertedAt: null,
						},
						data: {
							revertedAt: revertDate,
						},
					});

					if (markedOut.count === 0) {
						throw new BadRequestException(`Transaksi OUT tidak berhasil ditandai sebagai REVERT untuk bahan: ${productId}`);
					}
				}

				// =====================================================
				// 11. Balik dampak jurnal pada General Ledger.
				// =====================================================
				for (const detail of journal.details) {
					const debit = Number(detail.debit);
					const credit = Number(detail.credit);

					const result = await tx.generalLedger.updateMany({
						where: {
							unitId: journal.unitId,
							accountCode: detail.accountCode,
							period,
							deletedAt: null,
							debitTotal: {
								gte: debit,
							},
							creditTotal: {
								gte: credit,
							},
						},
						data: {
							debitTotal: {
								decrement: debit,
							},
							creditTotal: {
								decrement: credit,
							},
						},
					});

					if (result.count !== 1) {
						throw new BadRequestException(
							`Saldo buku besar tidak mencukupi atau tidak ditemukan untuk akun ${detail.accountCode}`,
						);
					}
				}

				// =====================================================
				// 12. Pastikan jurnal berstatus REVERTED.
				// =====================================================
				return tx.journalEntry.update({
					where: {
						id: journal.id,
					},
					data: {
						isPosted: false,
						isRevert: 'Y',
						status: 'CANCELLED',
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async updateIssue(id: string, dto: UpdateRawMaterialIssueDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Ambil dokumen, detail aktif, dan jurnal.
				const issue = await tx.rawMaterialIssue.findFirst({
					where: {
						id,
						deletedAt: null,
					},
					include: {
						items: {
							where: { deletedAt: null },
						},
						journalEntry: {
							where: { deletedAt: null },
							include: {
								details: {
									where: { deletedAt: null },
								},
							},
						},
					},
				});

				if (!issue) {
					throw new NotFoundException('Pengeluaran barang mentah tidak ditemukan');
				}

				const journal = issue.journalEntry[0];

				if (!journal) {
					throw new NotFoundException('Jurnal pengeluaran tidak ditemukan');
				}

				// 2. Validasi akses unit.
				if (!(decoded.isRoot === 'Y' || decoded.isPusat) && journal.unitId !== decoded.unitId) {
					throw new BadRequestException('Tidak memiliki akses ke unit transaksi ini');
				}

				// 3. Dokumen POSTED tidak boleh langsung diubah.
				// DRAFT dan REVERTED boleh diperbarui.
				if (journal.isPosted || (journal.status === 'CONFIRMED' && journal.isRevert !== 'Y')) {
					throw new BadRequestException(
						'Pengeluaran sudah diposting. Silakan revert terlebih dahulu sebelum melakukan penyesuaian',
					);
				}

				// 4. Validasi detail.
				if (!dto.items || dto.items.length === 0) {
					throw new BadRequestException('Item pengeluaran barang mentah wajib diisi');
				}

				// Gunakan tanggal lama jika tanggal tidak dikirim.
				const newDate = dto.date ? new Date(dto.date) : new Date(issue.date);

				if (Number.isNaN(newDate.getTime())) {
					throw new BadRequestException('Tanggal pengeluaran tidak valid');
				}

				// 5. Validasi periode akuntansi lama dan baru.
				const oldPeriod = new Date(journal.date).toISOString().slice(0, 7);
				const newPeriod = newDate.toISOString().slice(0, 7);

				const [oldAccountingPeriod, newAccountingPeriod] = await Promise.all([
					tx.accountingPeriod.findUnique({
						where: { period: oldPeriod },
					}),
					tx.accountingPeriod.findUnique({
						where: { period: newPeriod },
					}),
				]);

				if (oldAccountingPeriod?.isLocked) {
					throw new BadRequestException('Periode akuntansi lama terkunci');
				}

				if (newAccountingPeriod?.isLocked) {
					throw new BadRequestException('Periode akuntansi tujuan terkunci');
				}

				// 6. Validasi quantity, nilai satuan, dan ID detail.
				const existingItemsMap = new Map(issue.items.map((item) => [item.id, item]));

				const submittedIds = new Set<string>();

				for (const item of dto.items) {
					if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
						throw new BadRequestException('Quantity harus lebih besar dari nol');
					}

					if (!Number.isFinite(Number(item.nilaiSatuan)) || Number(item.nilaiSatuan) < 0) {
						throw new BadRequestException('Nilai satuan tidak valid');
					}

					if (item.id) {
						// Pastikan ID detail benar-benar milik dokumen ini.
						if (!existingItemsMap.has(item.id)) {
							throw new BadRequestException(`Detail barang dengan ID ${item.id} tidak ditemukan pada dokumen ini`);
						}

						// Cegah ID detail yang sama dikirim berulang kali.
						if (submittedIds.has(item.id)) {
							throw new BadRequestException(`ID detail ${item.id} dikirim lebih dari satu kali`);
						}

						submittedIds.add(item.id);
					}
				}

				// 7. Ambil mapping jurnal pengeluaran.
				const mappings = await tx.accountMapping.findFirst({
					where: {
						module: Module.ISSUE,
						transactionType: TransactionTypeMapping.MATERIAL_ISSUE,
						deletedAt: null,
					},
				});

				if (!mappings) {
					throw new NotFoundException('Mapping jurnal pengeluaran tidak ditemukan');
				}

				const now = new Date();

				// 8. UPDATE detail lama atau CREATE detail baru.
				for (const item of dto.items) {
					const quantity = Number(item.quantity);
					const nilaiSatuan = Number(item.nilaiSatuan);

					const itemData = {
						masterRawMaterialId: item.masterRawMaterialId,
						quantity,
						nilaiSatuan,
						satuan: item.Satuan,
						Total: quantity * nilaiSatuan,
					};

					if (item.id) {
						// Detail lama: pertahankan ID.
						await tx.rawMaterialIssuetItem.update({
							where: {
								id: item.id,
							},
							data: itemData,
						});
					} else {
						// Detail baru: buat ID baru otomatis.
						await tx.rawMaterialIssuetItem.create({
							data: {
								issueId: id,
								...itemData,
							},
						});
					}
				}

				// 9. Soft delete detail lama yang tidak dikirim lagi.
				const removedItemIds = issue.items.filter((item) => !submittedIds.has(item.id)).map((item) => item.id);

				if (removedItemIds.length > 0) {
					await tx.rawMaterialIssuetItem.updateMany({
						where: {
							id: { in: removedItemIds },
							issueId: id,
							deletedAt: null,
						},
						data: {
							deletedAt: now,
						},
					});
				}

				// 10. Susun ulang detail jurnal berdasarkan item terbaru.
				const journalDetails = dto.items.flatMap((item) => {
					const total = Number(item.quantity) * Number(item.nilaiSatuan);

					return [
						{
							journalEntryId: journal.id,
							accountCode: mappings.accountCode,
							debit: total,
							credit: 0,
							unitId: journal.unitId,
							description: 'sesuaikan account',
						},
						{
							journalEntryId: journal.id,
							accountCode: item.accountCode,
							debit: 0,
							credit: total,
							unitId: journal.unitId,
							description: item.accountName,
						},
					];
				});

				// 11. Soft delete detail jurnal lama.
				await tx.journalEntryDetail.updateMany({
					where: {
						journalEntryId: journal.id,
						deletedAt: null,
					},
					data: {
						deletedAt: now,
					},
				});

				// 12. Buat detail jurnal terbaru.
				await tx.journalEntryDetail.createMany({
					data: journalDetails,
				});

				// 13. Update header pengeluaran.
				await tx.rawMaterialIssue.update({
					where: { id },
					data: {
						documentCode: dto.documentCode ?? issue.documentCode,
						documentNo: dto.documentNo ?? issue.documentNo,
						date: newDate,
						keterangan: dto.keterangan ?? issue.keterangan,
						diPergunakan: dto.diPergunakan ?? issue.diPergunakan,
					},
				});

				// 14. Kembalikan jurnal ke DRAFT.
				await tx.journalEntry.update({
					where: {
						id: journal.id,
					},
					data: {
						date: newDate,
						referenceNumber: dto.documentCode ?? issue.documentCode,
						isPosted: false,
						isRevert: 'N',
						status: 'DRAFT',
					},
				});

				// 15. Kembalikan data terbaru.
				return tx.rawMaterialIssue.findUnique({
					where: { id },
					include: {
						items: {
							where: { deletedAt: null },
							include: {
								masterRawMaterial: {
									include: {
										unit: true,
									},
								},
							},
						},
						journalEntry: {
							where: { deletedAt: null },
							include: {
								details: {
									where: { deletedAt: null },
								},
							},
						},
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async removeIssue(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Ambil dokumen, detail, jurnal, dan detail jurnal aktif.
				const issue = await tx.rawMaterialIssue.findFirst({
					where: {
						id,
						deletedAt: null,
					},
					include: {
						items: {
							where: { deletedAt: null },
						},
						journalEntry: {
							where: { deletedAt: null },
							include: {
								details: {
									where: { deletedAt: null },
								},
							},
						},
					},
				});

				if (!issue) {
					throw new NotFoundException('Pengeluaran barang mentah tidak ditemukan');
				}

				const journal = issue.journalEntry[0];

				if (!journal) {
					throw new NotFoundException('Jurnal pengeluaran tidak ditemukan');
				}

				// 2. Validasi akses unit.
				if (!(decoded.isRoot === 'Y' || decoded.isPusat) && journal.unitId !== decoded.unitId) {
					throw new BadRequestException('Tidak memiliki akses ke unit transaksi ini');
				}

				// 3. Hanya DRAFT dan REVERTED yang boleh dihapus.
				const isDraft = journal.isPosted === false && journal.isRevert === 'N' && journal.status === 'DRAFT';

				const isReverted = journal.isPosted === false && journal.isRevert === 'Y' && journal.status === 'CANCELLED';

				if (!isDraft && !isReverted) {
					throw new BadRequestException('Pengeluaran hanya dapat dihapus jika berstatus DRAFT atau sudah REVERT');
				}

				// 4. Periksa histori inventory.
				// Pastikan tidak ada stok OUT yang belum dikembalikan.
				const inventoryHistory = await tx.inventoryTransactionBarangMentah.findMany({
					where: {
						sourceId: issue.id,
						deletedAt: null,
						source: {
							in: ['bahan produksi', 'revert pengeluaran bahan produksi'],
						},
					},
					select: {
						productId: true,
						quantity: true,
						transactionType: true,
						source: true,
					},
				});

				const stockHistory = new Map<
					string,
					{
						out: number;
						reverted: number;
					}
				>();

				for (const history of inventoryHistory) {
					const current = stockHistory.get(history.productId) ?? {
						out: 0,
						reverted: 0,
					};

					if (history.source === 'bahan produksi' && history.transactionType === 'OUT') {
						current.out += Number(history.quantity);
					}

					if (history.source === 'revert pengeluaran bahan produksi' && history.transactionType === 'IN') {
						current.reverted += Number(history.quantity);
					}

					stockHistory.set(history.productId, current);
				}

				for (const [productId, history] of stockHistory) {
					const outstandingOut = history.out - history.reverted;

					if (Math.abs(outstandingOut) > 0.000001) {
						throw new BadRequestException(`Riwayat stok bahan ${productId} belum netral. Lakukan Revert terlebih dahulu.`);
					}
				}

				// 5. Soft delete detail jurnal.
				const now = new Date();

				await tx.inventoryTransactionBarangMentah.updateMany({
					where: {
						sourceId: issue.id,
						source: {
							in: ['bahan produksi', 'revert pengeluaran bahan produksi'],
						},
						deletedAt: null,
					},
					data: { deletedAt: now },
				});

				await tx.journalEntryDetail.updateMany({
					where: {
						journalEntryId: journal.id,
						deletedAt: null,
					},
					data: {
						deletedAt: now,
					},
				});

				// 6. Soft delete detail pengeluaran.
				await tx.rawMaterialIssuetItem.updateMany({
					where: {
						issueId: issue.id,
						deletedAt: null,
					},
					data: {
						deletedAt: now,
					},
				});

				// 7. Soft delete jurnal.
				await tx.journalEntry.update({
					where: {
						id: journal.id,
					},
					data: {
						deletedAt: now,
					},
				});

				// 8. Soft delete dokumen pengeluaran.
				// Histori inventory tidak dihapus.
				return tx.rawMaterialIssue.update({
					where: {
						id: issue.id,
					},
					data: {
						deletedAt: now,
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async postReceipt(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Klaim dokumen agar tidak diposting dua kali.
				const claim = await tx.rawMaterialReceipt.updateMany({
					where: {
						id,
						deletedAt: null,
						status: { in: ['DRAFT', 'REVERTED'] },
					},
					data: { status: 'POSTING' },
				});

				if (claim.count !== 1) {
					const existing = await tx.rawMaterialReceipt.findFirst({
						where: { id, deletedAt: null },
						select: { id: true, status: true },
					});

					if (!existing) {
						throw new NotFoundException('Penerimaan bahan mentah tidak ditemukan');
					}

					throw new BadRequestException(`Penerimaan tidak dapat diposting. Status saat ini: ${existing.status}`);
				}

				// 2. Ambil dokumen dan item aktif.
				const receipt = await tx.rawMaterialReceipt.findFirst({
					where: {
						id,
						deletedAt: null,
						status: 'POSTING',
					},
					include: {
						items: {
							where: { deletedAt: null },
							include: {
								masterRawMaterial: {
									include: { account: true },
								},
							},
						},
					},
				});

				if (!receipt) {
					throw new NotFoundException('Data penerimaan bahan mentah tidak ditemukan');
				}

				if (receipt.items.length === 0) {
					throw new BadRequestException('Item penerimaan bahan mentah wajib diisi');
				}

				if (!(decoded.isRoot === 'Y' || decoded.isPusat) && receipt.unitId !== decoded.unitId) {
					throw new BadRequestException('Tidak memiliki akses ke unit transaksi ini');
				}

				// 3. Validasi periode akuntansi.
				const period = new Date(receipt.date).toISOString().slice(0, 7);

				const accountingPeriod = await tx.accountingPeriod.findUnique({
					where: { period },
				});

				if (accountingPeriod?.isLocked) {
					throw new BadRequestException('Periode akuntansi terkunci');
				}

				// 4. Mapping jurnal penerimaan.
				const mapping = await tx.accountMapping.findFirst({
					where: {
						module: Module.RECEIPT,
						transactionType: TransactionTypeMapping.MATERIAL_RECEIPT,
						deletedAt: null,
					},
				});

				if (!mapping) {
					throw new NotFoundException('Mapping jurnal penerimaan bahan mentah tidak ditemukan');
				}

				// 5. Gabungkan item berdasarkan produk agar perhitungan
				// stok dan harga rata-rata tidak memakai stok awal berulang.
				const itemsByProduct = new Map<
					string,
					{
						quantity: number;
						totalValue: number;
						satuan: string;
						itemIds: string[];
					}
				>();

				for (const item of receipt.items) {
					const quantity = Number(item.quantity);
					const nilaiSatuan = Number(item.nilaiSatuan);

					if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(nilaiSatuan) || nilaiSatuan < 0) {
						throw new BadRequestException(
							`Quantity atau nilai satuan tidak valid untuk bahan mentah ${item.masterRawMaterialId}`,
						);
					}

					if (!item.masterRawMaterial?.account) {
						throw new BadRequestException(`Akun bahan mentah tidak ditemukan untuk produk ${item.masterRawMaterialId}`);
					}

					const productId = item.masterRawMaterialId;
					const current = itemsByProduct.get(productId);

					if (current) {
						current.quantity += quantity;
						current.totalValue += quantity * nilaiSatuan;
						current.itemIds.push(item.id);
					} else {
						itemsByProduct.set(productId, {
							quantity,
							totalValue: quantity * nilaiSatuan,
							satuan: item.satuan,
							itemIds: [item.id],
						});
					}
				}

				// 6. Posting transaksi stok bahan mentah.
				for (const [productId, item] of itemsByProduct) {
					const stockSummary = await tx.stockSummaryBarangMentah.findUnique({
						where: { productId },
					});

					const currentStock = Number(stockSummary?.stock ?? 0);
					const currentAverage = Number(stockSummary?.averageCost ?? 0);

					if (!Number.isFinite(currentStock) || !Number.isFinite(currentAverage) || currentStock < 0) {
						throw new BadRequestException(`Ringkasan stok atau harga rata-rata tidak valid untuk produk ${productId}`);
					}

					const newTotalQty = currentStock + item.quantity;
					const incomingAverage = item.totalValue / item.quantity;

					const averageCostAfter = newTotalQty > 0 ? (currentStock * currentAverage + item.totalValue) / newTotalQty : 0;

					await tx.inventoryTransactionBarangMentah.create({
						data: {
							productId,
							transactionType: 'IN',
							quantity: item.quantity,
							satuan: item.satuan,
							nilaiSatuan: incomingAverage,
							source: 'persediaan',
							sourceId: receipt.id,
							averageCostAfter,
							stockAfter: newTotalQty,
							transactionDate: receipt.date,
							unitId: receipt.unitId,
						},
					});

					await tx.stockSummaryBarangMentah.upsert({
						where: { productId },
						update: {
							stock: newTotalQty,
							averageCost: averageCostAfter,
							transactionDate: receipt.date,
						},
						create: {
							productId,
							stock: newTotalQty,
							averageCost: averageCostAfter,
							transactionDate: receipt.date,
						},
					});

					const [stokMasuk, stokKeluar] = await Promise.all([
						tx.inventoryTransactionBarangMentah.aggregate({
							_sum: { quantity: true },
							where: {
								productId,
								transactionType: 'IN',
								deletedAt: null,
							},
						}),
						tx.inventoryTransactionBarangMentah.aggregate({
							_sum: { quantity: true },
							where: {
								productId,
								transactionType: 'OUT',
								deletedAt: null,
							},
						}),
					]);

					const stokTerkini = Number(stokMasuk._sum.quantity ?? 0) - Number(stokKeluar._sum.quantity ?? 0);

					await tx.rawMaterialReceiptItem.updateMany({
						where: {
							receiptId: receipt.id,
							masterRawMaterialId: productId,
							deletedAt: null,
						},
						data: { stok: stokTerkini },
					});
				}

				// 7. Siapkan detail jurnal berdasarkan nilai transaksi.
				const journalDetails = receipt.items.flatMap((item) => {
					const total = Number(item.quantity) * Number(item.nilaiSatuan);

					const accountCode = item.masterRawMaterial.accountCode;
					const accountName = item.masterRawMaterial.account.name;

					return [
						{
							accountCode,
							debit: total,
							credit: 0,
							unitId: receipt.unitId,
							description: accountName,
						},
						{
							accountCode: mapping.accountCode,
							debit: 0,
							credit: total,
							unitId: receipt.unitId,
							description: 'sesuaikan account',
						},
					];
				});

				const accountCodes = [...new Set(journalDetails.map((detail) => detail.accountCode))];

				const validAccounts = await tx.account.findMany({
					where: {
						code: { in: accountCodes },
						deletedAt: null,
					},
					select: { code: true },
				});

				const validAccountCodes = new Set(validAccounts.map((account) => account.code));

				const missingAccounts = accountCodes.filter((code) => !validAccountCodes.has(code));

				if (missingAccounts.length > 0) {
					throw new BadRequestException({
						message: 'Akun jurnal tidak ditemukan',
						accountCodes: missingAccounts,
					});
				}

				// 8. Buat jurnal.
				const numberJurnal = await this.createJournal();

				const totalDebit = journalDetails.reduce((sum, detail) => sum + Number(detail.debit), 0);

				const journal = await tx.journalEntry.create({
					data: {
						staffId: decoded.id,
						date: receipt.date,
						module: 'PURCHASE',
						createdBy: 'System',
						description: 'Penerimaan bahan baku',
						purposeTransaction: 'Penerimaan bahan baku',
						referenceNumber: receipt.documentCode,
						numberJurnal,
						rawMaterialReceiptId: receipt.id,
						unitId: receipt.unitId,
						totalBalance: totalDebit,
						details: {
							create: journalDetails,
						},
					},
					include: {
						details: true,
					},
				});

				// 9. Perbarui General Ledger.
				for (const detail of journal.details) {
					const debit = Number(detail.debit);
					const credit = Number(detail.credit);

					await tx.generalLedger.upsert({
						where: {
							unit_accountCode_periode: {
								unitId: receipt.unitId,
								accountCode: detail.accountCode,
								period,
							},
						},
						update: {
							debitTotal: { increment: debit },
							creditTotal: { increment: credit },
						},
						create: {
							unitId: receipt.unitId,
							accountCode: detail.accountCode,
							period,
							debitTotal: debit,
							creditTotal: credit,
							openingDebit: 0,
							openingCredit: 0,
							staffId: decoded.id,
						},
					});
				}

				// 10. Tambahkan Barang Jadi jika checkbox aktif.
				if (receipt.simpanKeBarangJadi === true) {
					const UNIT_RA_ID = 'dec5789a-425f-4818-937c-82ae1190bc22';

					const rawMaterialIds = [...new Set(receipt.items.map((item) => item.masterRawMaterialId))];

					const rawMaterials = await tx.masterRawMaterial.findMany({
						where: {
							id: { in: rawMaterialIds },
							deletedAt: null,
						},
						select: {
							id: true,
							itemCode: true,
						},
					});

					const rawMaterialCodeMap = new Map(rawMaterials.map((item) => [item.id, item.itemCode.trim()]));

					const itemCodes = [...new Set(rawMaterials.map((item) => item.itemCode.trim()).filter((code) => code.length > 0))];

					const finishedGoods = await tx.masterBarangJadi.findMany({
						where: {
							kodeBarang: { in: itemCodes },
							deletedAt: null,
						},
					});

					const finishedGoodMap = new Map<string, (typeof finishedGoods)[number]>();

					for (const product of finishedGoods) {
						const code = product.kodeBarang.trim();

						if (finishedGoodMap.has(code)) {
							throw new BadRequestException(`Kode Barang Jadi ${code} ditemukan lebih dari satu kali.`);
						}

						finishedGoodMap.set(code, product);
					}

					const unmatchedCodes: string[] = [];

					for (const item of receipt.items) {
						const rawCode = rawMaterialCodeMap.get(item.masterRawMaterialId);

						if (!rawCode || !finishedGoodMap.has(rawCode)) {
							unmatchedCodes.push(rawCode || `ID Barang Mentah: ${item.masterRawMaterialId}`);
						}
					}

					if (unmatchedCodes.length > 0) {
						throw new BadRequestException({
							message: 'Kode Barang Mentah berikut tidak memiliki pasangan Barang Jadi.',
							unmatchedCodes: [...new Set(unmatchedCodes)],
						});
					}

					const matchedItems = receipt.items.map((item) => {
						const rawCode = rawMaterialCodeMap.get(item.masterRawMaterialId)!;

						const finishedGood = finishedGoodMap.get(rawCode)!;
						const quantity = Number(item.quantity);

						if (!Number.isFinite(quantity) || quantity <= 0 || Number(quantity.toFixed(2)) !== quantity) {
							throw new BadRequestException(
								`Quantity dengan kode ${rawCode} harus berupa bilangan positif maksimal 2 angka desimal untuk Barang Jadi.`,
							);
						}

						return { finishedGood, quantity };
					});

					const unitRA = await tx.masterUnit.findUnique({
						where: { id: UNIT_RA_ID },
					});

					if (!unitRA) {
						throw new NotFoundException('Master Unit RA tidak ditemukan.');
					}

					await tx.inventoryTransaction.createMany({
						data: matchedItems.map(({ finishedGood, quantity }) => ({
							source: 'produksi/persediaan',
							sourceId: receipt.id,
							transactionType: 'IN',
							productId: finishedGood.id,
							quantity,
							satuan: finishedGood.satuan,
							nilaiSatuan: finishedGood.nilaiSatuan,
							unitId: UNIT_RA_ID,
							createdAt: receipt.date,
							transactionDate: receipt.date,
						})),
					});

					const receiptItems = await Promise.all(
						matchedItems.map(async ({ finishedGood, quantity }) => {
							const [stokMasuk, stokKeluar] = await Promise.all([
								tx.inventoryTransaction.aggregate({
									_sum: { quantity: true },
									where: {
										productId: finishedGood.id,
										transactionType: 'IN',
										unitId: UNIT_RA_ID,
										deletedAt: null,
									},
								}),
								tx.inventoryTransaction.aggregate({
									_sum: { quantity: true },
									where: {
										productId: finishedGood.id,
										transactionType: 'OUT',
										unitId: UNIT_RA_ID,
										deletedAt: null,
									},
								}),
							]);

							const stok = Number(stokMasuk._sum.quantity ?? 0) - Number(stokKeluar._sum.quantity ?? 0);

							return {
								finishedGoodId: finishedGood.id,
								quantity,
								Satuan: finishedGood.satuan,
								nilaiSatuan: finishedGood.nilaiSatuan,
								Total: quantity * finishedGood.nilaiSatuan,
								stok,
								spesifikasi: 'Penerimaan otomatis dari Barang Mentah',
								namaBarang: finishedGood.namaBarang,
								kodeBarang: finishedGood.kodeBarang,
								kategori: finishedGood.kategori,
								unitId: UNIT_RA_ID,
								createdAt: receipt.date,
							};
						}),
					);

					// Gunakan kembali dokumen otomatis agar repost tidak
					// membuat dokumen Barang Jadi duplikat.
					const autoDocumentCode = `AUTO-${receipt.documentCode}`;

					const existingProductionReceipt = await tx.productionReceipt.findFirst({
						where: {
							documentCode: autoDocumentCode,
							unitId: UNIT_RA_ID,
						},
						orderBy: { createdAt: 'desc' },
					});

					if (existingProductionReceipt) {
						await tx.productionReceiptItem.updateMany({
							where: {
								receiptId: existingProductionReceipt.id,
								deletedAt: null,
							},
							data: { deletedAt: new Date() },
						});

						await tx.productionReceipt.update({
							where: {
								id: existingProductionReceipt.id,
							},
							data: {
								documentNumber: `AUTO-${receipt.documentNo}`,
								date: receipt.date,
								staffId: decoded.id,
								deletedAt: null,
								items: {
									create: receiptItems,
								},
							},
						});
					} else {
						await tx.productionReceipt.create({
							data: {
								documentCode: autoDocumentCode,
								documentNumber: `AUTO-${receipt.documentNo}`,
								date: receipt.date,
								unitId: UNIT_RA_ID,
								staffId: decoded.id,
								items: {
									create: receiptItems,
								},
							},
						});
					}
				}

				// 11. Tandai jurnal dan dokumen sebagai POSTED.
				await tx.journalEntry.update({
					where: { id: journal.id },
					data: {
						isPosted: true,
						isRevert: 'N',
						status: 'CONFIRMED',
					},
				});

				return tx.rawMaterialReceipt.update({
					where: { id: receipt.id },
					data: { status: 'POSTED' },
					include: {
						items: true,
						journalEntry: {
							include: {
								details: true,
							},
						},
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async revertReceipt(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Klaim dokumen agar tidak direvert dua kali bersamaan.
				const claim = await tx.rawMaterialReceipt.updateMany({
					where: {
						id,
						deletedAt: null,
						status: 'POSTED',
					},
					data: { status: 'REVERTING' },
				});

				if (claim.count !== 1) {
					const existing = await tx.rawMaterialReceipt.findFirst({
						where: { id, deletedAt: null },
						select: { id: true, status: true },
					});

					if (!existing) {
						throw new NotFoundException('Penerimaan bahan mentah tidak ditemukan');
					}

					throw new BadRequestException(
						`Penerimaan hanya dapat direvert jika status POSTED. Status saat ini: ${existing.status ?? 'NULL'}`,
					);
				}

				// 2. Ambil dokumen dan jurnal aktif.
				const receipt = await tx.rawMaterialReceipt.findFirst({
					where: {
						id,
						deletedAt: null,
						status: 'REVERTING',
					},
					include: {
						items: {
							where: { deletedAt: null },
						},
						journalEntry: {
							where: { deletedAt: null },
							orderBy: { createdAt: 'desc' },
							include: { details: true },
						},
					},
				});

				if (!receipt) {
					throw new NotFoundException('Data penerimaan bahan mentah tidak ditemukan');
				}

				if (!(decoded.isRoot === 'Y' || decoded.isPusat) && receipt.unitId !== decoded.unitId) {
					throw new BadRequestException('Tidak memiliki akses ke unit transaksi ini');
				}

				if (receipt.items.length === 0) {
					throw new BadRequestException('Detail penerimaan tidak ditemukan');
				}

				const journal = receipt.journalEntry.find(
					(item) => item.isPosted === true && item.status === 'CONFIRMED' && item.isRevert !== 'Y',
				);

				if (!journal) {
					throw new NotFoundException('Jurnal penerimaan aktif yang sudah diposting tidak ditemukan');
				}

				// 3. Validasi periode akuntansi.
				const period = new Date(journal.date).toISOString().slice(0, 7);

				const accountingPeriod = await tx.accountingPeriod.findUnique({
					where: { period },
				});

				if (accountingPeriod?.isLocked) {
					throw new BadRequestException('Periode akuntansi terkunci');
				}

				// 4. Gabungkan detail berdasarkan produk.
				const itemsByProduct = new Map<string, { quantity: number; satuan: string }>();

				for (const item of receipt.items) {
					const quantity = Number(item.quantity);

					if (!Number.isFinite(quantity) || quantity <= 0) {
						throw new BadRequestException(`Quantity tidak valid untuk bahan ${item.masterRawMaterialId}`);
					}

					const current = itemsByProduct.get(item.masterRawMaterialId);

					if (current) {
						current.quantity += quantity;
					} else {
						itemsByProduct.set(item.masterRawMaterialId, {
							quantity,
							satuan: item.satuan,
						});
					}
				}

				// 5. Periksa riwayat siklus Posting dan Revert.
				// Posting ulang menggunakan sourceId yang sama.
				// Karena itu, validasi harus menggunakan IN dikurangi OUT,
				// bukan menolak hanya karena pernah ada Revert.
				const inventoryHistory = await tx.inventoryTransactionBarangMentah.findMany({
					where: {
						sourceId: receipt.id,
						source: {
							in: ['persediaan', 'revert penerimaan bahan mentah'],
						},
						deletedAt: null,
					},
					select: {
						productId: true,
						quantity: true,
						transactionType: true,
						source: true,
					},
				});

				for (const [productId, item] of itemsByProduct) {
					const history = inventoryHistory.filter((row) => row.productId === productId);

					const totalIn = history
						.filter((row) => row.source === 'persediaan' && row.transactionType === 'IN')
						.reduce((sum, row) => sum + Number(row.quantity), 0);

					const totalReverted = history
						.filter((row) => row.source === 'revert penerimaan bahan mentah' && row.transactionType === 'OUT')
						.reduce((sum, row) => sum + Number(row.quantity), 0);

					const netPosted = totalIn - totalReverted;

					if (Math.abs(netPosted - item.quantity) > 0.000001) {
						throw new BadRequestException(
							`Riwayat stok bahan ${productId} tidak sesuai dengan jumlah penerimaan yang sedang aktif. Saldo riwayat: ${netPosted}, jumlah dokumen: ${item.quantity}`,
						);
					}

					const summary = await tx.stockSummaryBarangMentah.findUnique({
						where: { productId },
					});

					if (!summary) {
						throw new NotFoundException(`Ringkasan stok tidak ditemukan untuk bahan ${productId}`);
					}

					const currentStock = Number(summary.stock);
					const currentAverage = Number(summary.averageCost);

					if (!Number.isFinite(currentStock) || !Number.isFinite(currentAverage) || currentStock < 0 || currentAverage < 0) {
						throw new BadRequestException(`Ringkasan stok atau harga rata-rata tidak valid untuk bahan ${productId}`);
					}

					if (currentStock + 0.000001 < item.quantity) {
						throw new BadRequestException(
							`Stok bahan ${productId} tidak cukup untuk Revert. Stok saat ini: ${currentStock}, jumlah yang dibalik: ${item.quantity}`,
						);
					}

					// 6. Kurangi stok menggunakan harga rata-rata berjalan.
					// Weighted average tidak dikembalikan ke nilai historis
					// hasil tebakan. Jika stok habis, harga rata-rata menjadi 0.
					const stockAfter = Math.max(0, currentStock - item.quantity);

					const averageCostAfter = stockAfter <= 0.000001 ? 0 : currentAverage;

					const now = new Date();

					await tx.inventoryTransactionBarangMentah.create({
						data: {
							productId,
							unitId: receipt.unitId,
							transactionType: 'OUT',
							quantity: item.quantity,
							satuan: item.satuan,
							nilaiSatuan: currentAverage,
							source: 'revert penerimaan bahan mentah',
							sourceId: receipt.id,
							stockAfter,
							averageCostAfter,
							transactionDate: now,
						},
					});

					await tx.stockSummaryBarangMentah.update({
						where: { productId },
						data: {
							stock: stockAfter,
							averageCost: averageCostAfter,
							transactionDate: now,
						},
					});

					// 7. Perbarui stok pada detail penerimaan.
					const [stokMasuk, stokKeluar] = await Promise.all([
						tx.inventoryTransactionBarangMentah.aggregate({
							_sum: { quantity: true },
							where: {
								productId,
								transactionType: 'IN',
								deletedAt: null,
							},
						}),
						tx.inventoryTransactionBarangMentah.aggregate({
							_sum: { quantity: true },
							where: {
								productId,
								transactionType: 'OUT',
								deletedAt: null,
							},
						}),
					]);

					const stokTerkini = Number(stokMasuk._sum.quantity ?? 0) - Number(stokKeluar._sum.quantity ?? 0);

					await tx.rawMaterialReceiptItem.updateMany({
						where: {
							receiptId: receipt.id,
							masterRawMaterialId: productId,
							deletedAt: null,
						},
						data: { stok: stokTerkini },
					});
				}

				// 8. Revert Barang Jadi otomatis bila diaktifkan.
				if (receipt.simpanKeBarangJadi === true) {
					const UNIT_RA_ID = 'dec5789a-425f-4818-937c-82ae1190bc22';

					const autoDocumentCode = `AUTO-${receipt.documentCode}`;

					const productionReceipt = await tx.productionReceipt.findFirst({
						where: {
							documentCode: autoDocumentCode,
							unitId: UNIT_RA_ID,
							deletedAt: null,
						},
						include: {
							items: {
								where: { deletedAt: null },
							},
						},
						orderBy: { createdAt: 'desc' },
					});

					if (!productionReceipt) {
						throw new NotFoundException('Penerimaan Barang Jadi otomatis tidak ditemukan. Revert dibatalkan.');
					}

					if (productionReceipt.items.length === 0) {
						throw new BadRequestException('Detail Barang Jadi otomatis tidak ditemukan.');
					}

					const fgQtyByProduct = new Map<
						string,
						{
							quantity: number;
							satuan: string;
							nilaiSatuan: number;
						}
					>();

					for (const item of productionReceipt.items) {
						const quantity = Number(item.quantity);
						const nilaiSatuan = Number(item.nilaiSatuan);

						if (!Number.isFinite(quantity) || quantity <= 0) {
							throw new BadRequestException(`Quantity Barang Jadi tidak valid untuk produk ${item.finishedGoodId}`);
						}

						const current = fgQtyByProduct.get(item.finishedGoodId);

						if (current) {
							current.quantity += quantity;
						} else {
							fgQtyByProduct.set(item.finishedGoodId, {
								quantity,
								satuan: item.Satuan,
								nilaiSatuan,
							});
						}
					}

					const fgHistory = await tx.inventoryTransaction.findMany({
						where: {
							sourceId: receipt.id,
							source: {
								in: ['produksi/persediaan', 'revert penerimaan bahan mentah'],
							},
							unitId: UNIT_RA_ID,
							deletedAt: null,
						},
						select: {
							productId: true,
							quantity: true,
							transactionType: true,
							source: true,
						},
					});

					for (const [productId, item] of fgQtyByProduct) {
						const history = fgHistory.filter((row) => row.productId === productId);

						const totalIn = history
							.filter((row) => row.source === 'produksi/persediaan' && row.transactionType === 'IN')
							.reduce((sum, row) => sum + Number(row.quantity), 0);

						const totalReverted = history
							.filter((row) => row.source === 'revert penerimaan bahan mentah' && row.transactionType === 'OUT')
							.reduce((sum, row) => sum + Number(row.quantity), 0);

						const netPosted = totalIn - totalReverted;

						if (Math.abs(netPosted - item.quantity) > 0.000001) {
							throw new BadRequestException(
								`Riwayat Barang Jadi ${productId} tidak sesuai. Saldo riwayat: ${netPosted}, jumlah dokumen: ${item.quantity}`,
							);
						}

						const [stokMasuk, stokKeluar] = await Promise.all([
							tx.inventoryTransaction.aggregate({
								_sum: { quantity: true },
								where: {
									productId,
									unitId: UNIT_RA_ID,
									transactionType: 'IN',
									deletedAt: null,
								},
							}),
							tx.inventoryTransaction.aggregate({
								_sum: { quantity: true },
								where: {
									productId,
									unitId: UNIT_RA_ID,
									transactionType: 'OUT',
									deletedAt: null,
								},
							}),
						]);

						const availableStock = Number(stokMasuk._sum.quantity ?? 0) - Number(stokKeluar._sum.quantity ?? 0);

						if (availableStock < item.quantity) {
							throw new BadRequestException(
								`Stok Barang Jadi ${productId} tidak cukup untuk Revert. Stok tersedia: ${availableStock}, jumlah yang dibalik: ${item.quantity}`,
							);
						}

						await tx.inventoryTransaction.create({
							data: {
								productId,
								unitId: UNIT_RA_ID,
								transactionType: 'OUT',
								quantity: item.quantity,
								satuan: item.satuan,
								nilaiSatuan: item.nilaiSatuan,
								source: 'revert penerimaan bahan mentah',
								sourceId: receipt.id,
								transactionDate: new Date(),
							},
						});
					}

					const now = new Date();

					await tx.productionReceiptItem.updateMany({
						where: {
							receiptId: productionReceipt.id,
							deletedAt: null,
						},
						data: { deletedAt: now },
					});

					await tx.productionReceipt.update({
						where: { id: productionReceipt.id },
						data: { deletedAt: now },
					});
				}

				// 9. Validasi saldo GL sebelum membalik jurnal.
				// Akumulasi per akun agar beberapa detail akun yang sama
				// tidak menyebabkan validasi saldo yang keliru.
				const ledgerChanges = new Map<
					string,
					{
						accountCode: string;
						debit: number;
						credit: number;
					}
				>();

				for (const detail of journal.details) {
					const debit = Number(detail.debit);
					const credit = Number(detail.credit);

					if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
						throw new BadRequestException('Nilai debit atau kredit jurnal tidak valid');
					}

					const current = ledgerChanges.get(detail.accountCode);

					if (current) {
						current.debit += debit;
						current.credit += credit;
					} else {
						ledgerChanges.set(detail.accountCode, {
							accountCode: detail.accountCode,
							debit,
							credit,
						});
					}
				}

				for (const change of ledgerChanges.values()) {
					const ledger = await tx.generalLedger.findUnique({
						where: {
							unit_accountCode_periode: {
								unitId: journal.unitId,
								accountCode: change.accountCode,
								period,
							},
						},
					});

					if (
						!ledger ||
						Number(ledger.debitTotal) + 0.000001 < change.debit ||
						Number(ledger.creditTotal) + 0.000001 < change.credit
					) {
						throw new BadRequestException(
							`Saldo General Ledger tidak mencukupi atau tidak ditemukan untuk akun ${change.accountCode}`,
						);
					}

					const result = await tx.generalLedger.updateMany({
						where: {
							unitId: journal.unitId,
							accountCode: change.accountCode,
							period,
							deletedAt: null,
							debitTotal: { gte: change.debit },
							creditTotal: { gte: change.credit },
						},
						data: {
							debitTotal: { decrement: change.debit },
							creditTotal: { decrement: change.credit },
						},
					});

					if (result.count !== 1) {
						throw new BadRequestException(`Gagal membalik General Ledger akun ${change.accountCode}`);
					}
				}

				// 10. Tandai jurnal sudah direvert.
				await tx.journalEntry.update({
					where: { id: journal.id },
					data: {
						isPosted: false,
						isRevert: 'Y',
						status: 'CANCELLED',
					},
				});

				// 11. Tandai dokumen REVERTED.
				return tx.rawMaterialReceipt.update({
					where: { id: receipt.id },
					data: { status: 'REVERTED' },
					include: {
						items: {
							where: { deletedAt: null },
						},
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async removeReceipt(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Ambil dokumen beserta semua detail dan jurnal aktif.
				const receipt = await tx.rawMaterialReceipt.findFirst({
					where: {
						id,
						deletedAt: null,
					},
					include: {
						items: true,
						journalEntry: {
							where: { deletedAt: null },
							include: { details: true },
						},
					},
				});

				if (!receipt) {
					throw new NotFoundException('Penerimaan bahan mentah tidak ditemukan');
				}

				// 2. Validasi akses.
				if (!(decoded.isRoot === 'Y' || decoded.isPusat) && receipt.unitId !== decoded.unitId) {
					throw new BadRequestException('Tidak memiliki akses ke unit transaksi ini');
				}

				// 3. Hanya DRAFT dan REVERTED yang boleh dihapus.
				if (receipt.status !== 'DRAFT' && receipt.status !== 'REVERTED') {
					throw new BadRequestException(`Penerimaan tidak dapat dihapus. Status saat ini: ${receipt.status ?? 'NULL'}.`);
				}

				// 4. Pastikan jurnal tidak lagi diposting.
				for (const journal of receipt.journalEntry) {
					if (journal.isPosted) {
						throw new BadRequestException('Jurnal masih diposting. Revert penerimaan terlebih dahulu.');
					}

					if (receipt.status === 'REVERTED' && (journal.isRevert !== 'Y' || journal.status !== 'CANCELLED')) {
						throw new BadRequestException('Status jurnal belum menunjukkan Revert selesai. Data tidak dihapus.');
					}

					if (receipt.status === 'DRAFT' && journal.isRevert !== 'N') {
						throw new BadRequestException('Status jurnal draft tidak valid untuk dihapus.');
					}
				}

				// 5. Untuk REVERTED, pastikan seluruh riwayat stok
				// bahan mentah sudah netral, termasuk siklus sebelumnya.
				if (receipt.status === 'REVERTED') {
					const history = await tx.inventoryTransactionBarangMentah.findMany({
						where: {
							sourceId: receipt.id,
							source: {
								in: ['persediaan', 'revert penerimaan bahan mentah'],
							},
							deletedAt: null,
						},
						select: {
							productId: true,
							quantity: true,
							transactionType: true,
							source: true,
						},
					});

					const productIds = [...new Set(history.map((row) => row.productId))];

					for (const productId of productIds) {
						const productHistory = history.filter((row) => row.productId === productId);

						const totalIn = productHistory
							.filter((row) => row.source === 'persediaan' && row.transactionType === 'IN')
							.reduce((sum, row) => sum + Number(row.quantity), 0);

						const totalOut = productHistory
							.filter((row) => row.source === 'revert penerimaan bahan mentah' && row.transactionType === 'OUT')
							.reduce((sum, row) => sum + Number(row.quantity), 0);

						if (Math.abs(totalIn - totalOut) > 0.000001) {
							throw new BadRequestException(
								`Riwayat stok bahan ${productId} belum sepenuhnya direvert. Total masuk: ${totalIn}, total revert: ${totalOut}. Data tidak dihapus.`,
							);
						}
					}

					// 6. Jika memakai Barang Jadi otomatis, pastikan
					// riwayat Barang Jadi juga sudah netral.
					if (receipt.simpanKeBarangJadi === true) {
						const fgHistory = await tx.inventoryTransaction.findMany({
							where: {
								sourceId: receipt.id,
								source: {
									in: ['produksi/persediaan', 'revert penerimaan bahan mentah'],
								},
								unitId: 'dec5789a-425f-4818-937c-82ae1190bc22',
								deletedAt: null,
							},
							select: {
								productId: true,
								quantity: true,
								transactionType: true,
								source: true,
							},
						});

						const fgProductIds = [...new Set(fgHistory.map((row) => row.productId))];

						for (const productId of fgProductIds) {
							const productHistory = fgHistory.filter((row) => row.productId === productId);

							const totalIn = productHistory
								.filter((row) => row.source === 'produksi/persediaan' && row.transactionType === 'IN')
								.reduce((sum, row) => sum + Number(row.quantity), 0);

							const totalOut = productHistory
								.filter((row) => row.source === 'revert penerimaan bahan mentah' && row.transactionType === 'OUT')
								.reduce((sum, row) => sum + Number(row.quantity), 0);

							if (Math.abs(totalIn - totalOut) > 0.000001) {
								throw new BadRequestException(`Riwayat Barang Jadi ${productId} belum sepenuhnya direvert. Data tidak dihapus.`);
							}
						}
					}
				}

				// 7. Hapus transaksi stok yang dimiliki dokumen ini.
				// StockSummary dan GL tidak diubah di sini karena transaksi
				// yang POSTED seharusnya sudah dibalik melalui Revert.
				await tx.inventoryTransactionBarangMentah.deleteMany({
					where: {
						sourceId: receipt.id,
						source: {
							in: ['persediaan', 'revert penerimaan bahan mentah'],
						},
					},
				});

				await tx.inventoryTransaction.deleteMany({
					where: {
						sourceId: receipt.id,
						source: {
							in: ['produksi/persediaan', 'revert penerimaan bahan mentah'],
						},
					},
				});

				// 8. Hapus dokumen Barang Jadi otomatis yang tepat.
				if (receipt.simpanKeBarangJadi === true) {
					const autoReceipt = await tx.productionReceipt.findFirst({
						where: {
							documentCode: `AUTO-${receipt.documentCode}`,
							documentNumber: `AUTO-${receipt.documentNo}`,
							unitId: 'dec5789a-425f-4818-937c-82ae1190bc22',
						},
						orderBy: { createdAt: 'desc' },
						select: { id: true },
					});

					if (autoReceipt) {
						await tx.productionReceiptItem.deleteMany({
							where: {
								receiptId: autoReceipt.id,
							},
						});

						await tx.productionReceipt.delete({
							where: { id: autoReceipt.id },
						});
					}
				}

				// 9. Hapus detail jurnal dan jurnal terkait.
				// GL tidak dikurangi lagi pada tahap Delete.
				for (const journal of receipt.journalEntry) {
					await tx.journalEntryDetail.deleteMany({
						where: {
							journalEntryId: journal.id,
						},
					});

					await tx.journalEntry.delete({
						where: { id: journal.id },
					});
				}

				// 10. Hapus detail dan header penerimaan.
				await tx.rawMaterialReceiptItem.deleteMany({
					where: {
						receiptId: receipt.id,
					},
				});

				return tx.rawMaterialReceipt.delete({
					where: { id: receipt.id },
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async updateReceipt(id: string, dto: UpdateRawMaterialDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Ambil dokumen penerimaan yang masih aktif.
				const existing = await tx.rawMaterialReceipt.findFirst({
					where: {
						id,
						deletedAt: null,
					},
					include: {
						items: {
							where: { deletedAt: null },
						},
					},
				});

				if (!existing) {
					throw new NotFoundException('Penerimaan bahan mentah tidak ditemukan');
				}

				// 2. Validasi hak akses unit.
				if (!(decoded.isRoot === 'Y' || decoded.isPusat) && existing.unitId !== decoded.unitId) {
					throw new BadRequestException('Tidak memiliki akses ke unit transaksi ini');
				}

				// 3. Edit hanya diperbolehkan untuk DRAFT dan REVERTED.
				if (existing.status !== 'DRAFT' && existing.status !== 'REVERTED') {
					throw new BadRequestException(
						`Penerimaan hanya dapat diedit jika status DRAFT atau REVERTED. Status saat ini: ${existing.status}`,
					);
				}

				// 4. Jika items dikirim, pastikan isinya valid.
				// Jika items tidak dikirim, detail lama tetap dipertahankan.
				if (dto.items !== undefined) {
					if (!Array.isArray(dto.items) || dto.items.length === 0) {
						throw new BadRequestException('Item penerimaan bahan mentah wajib diisi');
					}

					for (const item of dto.items) {
						const quantity = Number(item.quantity);
						const nilaiSatuan = Number(item.nilaiSatuan);

						if (!Number.isFinite(quantity) || quantity <= 0) {
							throw new BadRequestException('Quantity harus lebih besar dari nol');
						}

						if (!Number.isFinite(nilaiSatuan) || nilaiSatuan < 0) {
							throw new BadRequestException('Nilai satuan tidak valid');
						}

						if (!item.masterRawMaterialId || !item.Satuan?.trim() || !item.accountCode?.trim() || !item.accountName?.trim()) {
							throw new BadRequestException('Bahan mentah, satuan, accountCode, dan accountName wajib diisi');
						}
					}
				}

				// 5. Validasi field header yang dikirim.
				if (dto.simpanKeBarangJadi !== undefined && typeof dto.simpanKeBarangJadi !== 'boolean') {
					throw new BadRequestException('simpanKeBarangJadi harus berupa boolean');
				}

				// 6. Klaim dokumen untuk mencegah update berdasarkan status lama.
				const claim = await tx.rawMaterialReceipt.updateMany({
					where: {
						id,
						deletedAt: null,
						status: existing.status,
					},
					data: {
						status: 'UPDATING',
					},
				});

				if (claim.count !== 1) {
					throw new BadRequestException('Status penerimaan berubah. Muat ulang data sebelum mengedit.');
				}

				// 7. Susun perubahan header hanya dari field yang dikirim.
				const headerData: Record<string, any> = {};

				if (dto.documentCode !== undefined) {
					headerData.documentCode = dto.documentCode;
				}

				if (dto.documentNo !== undefined) {
					headerData.documentNo = dto.documentNo;
				}

				if (dto.idSupplier !== undefined) {
					headerData.supplierId = dto.idSupplier;
				}

				if (dto.date !== undefined) {
					headerData.date = dto.date;
				}

				if (dto.faktur !== undefined) {
					headerData.faktur = dto.faktur;
				}

				if (dto.noRekening !== undefined) {
					headerData.noRekening = dto.noRekening;
				}

				if (dto.pengadaanBarang !== undefined) {
					headerData.pengadaanBarang = dto.pengadaanBarang;
				}

				if (dto.simpanKeBarangJadi !== undefined) {
					headerData.simpanKeBarangJadi = dto.simpanKeBarangJadi;
				}

				if (Object.keys(headerData).length > 0) {
					await tx.rawMaterialReceipt.update({
						where: { id },
						data: headerData,
					});
				}

				// 8. Ganti detail hanya jika items dikirim.
				if (dto.items !== undefined) {
					const now = new Date();

					// Nonaktifkan detail lama tanpa menghapus riwayat.
					await tx.rawMaterialReceiptItem.updateMany({
						where: {
							receiptId: id,
							deletedAt: null,
						},
						data: {
							deletedAt: now,
						},
					});

					// Buat detail pengganti.
					await tx.rawMaterialReceiptItem.createMany({
						data: dto.items.map((item) => ({
							receiptId: id,
							masterRawMaterialId: item.masterRawMaterialId,
							nilaiSatuan: Number(item.nilaiSatuan),
							quantity: Number(item.quantity),
							satuan: item.Satuan,
							Total: Number(item.quantity) * Number(item.nilaiSatuan),
							stok: 0,
						})),
					});
				}

				// 9. Kembalikan status ke status sebelum update.
				// Tidak mengubah stok, jurnal, atau GL.
				await tx.rawMaterialReceipt.update({
					where: { id },
					data: {
						status: existing.status,
					},
				});

				// 10. Kembalikan dokumen beserta detail aktif.
				return tx.rawMaterialReceipt.findFirst({
					where: {
						id,
						deletedAt: null,
					},
					include: {
						items: {
							where: { deletedAt: null },
						},
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async getRawMaterialReceiptList(params?: {
		unitId?: string;
		startDate?: Date;
		endDate?: Date;
		page?: number;
		limit?: number;
		itemCode?: string;
		itemName?: string;
	}) {
		const { unitId, startDate, endDate, page = 1, limit = 50, itemCode, itemName } = params ?? {};

		const currentPage = Math.max(1, Math.floor(Number(page) || 1));
		const pageLimit = Math.max(1, Math.floor(Number(limit) || 50));

		// Filter kode dan nama barang digabung agar keduanya bisa aktif bersamaan.
		const masterRawMaterialWhere: any = {};

		if (itemCode?.trim()) {
			masterRawMaterialWhere.itemCode = {
				contains: itemCode.trim(),
				mode: 'insensitive',
			};
		}

		if (itemName?.trim()) {
			masterRawMaterialWhere.itemName = {
				contains: itemName.trim(),
				mode: 'insensitive',
			};
		}

		const itemWhere: any = {
			deletedAt: null,

			...(Object.keys(masterRawMaterialWhere).length > 0
				? {
						masterRawMaterial: {
							is: masterRawMaterialWhere,
						},
					}
				: {}),

			receipt: {
				is: {
					deletedAt: null,

					...(unitId ? { unitId } : {}),

					...(startDate || endDate
						? {
								date: {
									...(startDate ? { gte: startDate } : {}),
									...(endDate ? { lte: endDate } : {}),
								},
							}
						: {}),
				},
			},
		};

		const [items, total] = await this.prisma.$transaction([
			this.prisma.rawMaterialReceiptItem.findMany({
				where: itemWhere,
				select: {
					masterRawMaterialId: true,
					nilaiSatuan: true,
					quantity: true,
					satuan: true,
					Total: true,

					masterRawMaterial: {
						select: {
							itemName: true,
							itemCode: true,
						},
					},

					receipt: {
						select: {
							documentCode: true,
							documentNo: true,
							date: true,
							unit: {
								select: {
									nama: true,
								},
							},
						},
					},
				},
				orderBy: [{ receipt: { date: 'desc' } }, { id: 'asc' }],
				skip: (currentPage - 1) * pageLimit,
				take: pageLimit,
			}),

			this.prisma.rawMaterialReceiptItem.count({
				where: itemWhere,
			}),
		]);

		if (items.length === 0) {
			return {
				data: [],
				totalData: total,
				page: currentPage,
				limit: pageLimit,
				totalPages: Math.ceil(total / pageLimit),
			};
		}

		const productIds = [...new Set(items.map((item) => item.masterRawMaterialId))];

		// Hitung stok aktif berdasarkan seluruh transaksi bahan mentah.
		const grouped = await this.prisma.inventoryTransactionBarangMentah.groupBy({
			by: ['productId', 'transactionType'],
			where: {
				productId: {
					in: productIds,
				},
				deletedAt: null,
			},
			_sum: {
				quantity: true,
			},
		});

		const stockMap = new Map<string, number>();

		for (const transaction of grouped) {
			const quantity = Number(transaction._sum.quantity ?? 0);

			const signedQuantity =
				transaction.transactionType === 'IN' ? quantity : transaction.transactionType === 'OUT' ? -quantity : 0;

			stockMap.set(transaction.productId, (stockMap.get(transaction.productId) ?? 0) + signedQuantity);
		}

		const data = items.map((item) => ({
			documentCode: item.receipt.documentCode,
			documentNo: item.receipt.documentNo,
			unit: item.receipt.unit?.nama ?? null,
			date: item.receipt.date,
			itemCode: item.masterRawMaterial?.itemCode ?? null,
			itemName: item.masterRawMaterial?.itemName ?? null,
			nilaiSatuan: item.nilaiSatuan,
			quantity: item.quantity,
			satuan: item.satuan,
			Total: item.Total,
			stockAfter: stockMap.get(item.masterRawMaterialId) ?? 0,
		}));

		return {
			data,
			totalData: total,
			page: currentPage,
			limit: pageLimit,
			totalPages: Math.ceil(total / pageLimit),
		};
	}
}

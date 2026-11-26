import { BadRequestException, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { DecodeTokenType } from '@src/modules/auth/authentikasi/authentikasi.controller';
import { PrismaService } from '@src/modules/common/prisma.service';
import { RawMaterialService } from '@src/modules/gudang/raw-material/raw-material.service';
import { ShareModuleService } from '@src/modules/share-module/share-module.service';
import { nowWIBString } from '@src/shared/utils/glolabalFunc';
import dayjs from 'dayjs';
import { CreateJurnalEntryDto } from './dto/create-jurnal-entry.dto';
import { GetJurnalEntryDto, GetJurnalEntryHeaderDto } from './dto/get-jurnal-entry.dto';
import { UpdateteJurnalEntryDto } from './dto/update-jurnal-entry.dto';

@Injectable({ scope: Scope.REQUEST })
export class JurnalEntryService {
	constructor(
		private readonly shareModuleService: ShareModuleService,
		private readonly prisma: PrismaService,
		private readonly rawMaterialService: RawMaterialService,
	) {}

	async createJournal(plus = 1) {
		const code = await this.shareModuleService.getNextCode('JournalEntry', 'numberJurnal', 'JRN', plus);
		return code;
	}
	async create(createJurnalEntryDto: CreateJurnalEntryDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(async (prismaTrans) => {
			const journalEntry = await prismaTrans.journalEntry.create({
				data: {
					date: createJurnalEntryDto.date,
					description: createJurnalEntryDto.description,
					referenceNumber: createJurnalEntryDto.referenceNumber,
					numberJurnal: createJurnalEntryDto.numberJurnal,
					createdBy: decoded.name || 'System',
					module: '-',
					staffId: decoded.id,
					unitId: createJurnalEntryDto.unitId,
					typeJournalEntry: createJurnalEntryDto.typeJournalEntry,
					currencyValue: createJurnalEntryDto.currencyValue,
					totalBalance: createJurnalEntryDto.totalBalance,
					totalBalanceUs: createJurnalEntryDto.totalBalanceUs || 0,
					details: {
						create: createJurnalEntryDto.details.map((items) => ({
							debit: items.debit || 0,
							accountCode: items.accountCode,
							credit: items.credit || 0,
							unitId: items.unitId,
							creditDollar: items.creditDollar || 0,
							debitDollar: items.debitDollar || 0,
							currencyValue: items.currencyValue,
						})), // Filter untuk mengabaikan entry kosong
					},
				},
			});
			return journalEntry;
		});
	}

	async findAllJurnalHeader(query: GetJurnalEntryHeaderDto, decoded: DecodeTokenType) {
		const {
			page = 1,
			limit = 10,
			createdBy,
			isGeneral,
			typeJournalEntry,
			IsNottypeJournalEntry,
			status,
			date,
			totalBalance,
			totalBalanceUs,
			periode,
			referenceNumber,
			numberJurnal,
			addjust,
		} = query;
		const skip = (page - 1) * limit;
		const take = +limit;

		const whereCondition: any = {
			deletedAt: null,
		};

		if (date) {
			const start = dayjs(date).startOf('day').toDate();
			const end = dayjs(date).endOf('day').toDate();

			whereCondition.date = {
				gte: start,
				lte: end,
			};
		}

		if (periode) {
			const start = dayjs(periode, 'YYYY-MM').startOf('month').toDate();
			const end = dayjs(periode, 'YYYY-MM').endOf('month').toDate();

			whereCondition.date = {
				gte: start,
				lte: end,
			};
		}

		if (totalBalance) {
			whereCondition.totalBalance = totalBalance;
		}

		if (totalBalanceUs) {
			whereCondition.totalBalanceUs = totalBalanceUs;
		}

		if (status) {
			whereCondition.status = status;
		}

		if (!(decoded.isRoot === 'Y' || decoded.isPusat)) {
			whereCondition.unitId = decoded.unitId;
		}

		if (createdBy) {
			whereCondition.createdBy = createdBy;
		}

		if (isGeneral) {
			whereCondition.createdBy = {
				not: 'System',
			};
		}

		if (typeJournalEntry) {
			whereCondition.typeJournalEntry = typeJournalEntry;
		}

		if (IsNottypeJournalEntry) {
			whereCondition.typeJournalEntry = {
				not: IsNottypeJournalEntry,
			};
		}

		if (referenceNumber) {
			whereCondition.referenceNumber = {
				contains: referenceNumber,
				mode: 'insensitive',
			};
		}
		if (numberJurnal) {
			whereCondition.numberJurnal = {
				contains: numberJurnal,
				mode: 'insensitive',
			};
		}

		if (addjust !== null) {
			whereCondition.addjust = addjust;
		}

		whereCondition.isRevert = 'N';

		// Jurnal Pengeluaran Barang (BPP) baru tampil di Jurnal setelah diposting dari menu Gudang
		// (CONFIRMED & belum isPosted = sudah pernah diposting lalu di-Revert dari Jurnal).
		whereCondition.AND = [{ OR: [{ rawMaterialIssueId: null }, { isPosted: true }, { status: 'CONFIRMED' }] }];

		const [data, totalData, postCount] = await this.prisma.$transaction([
			this.prisma.journalEntry.findMany({
				skip,
				take,
				where: whereCondition,
				// Tipe transaksi dipakai FE untuk teks konfirmasi hapus per tipe jurnal.
				include: { transaction: { select: { type: true, currency: true, isMaterial: true } } },
				orderBy: [{ isPosted: 'asc' }, { createdAt: 'desc' }],
			}),
			this.prisma.journalEntry.count({ where: whereCondition }),
			this.prisma.journalEntry.count({
				where: { ...whereCondition, isPosted: false },
			}),
		]);

		return {
			data,
			page: +page,
			limit: +limit,
			totalData,
			totalPages: Math.ceil(totalData / +limit),
			postCount: postCount,
		};
	}

	async findAll(query: GetJurnalEntryDto, decoded: DecodeTokenType) {
		const {
			page = 1,
			limit = 10,
			startDate,
			endDate,
			accountCode,
			description,
			jenisJurnal,
			referenceNumber,
			numberJurnal,
			isDownload,
			typeJournalEntry,
			IsNottypeJournalEntry,
			periode,
			isPosted,
			totalBalance,
			date,
			status,
			unitId,
		} = query;
		const whereCondition: any = {};
		// Jurnal Pengeluaran Barang (BPP) baru tampil di Jurnal setelah diposting dari menu Gudang
		// (CONFIRMED & belum isPosted = sudah pernah diposting lalu di-Revert dari Jurnal).
		whereCondition.AND = [{ OR: [{ rawMaterialIssueId: null }, { isPosted: true }, { status: 'CONFIRMED' }] }];

		if (periode) {
			const [year, month] = periode.split('-').map(Number);
			const start = new Date(year, month - 1, 1);
			const end = new Date(year, month, 0, 23, 59, 59);
			whereCondition.date = {
				gte: start, // Greater than or equal to startDate
				lte: end, // Less than or equal to endDate
			};
		}

		if (date) {
			const start = dayjs(date).startOf('day').toDate();
			const end = dayjs(date).endOf('day').toDate();

			whereCondition.date = {
				gte: start,
				lte: end,
			};
		}

		if (totalBalance) {
			whereCondition.totalBalance = totalBalance;
		}

		if (status) {
			whereCondition.status = status;
		}

		if (unitId) {
			whereCondition.unitId = unitId;
		}

		if (isPosted === 'YES') {
			whereCondition.isPosted = true;
		}

		if (description) {
			whereCondition.description = {
				contains: description,
				mode: 'insensitive',
			};
		}

		if (numberJurnal) {
			whereCondition.numberJurnal = {
				contains: numberJurnal,
				mode: 'insensitive',
			};
		}

		if (referenceNumber) {
			whereCondition.referenceNumber = {
				contains: referenceNumber,
				mode: 'insensitive',
			};
		}

		if (startDate && endDate) {
			whereCondition.createdAt = {
				gte: startDate, // Greater than or equal to startDate
				lte: endDate, // Less than or equal to endDate
			};
		}

		if (accountCode) {
			whereCondition.details = {
				some: {
					accountCode: accountCode, // Filter by accountCode in JournalEntryDetail
				},
			};
		}

		if (typeJournalEntry) {
			whereCondition.typeJournalEntry = typeJournalEntry;
		}

		if (IsNottypeJournalEntry) {
			whereCondition.typeJournalEntry = {
				not: IsNottypeJournalEntry,
			};
		}

		if (jenisJurnal === 'penjualan') {
			whereCondition.transactionId = {
				equals: null,
			};

			const jurnalPenjualan = await this.prisma.journalEntry.findMany({
				where: whereCondition,
				include: {
					spb: true,
					unit: true,
					transactionReceiptId: {
						include: {
							unit: true,
							items: true,
							supplier: true,
						},
					},
					details: {
						include: {
							account: true,
						},
					},
				},
				orderBy: {
					date: 'desc',
				},
			});

			const pageNumber = +page || 1;
			const pageSize = +limit || 10;

			const startIndex = (pageNumber - 1) * pageSize;
			const endIndex = startIndex + pageSize;

			const jurnalPenjualanData = jurnalPenjualan
				.map((journal) => {
					return journal.details.map((d) => ({
						referenceNumber: journal?.referenceNumber || '-',
						numberJurnal: journal.numberJurnal || '-',
						journalId: journal.id || '-',
						date: journal.date || '-',
						description: journal?.description || '-',
						accountCode: d.accountCode,
						accountName: d.account.name,
						debit: d.debit ?? 0,
						credit: d.credit ?? 0,
						kodeAccount: d.account?.code,
						creditDollar: d.creditDollar,
						debitDollar: d.debitDollar,
						supplier: journal.rawMaterialReceiptId,
						spb: journal.spb,
						transaction: journal.transactionReceiptId,
						unit: journal.unit,
					}));
				})
				.flat();

			const paginatedData = jurnalPenjualanData.slice(startIndex, endIndex);

			const { totalDebit, totalCredit } = paginatedData.reduce(
				(acc, curr) => {
					acc.totalDebit += Number(curr.debit);
					acc.totalCredit += Number(curr.credit);
					return acc;
				},
				{ totalDebit: 0, totalCredit: 0 },
			);

			if (isDownload) {
				const { totalDebit, totalCredit } = jurnalPenjualanData.reduce(
					(acc, curr) => {
						acc.totalDebit += Number(curr.debit);
						acc.totalCredit += Number(curr.credit);
						return acc;
					},
					{ totalDebit: 0, totalCredit: 0 },
				);

				return {
					data: jurnalPenjualanData,
					totalData: jurnalPenjualanData.length,
					totalDebit,
					totalCredit,
				};
			} else {
				return {
					data: paginatedData,
					page: +page,
					limit: +limit,
					totalData: jurnalPenjualanData.length,
					totalPages: Math.ceil(paginatedData.length / +limit),
					totalDebit,
					totalCredit,
				};
			}
		}

		if (jenisJurnal === 'penerimaan') {
			whereCondition.transactionId = {
				not: null,
			};

			const jurnalPembayaran = await this.prisma.journalEntry.findMany({
				where: whereCondition,
				include: {
					// bank_account: true,
					spb: true,
					unit: true,
					transactionReceiptId: {
						include: {
							unit: true,
							items: true,
							supplier: true,
						},
					},
					details: {
						include: {
							account: true,
						},
					},
				},
				orderBy: {
					date: 'asc',
				},
			});

			const pageNumber = +page || 1;
			const pageSize = +limit || 10;

			const startIndex = (pageNumber - 1) * pageSize;
			const endIndex = startIndex + pageSize;

			const jurnalPembayaranData = jurnalPembayaran
				.map((journal) => {
					return journal.details.map((d) => ({
						referenceNumber: journal?.referenceNumber || '-',
						numberJurnal: journal.numberJurnal || '-',
						journalId: journal.id || '-',
						date: journal.date || '-',
						description: journal.description || '-',
						accountCode: d.accountCode,
						accountName: d.account.name,
						debit: d.debit ?? 0,
						credit: d.credit ?? 0,
						kodeAccount: d.account?.code,
						creditDollar: d.creditDollar,
						debitDollar: d.debitDollar,
						supplier: journal.rawMaterialReceiptId,
						spb: journal.spb,
						transaction: journal.transactionReceiptId,
						unit: journal.unit,
					}));
				})
				.flat();

			const paginatedData = jurnalPembayaranData.slice(startIndex, endIndex);

			if (isDownload) {
				const { totalDebit, totalCredit } = jurnalPembayaranData.reduce(
					(acc, curr) => {
						acc.totalDebit += Number(curr.debit);
						acc.totalCredit += Number(curr.credit);
						return acc;
					},
					{ totalDebit: 0, totalCredit: 0 },
				);

				return {
					data: jurnalPembayaranData,
					totalData: jurnalPembayaranData.length,
					totalDebit,
					totalCredit,
				};
			} else {
				const { totalDebit, totalCredit } = paginatedData.reduce(
					(acc, curr) => {
						acc.totalDebit += Number(curr.debit);
						acc.totalCredit += Number(curr.credit);
						return acc;
					},
					{ totalDebit: 0, totalCredit: 0 },
				);

				return {
					data: paginatedData,
					page: +page,
					limit: +limit,
					totalData: jurnalPembayaranData.length,
					totalPages: Math.ceil(paginatedData.length / +limit),
					totalDebit,
					totalCredit,
				};
			}
		}
		const jurnalAll = await this.prisma.journalEntry.findMany({
			where: { ...whereCondition, isRevert: 'N' },
			include: {
				spb: true,
				unit: true,
				transactionIssueId: {
					include: {
						items: true,
					},
				},
				transactionReceiptId: {
					include: {
						unit: true,
						items: true,
						supplier: true,
					},
				},
				details: {
					include: {
						account: true,
					},
				},
			},
			orderBy: {
				date: 'asc',
			},
		});

		const jurnalAllData = jurnalAll
			.map((journal) => {
				return journal.details.map((d) => ({
					referenceNumber: journal?.referenceNumber || '-',
					numberJurnal: journal.numberJurnal || '-',
					journalId: journal.id || '-',
					date: journal.date || '-',
					description: d?.description || '-',
					accountCode: d.accountCode,
					accountName: d.account.name,
					debit: d.debit ?? 0,
					fisikWarehouseIssue: journal.transactionIssueId?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0,
					fisikWarehouseReceipt: journal.transactionReceiptId?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0,
					credit: d.credit ?? 0,
					kodeAccount: d.account?.code,
					creditDollar: d.creditDollar,
					debitDollar: d.debitDollar,
					supplier: journal.rawMaterialReceiptId,
					spb: journal.spb,
					transaction: journal.transactionReceiptId,
					unit: journal.unit,
				}));
			})
			.flat();

		const mergeData = jurnalAllData;
		const pageNumber = +page || 1;
		const pageSize = +limit || 10;

		const startIndex = (pageNumber - 1) * pageSize;
		const endIndex = startIndex + pageSize;

		const paginatedData = mergeData.slice(startIndex, endIndex);

		// Hitung total debit dan credit (semua data, bukan hanya yang ditampilkan)
		if (isDownload) {
			const { totalDebit, totalCredit } = mergeData.reduce(
				(acc, curr) => {
					acc.totalDebit = Number(acc.totalDebit) + Number(curr.debit);
					acc.totalCredit += Number(curr.credit);
					return acc;
				},
				{ totalDebit: 0, totalCredit: 0 },
			);

			return {
				data: mergeData,
				totalData: mergeData.length,
				totalDebit,
				totalCredit,
			};
		} else {
			const { totalDebit, totalCredit } = paginatedData.reduce(
				(acc, curr) => {
					acc.totalDebit += Number(curr.debit);
					acc.totalCredit += Number(curr.credit);
					return acc;
				},
				{ totalDebit: 0, totalCredit: 0 },
			);

			return {
				data: paginatedData, // hanya data halaman saat ini
				page: pageNumber,
				limit: pageSize,
				totalData: mergeData.length,
				totalPages: Math.ceil(mergeData.length / pageSize),
				totalDebit,
				totalCredit,
			};
		}
	}

	findOne(id: string) {
		return this.prisma.journalEntry.findUnique({
			include: {
				transaction: {
					include: {
						cashBankTransactionDetails: true,
						bank_account: true,
					},
				},
				JournalAdjustmentSuggestion: true,

				transactionIssueId: {
					include: {
						items: {
							include: {
								masterRawMaterial: true,
							},
						},
					},
				},
				transactionReceiptId: {
					include: {
						items: {
							include: {
								masterRawMaterial: true,
							},
						},
						supplier: true,
					},
				},
				spb: {
					include: {
						invoice: {
							include: {
								invoiceTaxes: true,
							},
						},
						itemsSPB: true,
						purchaseOrder: {
							include: {
								customer: true,
								items: true,
							},
						},
					},
				},
				unit: true,
				details: {
					include: {
						account: true,
					},
				},
			},
			where: {
				id: id,
			},
		});
	}

	async update(journalEntryId: string, updateJurnalEntryDto: UpdateteJurnalEntryDto) {
		try {
			return this.prisma.$transaction(async (tx) => {
				// Jurnal yang sudah diposting tidak boleh diubah, Revert dulu.
				const current = await tx.journalEntry.findFirst({
					where: { id: journalEntryId, deletedAt: null },
					select: { isPosted: true },
				});
				if (!current) {
					throw new NotFoundException('Jurnal tidak ditemukan');
				}
				if (current.isPosted) {
					throw new BadRequestException('Jurnal sudah diposting, tidak dapat diubah. Revert dulu.');
				}

				await tx.journalEntry.update({
					where: {
						id: journalEntryId,
					},
					data: {
						date: updateJurnalEntryDto.date,
						description: updateJurnalEntryDto.description,
						addjust: true,
						referenceNumber: updateJurnalEntryDto.referenceNumber,
						numberJurnal: updateJurnalEntryDto.numberJurnal,
						module: '-',
						unitId: updateJurnalEntryDto.unitId,
						currencyValue: updateJurnalEntryDto.currencyValue,
						totalBalance: updateJurnalEntryDto.totalBalance,
						totalBalanceUs: updateJurnalEntryDto.totalBalanceUs || 0,
						status: 'DRAFT',
						purposeTransaction: updateJurnalEntryDto.purposeTransaction || '-',
					},
				});
				// 3. Delete removed entries
				const existing = await tx.journalEntryDetail.findMany({
					where: { journalEntryId },
				});

				const incomingIds = updateJurnalEntryDto.details.filter((e) => e.id).map((e) => e.id);
				const idsToDelete = existing.filter((entry) => !incomingIds.includes(entry.id)).map((entry) => entry.id);

				if (idsToDelete.length > 0) {
					await tx.journalEntryDetail.deleteMany({
						where: { id: { in: idsToDelete } },
					});
				}

				// 1. Update existing
				await Promise.all(
					updateJurnalEntryDto.details
						.filter((e) => e.id)
						.map((entry) =>
							tx.journalEntryDetail.update({
								where: { id: entry.id },
								data: {
									accountCode: entry.accountCode,
									description: entry.description || '-',
									debit: entry.debit,
									credit: entry.credit,
									unitId: entry.unitId,
									debitDollar: entry.debitDollar,
									creditDollar: entry.creditDollar,
								},
							}),
						),
				);

				await Promise.all(
					updateJurnalEntryDto.details
						.filter((e) => !e.id)
						.map((entry) =>
							tx.journalEntryDetail.createMany({
								data: {
									journalEntryId: journalEntryId, // Ensure to include journalEntryId
									accountCode: entry.accountCode,
									description: entry.description || '-',
									debit: entry.debit,
									credit: entry.credit,
									unitId: entry.unitId,
									debitDollar: entry.debitDollar,
									creditDollar: entry.creditDollar,
								},
							}),
						),
				);

				// // 2. Create new
				// const toCreate = updateJurnalEntryDto.details.filter((e) => e.id === null);
				// if (toCreate.length > 0) {
				// 	await tx.journalEntryDetail.createMany({
				// 		data: toCreate.map((entry) => ({
				// 			journalEntryId: journalEntryId, // Ensure to include journalEntryId
				// 			accountCode: entry.accountCode,
				// 			debit: entry.debit,
				// 			credit: entry.credit,
				// 			unitId: entry.unitId,
				// 			debitDollar: entry.debitDollar,
				// 			creditDollar: entry.creditDollar,
				// 		})),
				// 	});
				// }

				return { message: 'Journal entries synced successfully' };
			});
		} catch (e) {
			return e;
		}
	}

	async remove(id: string, decoded: DecodeTokenType) {
		// Jurnal Gudang (BPP/BPB) yang sudah di-Revert dari Jurnal (isPosted=false, CONFIRMED):
		// Hapus = balik stok & status dokumen Gudang (buku besar sudah dibalik saat Revert),
		// jurnal berstatus CANCELLED sehingga hilang dari Jurnal dan tombol di Gudang aktif lagi.
		const warehouseJournal = await this.prisma.journalEntry.findFirst({
			where: { id, deletedAt: null },
			select: { isPosted: true, status: true, isRevert: true, rawMaterialIssueId: true, rawMaterialReceiptId: true },
		});
		if (warehouseJournal?.rawMaterialIssueId || warehouseJournal?.rawMaterialReceiptId) {
			if (warehouseJournal.isPosted) {
				throw new BadRequestException('Jurnal sudah diposting, tidak dapat dihapus. Revert dulu.');
			}
			if (warehouseJournal.status !== 'CONFIRMED' || warehouseJournal.isRevert !== 'N') {
				throw new BadRequestException('Jurnal ini belum diposting dari Gudang atau sudah di-Revert.');
			}
			return warehouseJournal.rawMaterialIssueId
				? this.rawMaterialService.revertIssue(warehouseJournal.rawMaterialIssueId, decoded, { glAlreadyReverted: true })
				: this.rawMaterialService.revertReceipt(warehouseJournal.rawMaterialReceiptId, decoded, { glAlreadyReverted: true });
		}

		return this.prisma.$transaction(async (tx) => {
			// ---- SYARAT HAPUS: jurnal ada dan belum diposting (DRAFT atau sudah di-Revert) ----
			const target = await tx.journalEntry.findFirst({
				where: { id, deletedAt: null },
				select: { isPosted: true },
			});
			if (!target) {
				throw new NotFoundException('Jurnal tidak ditemukan');
			}
			if (target.isPosted) {
				throw new BadRequestException('Jurnal sudah diposting, tidak dapat dihapus. Revert dulu.');
			}

			// ---- DELETE DETAIL CHILD ----
			const journal = await tx.journalEntry.findMany({
				where: { journalEntryId: id, deletedAt: null },
			});
			if (journal.some((item) => item.isPosted)) {
				throw new BadRequestException('Jurnal turunan sudah diposting, tidak dapat dihapus. Revert dulu.');
			}

			// ---- SARAN PENYESUAIAN (tanpa deletedAt, dihapus permanen) ----
			await tx.journalAdjustmentSuggestion.deleteMany({
				where: { journalEntryId: { in: [id, ...journal.map((item) => item.id)] } },
			});

			for (const item of journal) {
				await tx.journalEntryDetail.updateMany({
					where: { journalEntryId: item.id },
					data: {
						deletedAt: nowWIBString(),
					},
				});
			}

			// ---- DELETE DETAIL PARENT ----
			await tx.journalEntryDetail.updateMany({
				where: { journalEntryId: id },
				data: {
					deletedAt: nowWIBString(),
				},
			});

			// ---- UPDATE PARENT ----
			await tx.journalEntry.update({
				where: { id },
				data: {
					numberJurnal: crypto.randomUUID(), // GENERATE BARU
					deletedAt: nowWIBString(),
				},
			});

			// ---- UPDATE CHILD ----
			for (const item of journal) {
				await tx.journalEntry.update({
					where: { id: item.id },
					data: {
						numberJurnal: crypto.randomUUID(), // GENERATE BARU JUGA
						deletedAt: nowWIBString(),
					},
				});
			}
		});
	}

	private getPeriod(date: string): string {
		const d = new Date(date);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	}
}

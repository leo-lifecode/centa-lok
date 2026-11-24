import { BadRequestException, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { Module, TransactionTypeMapping } from '@prisma/client';
import { HelperGlobal } from '@src/common/utils/helper/helper';
import { DecodeTokenType } from '@src/modules/auth/authentikasi/authentikasi.controller';
import { PrismaService } from '@src/modules/common/prisma.service';
import { ShareModuleService } from '@src/modules/share-module/share-module.service';
import { nowWIB, nowWIBString } from '@src/shared/utils/glolabalFunc';
import dayjs from 'dayjs';
import { CreateSpbDto } from './dto/create-spb.dto';
import { GetSpbsDto } from './dto/get-spb.dto';
import { UpdateSpbDto } from './dto/update-spb.dto';
@Injectable({ scope: Scope.REQUEST })
export class SpbsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly helperGlobal: HelperGlobal,
		private readonly shareModuleService: ShareModuleService,
	) {}

	async createJournal(plus = 1) {
		const code = await this.shareModuleService.getNextCode('JournalEntry', 'numberJurnal', 'JRN', plus);
		return code;
	}

	createRa(createSpbDto: CreateSpbDto) {
		return this.prisma.$transaction(
			async (tx) => {
				const stockLogEkspek = await tx.purchaseOrder.findUnique({
					where: {
						id: createSpbDto.purchaseOrderId,
					},
					include: {
						items: true,
					},
				});

				if (!stockLogEkspek) {
					throw new Error('Purchase Order tidak ditemukan');
				}

				const deliveryOrder = await tx.deliveryOrder.findUnique({
					where: {
						id: createSpbDto.deliveryOrderId,
					},
					include: {
						DeliveryOrderDetail: {
							where: {
								deletedAt: null,
							},
						},
					},
				});

				if (!deliveryOrder) {
					throw new Error('Delivery Order tidak ditemukan');
				}

				if (deliveryOrder.purchaseOrderId !== createSpbDto.purchaseOrderId) {
					throw new Error('Delivery Order tidak sesuai dengan Purchase Order');
				}

				const deliveryOrderDetails = deliveryOrder.DeliveryOrderDetail;

				if (!deliveryOrderDetails.length) {
					throw new Error('Detail Delivery Order tidak ditemukan');
				}

				const doQtyByDetail = new Map<string, number>();

				const doDetailById = new Map(deliveryOrderDetails.map((item) => [item.id, item]));

				for (const item of deliveryOrderDetails) {
					doQtyByDetail.set(item.id, Number(item.qtyKirim || 0));
				}

				const previousStockLogs = await tx.itemsSPB.findMany({
					where: {
						spb: {
							deliveryOrderId: createSpbDto.deliveryOrderId,
							typeSalesSPb: 'RA',
							deletedAt: null,
						},
						deletedAt: null,
					},
					select: {
						productId: true,
						deliveryOrderDetailId: true,
						qtyKirim: true,
					},
				});

				const previousQtyByDetail = new Map<string, number>();

				for (const item of previousStockLogs) {
					const detailId = item.deliveryOrderDetailId;

					if (!detailId) continue;

					const currentQty = previousQtyByDetail.get(detailId) || 0;

					previousQtyByDetail.set(detailId, currentQty + Number(item.qtyKirim || 0));
				}

				const currentQtyByDetail = new Map<string, number>();

				for (const item of createSpbDto.stockLogs) {
					const qtyKirim = Number(item.qtyKirim || 0);

					if (qtyKirim <= 0) {
						throw new BadRequestException(`Qty Kirim product ${item.productId} harus lebih dari 0`);
					}

					const detailId = item.deliveryOrderDetailId;

					if (!detailId) {
						throw new BadRequestException(`Detail Delivery Order untuk product ${item.productId} wajib diisi`);
					}

					const doDetail = doDetailById.get(detailId);

					if (!doDetail) {
						throw new BadRequestException(`Detail Delivery Order ${detailId} tidak ditemukan`);
					}

					if (doDetail.productId !== item.productId) {
						throw new BadRequestException('Product tidak sesuai dengan detail Delivery Order');
					}

					const currentQty = currentQtyByDetail.get(detailId) || 0;

					currentQtyByDetail.set(detailId, currentQty + qtyKirim);
				}

				for (const [detailId, currentQtyKirim] of currentQtyByDetail) {
					const totalQtyDO = doQtyByDetail.get(detailId) || 0;

					const totalQtyPrevious = previousQtyByDetail.get(detailId) || 0;

					const sisaQty = totalQtyDO - totalQtyPrevious;

					if (sisaQty <= 0) {
						throw new BadRequestException(`Qty Kirim detail ${detailId} pada Delivery Order sudah habis`);
					}

					if (currentQtyKirim > sisaQty) {
						throw new BadRequestException(`Qty Kirim melebihi sisa quantity Delivery Order. Sisa quantity: ${sisaQty}`);
					}
				}

				const dataSpb = await tx.sPB.create({
					data: {
						purchaseOrderId: createSpbDto.purchaseOrderId,
						deliveryOrderId: createSpbDto.deliveryOrderId,
						noSpb: createSpbDto.noSpb,
						orderNumber: createSpbDto.orderNumber,
						date: createSpbDto.date,
						description: createSpbDto.description,
						franco: createSpbDto.franco,
						customerName: createSpbDto.customerName,
						subtotalAmount: createSpbDto.subtotalAmount,
						tanggalPengiriman: createSpbDto.tanggalPengiriman,
						isComplete: 'YES',
						staffId: stockLogEkspek.staffId,
						typeSalesSPb: createSpbDto.typeSalesSPb,
						unitId: stockLogEkspek.unitId,

						itemsSPB: {
							create: createSpbDto.stockLogs.map((item) => {
								const deliveryOrderDetail = doDetailById.get(item.deliveryOrderDetailId as string);

								if (!deliveryOrderDetail) {
									throw new Error(`Detail Delivery Order untuk product ${item.productId} tidak ditemukan`);
								}

								return {
									customerName: createSpbDto.customerName,
									productId: item.productId,
									deliveryOrderDetailId: deliveryOrderDetail.id,
									date: stockLogEkspek.date,
									quantity: +item.quantity,
									qtyKirim: item.qtyKirim,
									stockProduct: +item.stockProduct,
									priceProduct: +item.priceProduct,
									kodeBarangProduct: item.kodeBarangProduct,
									namabarangProduct: item.namabarangProduct,
									spesifikasiProduct: item.spesifikasiProduct,
									beratproduct: +item.beratproduct,
									kategoriProduct: item.kategoriProduct,
									satuanProduct: item.satuanProduct,
									unitProduct: item.unitProduct,
									total: +item.total,
									namabarangProductInvoice: item.namabarangProductInvoice,
									orderNumber: createSpbDto.orderNumber,
									typeSalesSPb: createSpbDto.typeSalesSPb,
									namaAtasan: createSpbDto.namaAtasan,
									jabatanAtasan: createSpbDto.jabatanAtasan,
									dikirimDengan: createSpbDto.dikirimDengan,
								};
							}),
						},
					},
				});

				await tx.purchaseOrder.update({
					where: {
						id: createSpbDto.purchaseOrderId,
					},
					data: {
						invoiceSelectionStatus: 'NOT_SELECTED',
					},
				});

				await tx.inventoryTransaction.createMany({
					data: createSpbDto.stockLogs.map((item) => ({
						source: 'penjualan',
						sourceId: dataSpb.id,
						quantity: item.qtyKirim,
						transactionType: 'OUT',
						productId: item.productId,
						satuan: item.satuanProduct,
						nilaiSatuan: item.nilaiSatuan,
						unitId: stockLogEkspek.unitId,
					})),
				});

				let isAllQuantityComplete = true;

				for (const [detailId, totalQtyDO] of doQtyByDetail) {
					const totalQtyPrevious = previousQtyByDetail.get(detailId) || 0;

					const totalQtyCurrent = currentQtyByDetail.get(detailId) || 0;

					const totalQtyKirim = totalQtyPrevious + totalQtyCurrent;

					if (totalQtyKirim < totalQtyDO) {
						isAllQuantityComplete = false;
						break;
					}
				}

				if (isAllQuantityComplete) {
					await tx.deliveryOrder.update({
						where: {
							id: createSpbDto.deliveryOrderId,
						},
						data: {
							selectionStatus: 'SELECTED',
						},
					});
				}

				return {
					dataSpb,
					message: 'SPB RA berhasil dibuat',
				};
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	createRnEkspor(createSpbDto: CreateSpbDto, dataUser: DecodeTokenType) {
		return this.prisma.$transaction(async (tx) => {
			const stockLogEkspek = await tx.purchaseOrder.findUnique({
				where: {
					id: createSpbDto.purchaseOrderId,
				},
			});
			await tx.inventoryTransaction.createMany({
				data: createSpbDto.stockLogs.map((item) => ({
					source: 'penjualan',
					quantity: item.quantity,
					transactionType: 'OUT',
					productId: item.productId,
					satuan: item.satuanProduct,
					nilaiSatuan: item.nilaiSatuan,
					unitId: stockLogEkspek.unitId,
				})),
			});

			//generate invoice
			const currentDate = nowWIB();
			const year = currentDate.getFullYear().toString();
			const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
			const countDataInv = await tx.invoice.count({
				where: {
					createdAt: {
						gte: new Date(`${year}-${month}-01T00:00:00Z`),
						lt: new Date(
							new Date(`${year}-${month}-01T00:00:00Z`).setMonth(new Date(`${year}-${month}-01T00:00:00Z`).getMonth() + 1),
						),
					},
					typeInvoice: 'RN_EKSPOR',
				},
			});
			const nextIdInv = countDataInv + 1;
			const invoiceNumber = `INV/${createSpbDto.typeSalesSPb}/${month}/${year}/${String(nextIdInv).padStart(4, '0')}`;
			const data = await tx.purchaseOrderTax.findMany({
				where: {
					purchaseOrderId: createSpbDto.purchaseOrderId,
				},
			});
			const invoiceTaxesData = data.map((item) => ({
				isIncludedInPrice: false,
				withheldByCustomer: false,
				taxType: item.taxType,
				taxAmount: item.taxAmount,
				taxValue: item.taxValue,
				taxId: item.taxId,
			}));

			const dataSpb = await tx.sPB.create({
				data: {
					purchaseOrderId: createSpbDto.purchaseOrderId,
					noSpb: createSpbDto.noSpb,
					orderNumber: createSpbDto.orderNumber,
					date: createSpbDto.date,
					description: createSpbDto.description,
					franco: createSpbDto.franco,
					customerName: createSpbDto.customerName,
					subtotalAmount: createSpbDto.subtotalAmount,
					tanggalPengiriman: createSpbDto.tanggalPengiriman,
					isComplete: 'YES',
					staffId: dataUser.id,
					typeSalesSPb: createSpbDto.typeSalesSPb,
					unitId: stockLogEkspek.unitId,
					invoice: {
						create: {
							amountWithTax: Number(stockLogEkspek.totalAmount) || stockLogEkspek.subtotalAmount,
							totalAmount: stockLogEkspek.subtotalAmount,
							invoiceNumber: invoiceNumber,
							invoiceDate: nowWIBString(),
							typeInvoice: 'RN_EKSPOR',
							paymentDate: null,
							invoiceTaxes: {
								create: invoiceTaxesData,
							},
						},
					},
					itemsSPB: {
						create: createSpbDto.stockLogs.map((item) => ({
							customerName: createSpbDto.customerName,
							productId: item.productId,
							date: stockLogEkspek.date,
							quantity: +item.quantity,
							stockProduct: +item.stockProduct,
							priceProduct: +item.priceProduct,
							kodeBarangProduct: item.kodeBarangProduct,
							namabarangProduct: item.namabarangProduct,
							spesifikasiProduct: item.spesifikasiProduct,
							beratproduct: +item.beratproduct,
							kategoriProduct: item.kategoriProduct,
							satuanProduct: item.satuanProduct,
							unitProduct: item.unitProduct,
							total: +item.total,
							namabarangProductInvoice: item.namabarangProductInvoice,
							orderNumber: createSpbDto.orderNumber,
							typeSalesSPb: createSpbDto.typeSalesSPb,
							namaAtasan: createSpbDto.namaAtasan,
							jabatanAtasan: createSpbDto.jabatanAtasan,
							dikirimDengan: createSpbDto.dikirimDengan,
						})),
					},
				},
			});
			const numberJurnal = await this.createJournal();

			const journalEntries = await this.helperGlobal.generateJournalEntriesFromMappingDollar({
				module: Module.SALES,
				transactionType: TransactionTypeMapping.INVOICE,
				baseAmountDebit: createSpbDto.subtotalAmount,
				baseAmountCredit: createSpbDto.subtotalAmount,
				additional: [],
				unitId: stockLogEkspek.unitId,
			});

			await tx.journalEntry.create({
				data: {
					date: createSpbDto.date,
					numberJurnal: numberJurnal,
					referenceNumber: createSpbDto.noSpb,
					description: `Penjualan Barang (RN Ekspor) ke ${dataSpb.customerName}`,
					module: 'SALES',
					createdBy: 'System',
					staffId: dataUser.id,
					unitId: dataUser.unitId,
					typeJournalEntry: 'RN_EKSPOR',
					spbId: dataSpb.id,
					totalBalance: 0,
					totalBalanceUs: journalEntries[0]?.debitDollar,
					details: {
						createMany: {
							data: journalEntries,
						},
					},
				},
			});

			await tx.deliveryOrder.update({
				where: {
					id: createSpbDto.deliveryOrderId,
				},
				data: {
					selectionStatus: 'SELECTED',
				},
			});

			return {
				dataSpb,
			};
		});
	}

	createRN(createSpbDto: CreateSpbDto, staffId: string) {
		return this.prisma.$transaction(async (tx) => {
			const stockLogEkspek = await tx.purchaseOrder.findUnique({
				where: {
					id: createSpbDto.purchaseOrderId,
				},
				include: {
					items: true,
				},
			});

			await tx.inventoryTransaction.createMany({
				data: createSpbDto.stockLogs.map((item) => ({
					source: 'penjualan',
					quantity: item.quantity,
					transactionType: 'OUT',
					productId: item.productId,
					satuan: item.satuanProduct,
					nilaiSatuan: item.nilaiSatuan,
					unitId: stockLogEkspek.unitId,
				})),
			});

			const data = await tx.purchaseOrderTax.findMany({
				where: {
					purchaseOrderId: createSpbDto.purchaseOrderId,
				},
			});

			const numberJurnal = await this.createJournal();
			const taxLabels = data.map((t) => t.taxType);

			const taxes = await tx.tax.findMany({
				where: { taxType: { in: taxLabels } },
			});

			const additional = taxes.map((tax) => ({
				usage: 'ppn',
				amount: stockLogEkspek.subtotalAmount * tax.taxValue,
			}));

			const journalEntries = await this.helperGlobal.generateJournalEntriesFromMappingV2({
				module: Module.SALES,
				transactionType: TransactionTypeMapping.INVOICE,
				baseAmountDebit: Number(stockLogEkspek.totalAmount) || 0,
				baseAmountCredit: stockLogEkspek.subtotalAmount || 0,
				// additional: [{ usage: 'ppn', position: 'CREDIT', amount: totalPPN }],
				additional: additional,
				unitId: stockLogEkspek.unitId,
			});

			//input barang dikirim
			const dataSpb = await tx.sPB.create({
				data: {
					purchaseOrderId: createSpbDto.purchaseOrderId,
					noSpb: createSpbDto.noSpb,
					orderNumber: createSpbDto.orderNumber,
					date: createSpbDto.date,
					description: createSpbDto.description,
					franco: createSpbDto.franco,
					customerName: createSpbDto.customerName,
					subtotalAmount: createSpbDto.subtotalAmount,
					tanggalPengiriman: createSpbDto.tanggalPengiriman,
					isComplete: 'YES',
					typeSalesSPb: createSpbDto.typeSalesSPb,
					taxAmount: stockLogEkspek.taxAmount,
					totalAmount: stockLogEkspek.totalAmount,
					isCekPajak: true,
					staffId: stockLogEkspek.staffId,
					unitId: stockLogEkspek.unitId,
					itemsSPB: {
						create: createSpbDto.stockLogs.map((item) => ({
							customerName: createSpbDto.customerName,
							productId: item.productId,
							date: stockLogEkspek.date,
							quantity: +item.quantity,
							stockProduct: +item.stockProduct,
							priceProduct: +item.priceProduct,
							kodeBarangProduct: item.kodeBarangProduct,
							namabarangProduct: item.namabarangProduct,
							spesifikasiProduct: item.spesifikasiProduct,
							beratproduct: +item.beratproduct,
							kategoriProduct: item.kategoriProduct,
							satuanProduct: item.satuanProduct,
							unitProduct: item.unitProduct,
							total: +item.total,
							namabarangProductInvoice: item.namabarangProductInvoice,
							orderNumber: createSpbDto.orderNumber,
							typeSalesSPb: createSpbDto.typeSalesSPb,
							isCekPajak: true,
							namaAtasan: createSpbDto.namaAtasan,
							jabatanAtasan: createSpbDto.jabatanAtasan,
							dikirimDengan: createSpbDto.dikirimDengan,
						})),
					},
					journalEntry: {
						create: {
							date: createSpbDto.date,
							numberJurnal: numberJurnal,
							referenceNumber: createSpbDto.noSpb,
							description: `Penjualan Barang (RN LOKAL) ke ${createSpbDto.customerName}`,
							module: 'SALES',
							createdBy: 'System',
							typeJournalEntry: 'RN',
							staffId,
							totalBalance: journalEntries[0]?.debit,
							totalBalanceUs: 0,
							unitId: stockLogEkspek.unitId,
							details: {
								create: journalEntries,
							},
						},
					},
				},
			});

			await tx.sPBTax.createMany({
				data: data.map((tax) => ({
					spbId: dataSpb.id,
					taxId: tax.taxId,
					taxType: tax.taxType,
					taxValue: tax.taxValue,
					taxAmount: tax.taxAmount,
				})),
			});

			//generate invoice
			const currentDate = nowWIB();
			const year = currentDate.getFullYear().toString();
			const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
			const countDataInv = await tx.invoice.count({
				where: {
					createdAt: {
						gte: new Date(`${year}-${month}-01T00:00:00Z`),
						lt: new Date(
							new Date(`${year}-${month}-01T00:00:00Z`).setMonth(new Date(`${year}-${month}-01T00:00:00Z`).getMonth() + 1),
						),
					},
					typeInvoice: 'RN',
				},
			});
			const nextIdInv = countDataInv + 1;
			const invoiceNumber = `INV/${createSpbDto.typeSalesSPb}/${month}/${year}/${String(nextIdInv).padStart(4, '0')}`;

			const invoiceTaxesData = data.map((item) => ({
				isIncludedInPrice: false,
				withheldByCustomer: false,
				taxType: item.taxType,
				taxAmount: item.taxAmount,
				taxValue: item.taxValue,
				taxId: item.taxId,
			}));

			await tx.invoice.create({
				data: {
					spbId: dataSpb.id,
					amountWithTax: Number(stockLogEkspek.totalAmount),
					totalAmount: stockLogEkspek.subtotalAmount,
					invoiceNumber: invoiceNumber,
					invoiceDate: nowWIBString(),
					typeInvoice: 'RN',
					masterUnitId: stockLogEkspek.unitId,
					paymentDate: null,
					invoiceTaxes: {
						create: invoiceTaxesData,
					},
				},
			});

			await tx.deliveryOrder.update({
				where: {
					id: createSpbDto.deliveryOrderId,
				},
				data: {
					selectionStatus: 'SELECTED',
				},
			});

			return {
				dataSpb,
			};
		});
	}

	async findAll(query: GetSpbsDto, decoded: DecodeTokenType) {
		const {
			page = 1,
			limit = 10,
			orderNumber,
			date,
			description,
			noSpb,
			franco,
			subtotalAmount,
			customerName,
			isComplete,
			typeSalesSPb,
			tanggalPengiriman,
			selectionStatus,
		} = query;

		const skip = (page - 1) * limit;
		const take = +limit;
		const whereCondition: any = {};

		if (!(decoded.isRoot === 'Y' || decoded.isPusat)) {
			whereCondition.unitId = decoded.unitId;
		}

		if (orderNumber) {
			whereCondition.orderNumber = {
				contains: orderNumber,
				mode: 'insensitive',
			};
		}

		if (selectionStatus) {
			whereCondition.selectionStatus = selectionStatus;
		}

		if (date) {
			const start = dayjs(date).startOf('day').toDate();
			const end = dayjs(date).endOf('day').toDate();

			whereCondition.date = {
				gte: start,
				lte: end,
			};
		}

		if (tanggalPengiriman) {
			const start = dayjs(tanggalPengiriman).startOf('day').toDate();
			const end = dayjs(tanggalPengiriman).endOf('day').toDate();

			whereCondition.tanggalPengiriman = {
				gte: start,
				lte: end,
			};
		}

		if (description) {
			whereCondition.description = {
				contains: description,
				mode: 'insensitive',
			};
		}

		if (noSpb) {
			whereCondition.noSpb = {
				contains: noSpb,
				mode: 'insensitive',
			};
		}

		if (customerName) {
			whereCondition.customerName = {
				contains: customerName,
				mode: 'insensitive',
			};
		}

		if (franco) {
			whereCondition.franco = {
				contains: franco,
				mode: 'insensitive',
			};
		}

		if (isComplete) {
			whereCondition.isComplete = isComplete;
		}

		if (typeSalesSPb) {
			whereCondition.typeSalesSPb = typeSalesSPb;
		}

		if (subtotalAmount) {
			whereCondition.subtotalAmount = +subtotalAmount; // Berat biasanya angka, jadi langsung bandingkan
		}

		const [data, totalData] = await this.prisma.$transaction([
			this.prisma.sPB.findMany({
				skip,
				take,
				orderBy: {
					createdAt: 'desc',
				},
				include: {
					purchaseOrder: {
						include: {
							additionalCharges: true,
						},
					},
				},
				where: whereCondition,
			}),
			this.prisma.sPB.count({ where: whereCondition }),
		]);

		return {
			data,
			page: +page,
			limit: +limit,
			totalData,
			totalPages: Math.ceil(totalData / +limit),
		};
	}

	findOne(id: string) {
		return this.prisma.sPB.findUnique({
			where: {
				id,
			},
			include: {
				spbTax: true,
				itemsSPB: true,
				purchaseOrder: {
					include: {
						DeliveryOrder: {
							include: {
								au58: true,
							},
						},
					},
				},
			},
		});
	}

	findMany(orderNumber: string) {
		return this.prisma.itemsSPB.findMany({
			where: {
				orderNumber: orderNumber,
			},
			include: {
				spb: {
					select: {
						id: true,
						noSpb: true,
					},
				},
			},
		});
	}

	async update(id: string, updateSpbDto: UpdateSpbDto) {
		return await this.prisma.$transaction(
			async (tx) => {
				const existingSpb = await tx.sPB.findUnique({
					where: {
						id,
					},
					include: {
						itemsSPB: true,
					},
				});

				if (!existingSpb) {
					throw new NotFoundException('SPB tidak ditemukan');
				}

				const spb = await tx.sPB.update({
					where: {
						id,
					},
					data: {
						noSpb: updateSpbDto.noSpb,
						tanggalPengiriman: updateSpbDto.tanggalPengiriman,
					},
				});

				await tx.itemsSPB.updateMany({
					where: {
						spbId: id,
					},
					data: {
						namaAtasan: updateSpbDto.namaAtasan,
						jabatanAtasan: updateSpbDto.jabatanAtasan,
						dikirimDengan: updateSpbDto.dikirimDengan,
					},
				});

				if (existingSpb.typeSalesSPb !== 'RA') {
					return spb;
				}

				if (!updateSpbDto.items || updateSpbDto.items.length === 0) {
					throw new BadRequestException('Data item RA wajib dikirim');
				}

				if (existingSpb.selectionStatus === 'SELECTED') {
					throw new BadRequestException('Data SPB sudah diinvoice dan Qty Kirim tidak dapat diubah');
				}

				const editedQtyByProduct = new Map<string, number>();

				for (const item of updateSpbDto.items) {
					const qtyKirim = Number(item.qtyKirim);

					if (qtyKirim <= 0) {
						throw new BadRequestException(`Qty Kirim product ${item.productId} harus lebih dari 0`);
					}

					if (editedQtyByProduct.has(item.productId)) {
						throw new BadRequestException(`Product ${item.productId} tidak boleh dikirim lebih dari satu kali`);
					}

					editedQtyByProduct.set(item.productId, qtyKirim);
				}

				for (const oldItem of existingSpb.itemsSPB) {
					if (!editedQtyByProduct.has(oldItem.productId)) {
						throw new BadRequestException(`Product ${oldItem.productId} tidak ditemukan pada data edit`);
					}
				}

				const purchaseOrder = await tx.purchaseOrder.findUnique({
					where: {
						id: existingSpb.purchaseOrderId,
					},
					include: {
						items: true,
					},
				});

				if (!purchaseOrder) {
					throw new NotFoundException('Purchase Order tidak ditemukan');
				}

				const allRaSpb = await tx.sPB.findMany({
					where: {
						purchaseOrderId: existingSpb.purchaseOrderId,
						typeSalesSPb: 'RA',
					},
					include: {
						itemsSPB: true,
					},
				});

				const previousQtyByProduct = new Map<string, number>();

				for (const raSpb of allRaSpb) {
					if (raSpb.id === id) {
						continue;
					}

					for (const item of raSpb.itemsSPB) {
						const currentQty = previousQtyByProduct.get(item.productId) || 0;

						previousQtyByProduct.set(item.productId, currentQty + (item.qtyKirim || 0));
					}
				}

				const poQtyByProduct = new Map<string, number>();

				for (const item of purchaseOrder.items) {
					const currentQty = poQtyByProduct.get(item.productId) || 0;

					poQtyByProduct.set(item.productId, currentQty + (item.quantity || 0));
				}

				for (const [productId, qtyKirim] of editedQtyByProduct) {
					const totalQtyPO = poQtyByProduct.get(productId);

					if (totalQtyPO === undefined) {
						throw new BadRequestException(`Product ${productId} tidak terdapat pada Purchase Order`);
					}

					const totalQtyPrevious = previousQtyByProduct.get(productId) || 0;

					const sisaQty = totalQtyPO - totalQtyPrevious;

					if (qtyKirim > sisaQty) {
						throw new BadRequestException(`Qty Kirim product ${productId} melebihi sisa quantity PO. Sisa quantity: ${sisaQty}`);
					}
				}

				const oldInventoryTransactions = await tx.inventoryTransaction.findMany({
					where: {
						sourceId: id,
					},
				});

				const inventoryTransactionByProduct = new Map(oldInventoryTransactions.map((item) => [item.productId, item]));

				let subtotalAmount = 0;

				for (const item of existingSpb.itemsSPB) {
					const newQtyKirim = editedQtyByProduct.get(item.productId) || 0;

					const newTotal = Number(item.priceProduct) * newQtyKirim;

					const newStockProduct = Number(item.stockProduct) + Number(item.qtyKirim || 0) - newQtyKirim;

					subtotalAmount += newTotal;

					await tx.itemsSPB.update({
						where: {
							id: item.id,
						},
						data: {
							qtyKirim: newQtyKirim,
							total: newTotal,
							stockProduct: newStockProduct,
						},
					});

					const inventoryTransaction = inventoryTransactionByProduct.get(item.productId);

					if (inventoryTransaction) {
						await tx.inventoryTransaction.update({
							where: {
								id: inventoryTransaction.id,
							},
							data: {
								quantity: newQtyKirim,
							},
						});
					} else {
						await tx.inventoryTransaction.create({
							data: {
								source: 'penjualan',
								sourceId: id,
								quantity: newQtyKirim,
								transactionType: 'OUT',
								productId: item.productId,
								satuan: item.satuanProduct,
								nilaiSatuan: Number(item.priceProduct),
								unitId: existingSpb.unitId,
							},
						});
					}
				}

				await tx.sPB.update({
					where: {
						id,
					},
					data: {
						subtotalAmount,
					},
				});

				let isAllQuantityComplete = true;

				for (const [productId, totalQtyPO] of poQtyByProduct) {
					const totalQtyPrevious = previousQtyByProduct.get(productId) || 0;

					const totalQtyCurrent = editedQtyByProduct.get(productId) || 0;

					const totalQtyKirim = totalQtyPrevious + totalQtyCurrent;

					if (totalQtyKirim < totalQtyPO) {
						isAllQuantityComplete = false;
						break;
					}
				}

				await tx.deliveryOrder.update({
					where: {
						id: existingSpb.deliveryOrderId,
					},
					data: {
						selectionStatus: isAllQuantityComplete ? 'SELECTED' : 'NOT_SELECTED',
					},
				});

				return spb;
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async remove(id: string) {
		return this.prisma.$transaction(async (tx) => {
			const spb = await tx.sPB.findUnique({
				where: { id },
				include: {
					itemsSPB: true,
				},
			});
			if (!spb) {
				throw new NotFoundException('SPB tidak ditemukan');
			}
			await tx.inventoryTransaction.deleteMany({
				where: {
					sourceId: spb.id,
				},
			});
			await tx.itemsSPB.deleteMany({
				where: {
					spbId: spb.id,
				},
			});
			await tx.sPB.delete({
				where: {
					id: spb.id,
				},
			});
			await tx.deliveryOrder.update({
				where: {
					id: spb.deliveryOrderId,
				},
				data: {
					selectionStatus: 'NOT_SELECTED',
				},
			});

			return {
				message: 'SPB berhasil dihapus',
			};
		});
	}
}

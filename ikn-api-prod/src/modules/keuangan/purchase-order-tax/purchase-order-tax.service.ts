import { ConflictException, Injectable, Scope } from '@nestjs/common';
import { BulkCreatePurchaseOrderTaxRNDto } from './dto/create-purchase-order-tax-rn.dto';
import { BulkCreatePurchaseOrderTaxDto } from './dto/create-purchase-order-tax.dto';

import { Module, Prisma, TransactionTypeMapping } from '@prisma/client';
import { HelperGlobal } from '@src/common/utils/helper/helper';
import { DecodeTokenType } from '@src/modules/auth/authentikasi/authentikasi.controller';
import { PrismaService } from '@src/modules/common/prisma.service';
import { ShareModuleService } from '@src/modules/share-module/share-module.service';
import { nowWIB, nowWIBString } from '@src/shared/utils/glolabalFunc';
import { GetPurchaseOrderTaxDto } from './dto/get-purchase-order-tax.dto';

@Injectable({ scope: Scope.REQUEST })
export class PurchaseOrderTaxService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly helperGlobal: HelperGlobal,
		private readonly shareModuleService: ShareModuleService,
	) {}

	async createJournal(plus = 1) {
		const code = await this.shareModuleService.getNextCode('JournalEntry', 'numberJurnal', 'JRN', plus);
		return code;
	}

	async create(createPurchaseOrderTaxDto: BulkCreatePurchaseOrderTaxDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(async (tx) => {
			// inputkan pajak
			await tx.sPBTax.createMany({
				data: createPurchaseOrderTaxDto.taxes.map((tax) => ({
					spbId: tax.spbId,
					taxId: tax.taxId,
					taxType: tax.taxType,
					taxValue: tax.taxValue,
					taxAmount: tax.taxAmount,
				})),
			});

			await Promise.all(
				createPurchaseOrderTaxDto.item.map(
					async (_) =>
						await tx.countCekPajak.upsert({
							where: { purchaseOrderId: createPurchaseOrderTaxDto.purchaseOrderId },
							create: {
								purchaseOrderId: createPurchaseOrderTaxDto.purchaseOrderId,
								count: 1,
							},
							update: {
								count: { increment: 1 },
							},
						}),
				),
			);

			await tx.sPB.update({
				where: {
					id: createPurchaseOrderTaxDto.spbId,
				},
				data: {
					taxAmount: createPurchaseOrderTaxDto.totalAmounTax,
					totalAmount: createPurchaseOrderTaxDto.totalAmount,
					isCekPajak: true,
				},
			});

			const data = await tx.sPBTax.findMany({
				where: {
					spbId: createPurchaseOrderTaxDto.spbId,
				},
			});

			const dataSPB = await tx.sPB.findUnique({
				where: {
					id: createPurchaseOrderTaxDto.spbId,
				},
			});

			const taxLabels = data.map((t) => t.taxType);

			const taxes = await tx.tax.findMany({
				where: { taxType: { in: taxLabels } },
			});

			const additional = taxes.map((tax) => ({
				usage: 'ppn',
				amount: dataSPB.subtotalAmount * tax.taxValue,
			}));

			const journalEntries = await this.helperGlobal.generateJournalEntriesFromMappingV2({
				module: Module.SALES,
				transactionType: TransactionTypeMapping.INVOICE,
				baseAmountDebit: Number(dataSPB.totalAmount) || 0,
				baseAmountCredit: dataSPB.subtotalAmount || 0,
				unitId: dataSPB.unitId,
				additional: additional,
			});

			const numberJurnal = await this.createJournal();
			await tx.journalEntry.create({
				data: {
					date: dataSPB.date,
					spbId: dataSPB.id,
					numberJurnal: numberJurnal,
					referenceNumber: dataSPB.noSpb,
					description: `Penjualan Barang (RA) ke ${dataSPB.customerName}`,
					createdBy: 'System',
					module: 'SALES',
					staffId: decoded.id,
					unitId: dataSPB.unitId,
					typeJournalEntry: 'RA',
					totalBalance: journalEntries[0]?.debit || 0,
					totalBalanceUs: 0,
					details: {
						create: journalEntries,
					},
				},
			});

			// ke generate daat SPB sudah terkirim semua
			const sumItem = await tx.purchaseOrder.findUnique({
				where: {
					id: createPurchaseOrderTaxDto.purchaseOrderId,
				},
				include: {
					items: true,
				},
			});

			const countCekPajak = await tx.countCekPajak.findUnique({
				where: {
					purchaseOrderId: createPurchaseOrderTaxDto.purchaseOrderId,
				},
			});

			// generate invoice
			if (countCekPajak.count === sumItem.items.length) {
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
						typeInvoice: dataSPB.typeSalesSPb,
					},
				});
				const nextIdInv = countDataInv + 1;
				const invoiceNumber = `INV/${dataSPB.typeSalesSPb}/${month}/${year}/${String(nextIdInv).padStart(4, '0')}`;
				const spbItemCount = await tx.sPB.findMany({
					where: {
						purchaseOrderId: createPurchaseOrderTaxDto.purchaseOrderId,
					},
					include: {
						spbTax: true,
					},
				});
				// Step 1: Total semua pajak & total amount
				const amountWithTax = spbItemCount.reduce((sum, spb) => sum + Number(spb.taxAmount), 0);
				const subtotalAmount = spbItemCount.reduce((sum, spb) => sum + Number(spb.subtotalAmount), 0);

				// Step 2: Gabungkan tax berdasarkan taxType
				const taxMap = new Map();

				spbItemCount.forEach((spb) => {
					spb.spbTax.forEach((tax) => {
						const key = tax.taxType;
						if (!taxMap.has(key)) {
							taxMap.set(key, {
								taxType: tax.taxType,
								taxValue: Number(tax.taxValue),
								taxAmount: 0,
								taxId: tax.taxId,
							});
						}

						const taxItem = taxMap.get(key);
						taxItem.taxAmount += Number(tax.taxAmount);
					});
				});

				const invoiceTaxesData = Array.from(taxMap.values()).map((item) => ({
					isIncludedInPrice: false,
					withheldByCustomer: false,
					taxType: item.taxType,
					taxAmount: item.taxAmount,
					taxValue: item.taxValue,
					taxId: item.taxId,
				}));

				await tx.invoice.create({
					data: {
						spbId: createPurchaseOrderTaxDto.spbId,
						amountWithTax: amountWithTax,
						totalAmount: subtotalAmount,
						invoiceNumber: invoiceNumber,
						invoiceDate: nowWIBString(),
						typeInvoice: 'RA',
						paymentDate: null,
						masterUnitId: sumItem.unitId,
						invoiceTaxes: {
							create: invoiceTaxesData,
						},
					},
				});
			}
		});
	}

	async update(createPurchaseOrderTaxDto: BulkCreatePurchaseOrderTaxDto) {
		return this.prisma.$transaction(async (tx) => {
			await tx.sPBTax.deleteMany({
				where: {
					spbId: createPurchaseOrderTaxDto.spbId,
				},
			});
			// inputkan pajak
			await tx.sPBTax.createMany({
				data: createPurchaseOrderTaxDto.taxes.map((tax) => ({
					spbId: tax.spbId,
					taxId: tax.taxId,
					taxType: tax.taxType,
					taxValue: tax.taxValue,
					taxAmount: tax.taxAmount,
				})),
			});

			await tx.sPB.update({
				where: {
					id: createPurchaseOrderTaxDto.spbId,
				},
				data: {
					taxAmount: createPurchaseOrderTaxDto.totalAmounTax,
					totalAmount: createPurchaseOrderTaxDto.totalAmount,
				},
			});

			const spbItemCount = await tx.sPB.findMany({
				where: {
					purchaseOrderId: createPurchaseOrderTaxDto.purchaseOrderId,
				},
				include: {
					spbTax: true,
				},
			});
			// Step 1: Total semua pajak & total amount
			const amountWithTax = spbItemCount.reduce((sum, spb) => sum + Number(spb.taxAmount), 0);
			const subtotalAmount = spbItemCount.reduce((sum, spb) => sum + Number(spb.subtotalAmount), 0);

			// Step 2: Gabungkan tax berdasarkan taxType
			const taxMap = new Map();

			spbItemCount.forEach((spb) => {
				spb.spbTax.forEach((tax) => {
					const key = tax.taxType;
					if (!taxMap.has(key)) {
						taxMap.set(key, {
							taxType: tax.taxType,
							taxValue: Number(tax.taxValue),
							taxAmount: 0,
							taxId: tax.taxId,
						});
					}

					const taxItem = taxMap.get(key);
					taxItem.taxAmount += Number(tax.taxAmount);
				});
			});

			const invoiceTaxesData = Array.from(taxMap.values()).map((item) => ({
				isIncludedInPrice: false,
				withheldByCustomer: false,
				taxType: item.taxType,
				taxAmount: item.taxAmount,
				taxValue: item.taxValue,
				taxId: item.taxId,
			}));

			const invoice = await tx.invoice.findFirst({
				where: {
					spbId: createPurchaseOrderTaxDto.spbId,
					deletedAt: null,
				},
			});

			await tx.invoiceTax.deleteMany({
				where: {
					invoiceId: invoice.id,
				},
			});

			await tx.invoice.update({
				where: {
					id: invoice.id,
				},
				data: {
					spbId: createPurchaseOrderTaxDto.spbId,
					amountWithTax: amountWithTax,
					totalAmount: subtotalAmount,
					invoiceTaxes: {
						create: invoiceTaxesData,
					},
				},
			});
		});
	}

	async createRN(createPurchaseOrderTaxDto: BulkCreatePurchaseOrderTaxRNDto) {
		return this.prisma.$transaction(async (tx) => {
			await tx.purchaseOrder.update({
				where: {
					id: createPurchaseOrderTaxDto.purchaseOrderId,
				},
				data: {
					taxAmount: createPurchaseOrderTaxDto.totalAmounTax,
					totalAmount: createPurchaseOrderTaxDto.totalAmount,
					cekPajak: 'YES',
				},
			});

			// Buang pajak ganda dalam payload, lalu tolak jika pesanan sudah memiliki pajak tersebut.
			const taxes = createPurchaseOrderTaxDto.taxes.filter(
				(tax, index, list) => list.findIndex((item) => item.taxId === tax.taxId) === index,
			);
			const existingTaxes = await tx.purchaseOrderTax.findMany({
				where: {
					purchaseOrderId: createPurchaseOrderTaxDto.purchaseOrderId,
					taxId: { in: taxes.map((tax) => tax.taxId) },
				},
			});
			if (existingTaxes.length > 0) {
				throw new ConflictException(
					`Pajak ${existingTaxes.map((tax) => tax.taxType).join(', ')} sudah ada pada pesanan ini.`,
				);
			}

			return tx.purchaseOrderTax.createMany({
				data: taxes.map((tax) => ({
					purchaseOrderId: tax.purchaseOrderId,
					taxId: tax.taxId,
					taxType: tax.taxType,
					taxValue: tax.taxValue,
					taxAmount: tax.taxAmount,
				})),
			});
		});
	}

	async findAll(query: GetPurchaseOrderTaxDto, purchaseOrderId: string) {
		const { page = 1, limit = 10, taxAmount, taxType, taxValue } = query;

		const skip = (page - 1) * limit;
		const take = +limit;
		const whereConditionArray: Prisma.PurchaseOrderTaxWhereInput[] = [{ purchaseOrderId }];

		if (taxType) {
			whereConditionArray.push({
				taxType: {
					contains: taxType,
					mode: 'insensitive',
				},
			});
		}

		if (taxAmount !== undefined) {
			whereConditionArray.push({
				taxAmount: taxAmount,
			});
		}

		const whereCondition: Prisma.PurchaseOrderTaxWhereInput = {
			AND: whereConditionArray,
		};

		const [data, totalData] = await this.prisma.$transaction([
			this.prisma.purchaseOrderTax.findMany({
				skip,
				take,
				where: { ...whereCondition, purchaseOrderId },
			}),
			this.prisma.purchaseOrderTax.count({ where: { ...whereCondition, purchaseOrderId } }),
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
		return this.prisma.purchaseOrderTax.findUnique({
			where: { id },
		});
	}

	async updateRN(updatePurchaseOrderTaxDto: BulkCreatePurchaseOrderTaxRNDto) {
		return this.prisma.$transaction(async (tx) => {
			await tx.purchaseOrder.update({
				where: {
					id: updatePurchaseOrderTaxDto.purchaseOrderId,
				},
				data: {
					taxAmount: updatePurchaseOrderTaxDto.totalAmounTax,
					totalAmount: updatePurchaseOrderTaxDto.totalAmount,
					cekPajak: 'YES',
				},
			});

			await tx.purchaseOrderTax.deleteMany({
				where: {
					purchaseOrderId: updatePurchaseOrderTaxDto.purchaseOrderId,
				},
			});

			await tx.purchaseOrderTax.createMany({
				data: updatePurchaseOrderTaxDto.taxes.map((tax) => ({
					purchaseOrderId: tax.purchaseOrderId,
					taxId: tax.taxId,
					taxType: tax.taxType,
					taxValue: tax.taxValue,
					taxAmount: tax.taxAmount,
				})),
			});
		});
	}
}

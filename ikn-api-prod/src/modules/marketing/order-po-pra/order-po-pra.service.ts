import { BadRequestException, Injectable, Scope } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DecodeTokenType } from '@src/modules/auth/authentikasi/authentikasi.controller';
import { PrismaService } from '@src/modules/common/prisma.service';
import { nowWIBString } from '@src/shared/utils/glolabalFunc';
import dayjs from 'dayjs';
import { CreateOrderPoPraDto, PurchaseOrderTaxDto } from './dto/create-order-po-pra.dto';
import { GetOrderPoPRADto } from './dto/get-order-po-pra.dto';
import { UpdateFIleBLOrderPoPraDto } from './dto/update-bl-order-po-pra.dto';
import { UpdateOrderPoPraDto } from './dto/update-order-po-pra.dto';

@Injectable({ scope: Scope.REQUEST })
export class OrderPoPraService {
	constructor(private readonly prisma: PrismaService) {}

	private async prepareRnTaxes(
		client: Prisma.TransactionClient,
		taxes: PurchaseOrderTaxDto[] | undefined,
		subtotalAmount: number,
	) {
		const subtotal = Number(subtotalAmount);
		if (!Number.isFinite(subtotal) || subtotal < 0) {
			throw new BadRequestException('Subtotal pesanan RN tidak valid');
		}

		const requestedTaxes = taxes ?? [];
		if (!Array.isArray(requestedTaxes)) {
			throw new BadRequestException('Format pajak tidak valid');
		}

		const taxIds = requestedTaxes.map((tax) => tax.taxId);
		if (taxIds.some((id) => !id) || new Set(taxIds).size !== taxIds.length) {
			throw new BadRequestException('Data pajak RN kosong atau duplikat');
		}

		if (taxIds.length === 0) {
			return { taxes: [], taxAmount: 0, totalAmount: subtotal };
		}

		const masterTaxes = await client.tax.findMany({
			where: {
				id: { in: taxIds },
				isActive: true,
				deletedAt: null,
			},
		});

		if (masterTaxes.length !== taxIds.length) {
			throw new BadRequestException('Master pajak tidak ditemukan atau sudah tidak aktif');
		}

		const masterTaxById = new Map(masterTaxes.map((tax) => [tax.id, tax]));
		const normalizedTaxes = requestedTaxes.map((requestedTax) => {
			const masterTax = masterTaxById.get(requestedTax.taxId);
			const taxValue = Number(masterTax?.taxValue);
			const taxType = String(masterTax?.taxType || '').trim();

			if (!masterTax || !taxType || !Number.isFinite(taxValue) || taxValue < 0) {
				throw new BadRequestException('Data master pajak tidak valid');
			}

			return {
				taxId: masterTax.id,
				taxType,
				taxValue,
				taxAmount: subtotal * taxValue,
			};
		});

		const taxAmount = normalizedTaxes.reduce((total, tax) => total + tax.taxAmount, 0);
		const ppnAmount = normalizedTaxes
			.filter((tax) => tax.taxType.toUpperCase().includes('PPN'))
			.reduce((total, tax) => total + tax.taxAmount, 0);

		return {
			taxes: normalizedTaxes,
			taxAmount,
			totalAmount: subtotal + ppnAmount,
		};
	}

	async create(createOrderPoRubberDto: CreateOrderPoPraDto, decoded: DecodeTokenType) {
		try {
			return this.prisma.$transaction(async (tx) => {
				const rnTaxData =
					createOrderPoRubberDto.typePo === 'RN'
						? await this.prepareRnTaxes(tx, createOrderPoRubberDto.taxes, Number(createOrderPoRubberDto.subtotalAmount))
						: null;

				return tx.purchaseOrder.create({
					data: {
						orderNumber: createOrderPoRubberDto.orderNumber,
						date: createOrderPoRubberDto.date,
						invoiceSelectionStatus: 'NOT_SELECTED',
						kebun: createOrderPoRubberDto.kebun,
						description: createOrderPoRubberDto.description,
						franco: createOrderPoRubberDto.franco,
						fileUrl: createOrderPoRubberDto.file,
						fileUrlKontrak: createOrderPoRubberDto.fileKontrak,
						fileUrlEkspor: createOrderPoRubberDto.fileUrlEkspor,
						fileUrlProduksi: createOrderPoRubberDto.fileUrlProduksi,
						subtotalAmount: +createOrderPoRubberDto.subtotalAmount,
						taxAmount:
							rnTaxData?.taxAmount ??
							createOrderPoRubberDto?.taxes?.reduce((total, tax) => total + Number(tax.taxAmount), 0) ??
							0,
						totalAmount:
							rnTaxData?.totalAmount ??
							(createOrderPoRubberDto.totalAmount != null ? Number(createOrderPoRubberDto.totalAmount) : 0),
						customerName: createOrderPoRubberDto.customerName,
						customerId: createOrderPoRubberDto.customerId,
						staffId: decoded.id,
						unitId: decoded.unitId,
						typePo: createOrderPoRubberDto.typePo,
						typePayment: createOrderPoRubberDto.typePayment,
						downPayment: createOrderPoRubberDto.downPayment,
						currency: createOrderPoRubberDto.currency,
						incoterms: createOrderPoRubberDto.incoterms,
						items: {
							create: createOrderPoRubberDto.items.map((item) => ({
								productId: item.productId,
								quantity: +item.quantity,
								orderNumber: createOrderPoRubberDto.orderNumber,
								orderDate: createOrderPoRubberDto.date,
								total: item.beratproduct,
								beratproduct: +item.nilaiSatuan,
								kategoriProduct: item.kategoriProduct,
								kodeBarangProduct: item.kodeBarangProduct,
								namabarangProduct: item.namabarangProduct,
								priceProduct: +item.priceProduct,
								satuanProduct: item.satuanProduct,
								spesifikasiProduct: item.spesifikasiProduct,
								stockProduct: +item.stockProduct,
								unitProduct: item.unitProduct,
								namabarangProductInvoice: item.namabarangProductInvoice,
							})),
						},
						additionalCharges: {
							create: createOrderPoRubberDto?.additionalService?.map((item) => ({
								amount: item.amount,
								description: item.description,
								type: item.type,
							})),
						},
						PurchaseOrderTax: {
							create: (rnTaxData?.taxes ?? createOrderPoRubberDto?.taxes)?.map((tax) => ({
								taxId: tax.taxId,
								taxType: tax.taxType,
								taxValue: Number(tax.taxValue),
								taxAmount: Number(tax.taxAmount),
							})),
						},
					},
					include: {
						items: true,
						PurchaseOrderTax: true,
					},
				});
			});
		} catch (e) {
			throw e;
		}
	}

	async findAll(query: GetOrderPoPRADto, dataToken: DecodeTokenType) {
		const {
			page = 1,
			limit = 10,
			orderNumber,
			date,
			description,
			franco,
			subtotalAmount,
			totalAmount,
			itemCode,
			itemName,
			unit,
			quantity,
			unitPrice,
			total,
			isCekPajak,
			selectionStatus,
			selectionStatusInvoice,
			invoiceSelectionStatus,
			status,
			typePo,
			cekPajak,
			customerName,
		} = query;

		const skip = (page - 1) * limit;
		const take = +limit;

		const whereCondition: any = {};

		if (orderNumber) {
			whereCondition.orderNumber = {
				contains: orderNumber,
				mode: 'insensitive',
			};
		}

		if (selectionStatusInvoice) {
			whereCondition.selectionStatusInvoice = selectionStatusInvoice;
		}

		if (invoiceSelectionStatus) {
			whereCondition.invoiceSelectionStatus = invoiceSelectionStatus;
		}

		if (cekPajak) {
			whereCondition.cekPajak = cekPajak;
		}

		if (status) {
			whereCondition.status = status;
		}

		if (selectionStatus) {
			whereCondition.selectionStatus = selectionStatus;
		}

		if (typeof isCekPajak === 'boolean') {
			whereCondition.isCekPajak = isCekPajak;
		}

		if (typePo) {
			whereCondition.typePo = typePo;
		}

		if (date) {
			const start = dayjs(date).startOf('day').toDate();
			const end = dayjs(date).endOf('day').toDate();

			whereCondition.date = {
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

		if (franco) {
			whereCondition.franco = {
				contains: franco,
				mode: 'insensitive',
			};
		}

		if (subtotalAmount) {
			whereCondition.subtotalAmount = +subtotalAmount; // Berat biasanya angka, jadi langsung bandingkan
		}

		if (totalAmount) {
			whereCondition.totalAmount = +totalAmount; // Berat biasanya angka, jadi langsung bandingkan
		}

		if (customerName) {
			whereCondition.customerName = {
				contains: customerName,
				mode: 'insensitive',
			};
		}

		// dari join
		if (itemCode) {
			whereCondition.items = {
				itemCode: {
					contains: itemCode,
					mode: 'insensitive',
				},
			};
		}

		if (itemName) {
			whereCondition.items = {
				itemName: {
					contains: itemName,
					mode: 'insensitive',
				},
			};
		}

		if (unit) {
			whereCondition.items = {
				unit: +unit,
			};
		}

		if (quantity) {
			whereCondition.items = {
				quantity: +quantity,
			};
		}

		if (unitPrice) {
			whereCondition.items = {
				unitPrice: +unitPrice,
			};
		}

		if (total) {
			whereCondition.items = {
				total: +total,
			};
		}

		if (dataToken.roles.some((item) => item === 'admin')) {
			whereCondition.staffId = dataToken.id;
		}

		const [data, totalData] = await this.prisma.$transaction([
			this.prisma.purchaseOrder.findMany({
				include: {
					items: true,
					additionalCharges: true,
					PurchaseOrderTax: true,
				},
				skip,
				take,
				where: whereCondition,
				orderBy: {
					createdAt: 'desc',
				},
			}),
			this.prisma.purchaseOrder.count({ where: whereCondition }),
		]);

		return {
			data,
			total,
			page: +page,
			limit: +limit,
			totalData,
			totalPages: Math.ceil(totalData / +limit),
		};
	}

	async findOne(id: string) {
		return await this.prisma.purchaseOrder.findUnique({
			where: { id },
			include: {
				items: true,
				customer: true,
				PurchaseOrderTax: true,
				additionalCharges: true,
			},
		});
	}

	async update(id: string, updateOrderPoPraDto: UpdateOrderPoPraDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Pastikan PO ada
				const currentOrder = await tx.purchaseOrder.findUniqueOrThrow({
					where: { id: id },
				});

				const existingRnTaxes =
					currentOrder.typePo === 'RN' && updateOrderPoPraDto.taxes === undefined
						? await tx.purchaseOrderTax.findMany({ where: { purchaseOrderId: id } })
						: undefined;
				const taxesForUpdate =
					updateOrderPoPraDto.taxes ??
					existingRnTaxes?.map((tax) => ({
						taxId: tax.taxId,
						taxType: tax.taxType,
						taxValue: tax.taxValue,
						taxAmount: tax.taxAmount,
					}));
				const rnTaxData =
					currentOrder.typePo === 'RN'
						? await this.prepareRnTaxes(tx, taxesForUpdate, Number(updateOrderPoPraDto.subtotalAmount))
						: null;

				// 2. Hapus items dan additionalCharges lama
				await tx.purchaseOrderItem.deleteMany({
					where: { purchaseOrderId: id },
				});

				await tx.additionalCharges.deleteMany({
					where: { purchaseOrderId: id },
				});

				// 3. Update PO
				await tx.purchaseOrder.update({
					where: { id: id },
					data: {
						orderNumber: updateOrderPoPraDto.orderNumber,
						date: updateOrderPoPraDto.date,
						kebun: updateOrderPoPraDto.kebun,
						description: updateOrderPoPraDto.description,
						franco: updateOrderPoPraDto.franco,
						fileUrl: updateOrderPoPraDto.file,
						fileUrlKontrak: updateOrderPoPraDto.fileKontrak,
						fileUrlEkspor: updateOrderPoPraDto.fileUrlEkspor,
						fileUrlProduksi: updateOrderPoPraDto.fileUrlProduksi,
						subtotalAmount: +updateOrderPoPraDto.subtotalAmount,
						totalAmount: rnTaxData?.totalAmount ?? Number(updateOrderPoPraDto.totalAmount),
						...(rnTaxData ? { taxAmount: rnTaxData.taxAmount } : {}),
						customerName: updateOrderPoPraDto.customerName,
						customerId: updateOrderPoPraDto.customerId,
						staffId: decoded.id,
						unitId: decoded.unitId,
						typePayment: updateOrderPoPraDto.typePayment,
						downPayment: updateOrderPoPraDto.downPayment,
						currency: updateOrderPoPraDto.currency,
						incoterms: updateOrderPoPraDto.incoterms,
					},
				});

				// 4. Tambahkan ulang items
				if (updateOrderPoPraDto.items && updateOrderPoPraDto.items.length > 0) {
					await tx.purchaseOrderItem.createMany({
						data: updateOrderPoPraDto.items.map((item) => ({
							purchaseOrderId: id,
							productId: item.productId,
							quantity: +item.quantity,
							orderNumber: updateOrderPoPraDto.orderNumber,
							orderDate: updateOrderPoPraDto.date,
							total: item.beratproduct,
							beratproduct: +item.nilaiSatuan,
							kategoriProduct: item.kategoriProduct,
							kodeBarangProduct: item.kodeBarangProduct,
							namabarangProduct: item.namabarangProduct,
							priceProduct: +item.priceProduct,
							satuanProduct: item.satuanProduct,
							spesifikasiProduct: item.spesifikasiProduct,
							stockProduct: +item.stockProduct,
							unitProduct: item.unitProduct,
							namabarangProductInvoice: item.namabarangProductInvoice,
						})),
					});
				}

				// 5. Simpan ulang pajak hanya untuk pesanan RN.
				if (currentOrder.typePo === 'RN') {
					await tx.purchaseOrderTax.deleteMany({
						where: { purchaseOrderId: id },
					});

					if (rnTaxData && rnTaxData.taxes.length > 0) {
						await tx.purchaseOrderTax.createMany({
							data: rnTaxData.taxes.map((tax) => ({
								purchaseOrderId: id,
								taxId: tax.taxId,
								taxType: tax.taxType,
								taxValue: Number(tax.taxValue),
								taxAmount: Number(tax.taxAmount),
							})),
						});
					}
				}

				// 6. Tambahkan ulang additional charges
				if (updateOrderPoPraDto.additionalService && updateOrderPoPraDto.additionalService.length > 0) {
					await tx.additionalCharges.createMany({
						data: updateOrderPoPraDto.additionalService.map((item) => ({
							purchaseOrderId: id,
							amount: item.amount,
							description: item.description,
							type: item.type,
						})),
					});
				}

				// 6. Return PO
				return tx.purchaseOrder.findUnique({
					where: { id: id },
					include: {
						items: true,
						additionalCharges: true,
						PurchaseOrderTax: true,
					},
				});
			},
			{
				timeout: 15000,
			},
		);
	}

	async updateFileBL(id: string, updateOrderPoPraDto: UpdateFIleBLOrderPoPraDto) {
		await this.prisma.purchaseOrder.update({
			where: { id: id },
			data: {
				fileUrlBl: updateOrderPoPraDto.fileUrlBl,
			},
		});
	}

	async remove(id: string) {
		const uuid = crypto.randomUUID();
		return this.prisma.$transaction(async (tx) => {
			await tx.purchaseOrder.update({
				where: {
					id,
				},
				data: {
					orderNumber: uuid,
					deletedAt: nowWIBString(),
				},
			});

			await tx.sPB.updateMany({
				where: {
					purchaseOrderId: id,
				},
				data: {
					deletedAt: nowWIBString(),
				},
			});
		});
	}

	async restore(id: string) {
		return await this.prisma.purchaseOrder.update({
			where: { id },
			data: { deletedAt: null },
		});
	}
}

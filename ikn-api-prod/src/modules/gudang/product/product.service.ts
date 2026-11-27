import { Injectable, Scope } from '@nestjs/common';
import { DecodeTokenType } from '@src/modules/auth/authentikasi/authentikasi.controller';
import { PrismaService } from '@src/modules/common/prisma.service';
import { GetProductDto } from './dto/get-product.dto';

@Injectable({ scope: Scope.REQUEST })
export class ProductService {
	constructor(private readonly prisma: PrismaService) {}

	async findAll(query: GetProductDto, decoded: DecodeTokenType) {
		const {
			page = 1,
			limit = 10,
			sortBy = 'createdAt',
			sortOrder = 'desc',
			unit,
			spesifikasi,
			Satuan,
			nilaiSatuan,
			quantity,
			namaBarang,
			kodeBarang,
			kategori,
			date,
		} = query;

		const offset = (page - 1) * +limit;
		const take = +limit;

		// 1. Build WHERE Clause
		const conditions: string[] = [`pri."deletedAt" IS NULL`, `pri."productionIssueId" IS NULL`];
		const values: any[] = [];

		if (unit) {
			values.push(`%${unit}%`);
			conditions.push(`mu."id" ILIKE $${values.length}`);
		}

		if (spesifikasi) {
			values.push(`%${spesifikasi}%`);
			conditions.push(`pri."spesifikasi" ILIKE $${values.length}`);
		}

		if (kodeBarang) {
			values.push(`%${kodeBarang}%`);
			conditions.push(`pri."kodeBarang" ILIKE $${values.length}`);
		}
		if (namaBarang) {
			values.push(`%${namaBarang}%`);
			conditions.push(`pri."namaBarang" ILIKE $${values.length}`);
		}
		if (Satuan) {
			values.push(`%${Satuan}%`);
			conditions.push(`pri."Satuan" ILIKE $${values.length}`);
		}
		if (kategori) {
			values.push(`%${kategori}%`);
			conditions.push(`pri."kategori" ILIKE $${values.length}`);
		}

		if (nilaiSatuan) {
			values.push(Number(nilaiSatuan));
			conditions.push(`pri."nilaiSatuan" = $${values.length}`);
		}
		if (quantity) {
			values.push(Number(quantity));
			conditions.push(`pri."quantity" = $${values.length}`);
		}
		if (!decoded.isPusat) {
			values.push(`${decoded.unitId}`);
			conditions.push(`pri."unitId" = $${values.length}`);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		// 2. Whitelist untuk sorting
		const allowedSortFields = ['createdAt', 'stok', 'nilaiSatuan'];
		const safeSortBy = allowedSortFields.includes(sortBy) ? `pri."${sortBy}"` : `pri."createdAt"`;
		const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

		// 3. Query data utama
		const querySql = `
		SELECT DISTINCT ON (pri."finishedGoodId", pri."unitId")
			pri.*, mu."nama" AS "unitNama"
		FROM "ProductionReceiptItem" pri
		JOIN "MasterUnit" mu ON mu.id = pri."unitId"
		${whereClause}
		ORDER BY pri."finishedGoodId", pri."unitId", ${safeSortBy} ${safeSortOrder}
		OFFSET ${offset}
		LIMIT ${take};
		`;

		// 4. Query total count untuk pagination
		const countSql = `
		SELECT COUNT(*) AS total
		FROM (
			SELECT DISTINCT ON (pri."finishedGoodId", pri."unitId") 1
			FROM "ProductionReceiptItem" pri
			JOIN "MasterUnit" mu ON mu.id = pri."unitId"
			${whereClause}
			ORDER BY pri."finishedGoodId", pri."unitId", ${safeSortBy} ${safeSortOrder}
		) AS sub;
		`;

		const [data, totalResult] = await this.prisma.$transaction([
			this.prisma.$queryRawUnsafe(querySql, ...values) as any,
			this.prisma.$queryRawUnsafe(countSql, ...values),
		]);

		const totalData = parseInt(totalResult[0]?.total || '0', 10);

		const productsWithStock = await Promise.all(
			data.map(async (product) => {
				const whereIn: any = {
					productId: product.finishedGoodId,
					transactionType: 'IN',
					unit: product.unit,
				};
				const whereOut: any = {
					productId: product.finishedGoodId,
					transactionType: 'OUT',
					unit: product.unit,
				};

				if (date) {
					const startOfNextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

					whereOut.createdAt = {
						lt: startOfNextMonth,
					};

					whereIn.createdAt = {
						lt: startOfNextMonth,
					};
				}

				const stokMasuk = await this.prisma.inventoryTransaction.aggregate({
					_sum: { quantity: true, nilaiSatuan: true },
					where: whereIn,
				});

				const stokKeluar = await this.prisma.inventoryTransaction.aggregate({
					_sum: { quantity: true },
					where: whereOut,
				});

				const stokTerkini = Number(stokMasuk._sum.quantity ?? 0) - Number(stokKeluar._sum.quantity ?? 0);

				const nilaiSatuan = Number(product.nilaiSatuan ?? 0);

				const total = stokTerkini * nilaiSatuan;

				return {
					...product,
					stokTerkini,
					Total: total,
				};
			}),
		);

		return {
			data: productsWithStock,
			totalData,
			page: +page,
			limit: +limit,
			totalPages: Math.ceil(totalData / +limit),
		};
	}
}

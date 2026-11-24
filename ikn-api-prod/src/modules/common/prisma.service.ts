import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	constructor() {
		super();

		// Middleware untuk menyaring data yang belum dihapus (soft delete)
		this.$use(async (params, next) => {
			// Initialize params.args if it's undefined
			params.args = params.args || {};

			if (
				(params.model && params.action === 'findMany') ||
				params.action === 'findFirst' ||
				params.action === 'findUnique'
			) {
				// Ensure params.args.where is initialized as an object
				params.args.where = params.args.where || {};

				// Add your filter condition
				params.args.where.deletedAt = null; // Filter otomatis
			}

			// Middleware untuk set createdAt WIB saat create
			if (params.action === 'create') {
				const now = new Date();
				// konversi UTC ke WIB (UTC+7)
				const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);

				params.args.data = {
					...params.args.data,
					createdAt: wib,
				};
			}

			return next(params);
		});
	}
	async onModuleInit() {
		await this.$connect();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}

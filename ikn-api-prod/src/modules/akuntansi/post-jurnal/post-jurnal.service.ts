import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, Scope } from '@nestjs/common';
import { DecodeTokenType } from '@src/modules/auth/authentikasi/authentikasi.controller';
import { PrismaService } from '@src/modules/common/prisma.service';
import { CreateJurnalEntryDto } from '@src/modules/keuangan/jurnal-entry/dto/create-jurnal-entry.dto';
import dayjs from 'dayjs';
import { GetPostJurnalEntryDto } from './dto/get-post-jurnal.dto';

@Injectable({ scope: Scope.REQUEST })
export class PostJurnalService {
	constructor(private readonly prisma: PrismaService) {}
	private getPeriod(date: string): string {
		const d = new Date(date);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	}
	async postJournal(journalId: string, decoded: DecodeTokenType) {
		const journal = await this.prisma.journalEntry.findUnique({
			where: { id: journalId },
			include: { details: true },
		});

		if (!journal) throw new NotFoundException('Journal not found');
		if (journal.isPosted) throw new BadRequestException('Journal already posted');

		const period = this.getPeriod(journal.date.toISOString());

		for (const item of journal.details) {
			const { accountCode, debit: debitRection, credit: creditDirection, unitId } = item;
			const existingLedger = await this.prisma.generalLedger.findUnique({
				where: {
					unit_accountCode_periode: {
						accountCode,
						period,
						unitId: unitId,
					},
				},
			});
			const debit = debitRection || 0;
			const credit = creditDirection || 0;

			if (!existingLedger) {
				await this.prisma.generalLedger.create({
					data: {
						accountCode,
						openingCredit: 0,
						openingDebit: 0,
						period,
						debitTotal: Number(debit),
						creditTotal: Number(credit),
						staffId: decoded.id,
						unitId: unitId,
					},
				});
			} else {
				await this.prisma.generalLedger.update({
					where: {
						unit_accountCode_periode: {
							accountCode,
							period,
							unitId: unitId,
						},
					},
					data: {
						debitTotal: { increment: Number(debit) },
						creditTotal: { increment: Number(credit) },
					},
				});
			}
		}

		// Mark journal as posted
		await this.prisma.journalEntry.update({
			where: { id: journalId },
			data: { isPosted: true, status: 'CONFIRMED' },
		});

		return { message: 'Journal posted successfully', journalId };
	}

	async postJournalRevert(journalId: string, createJurnalEntryDto: CreateJurnalEntryDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(async (trx) => {
			const journal = await trx.journalEntry.findUnique({
				where: { id: journalId },
				include: { details: true },
			});
			if (!journal) throw new NotFoundException('Journal not found');
			const period = this.getPeriod(journal.date.toISOString());
			for (const item of journal.details) {
				const { accountCode, debit: debitRection, credit: creditDirection, unitId } = item;
				const debit = debitRection || 0;
				const credit = creditDirection || 0;
				await trx.generalLedger.update({
					where: {
						unit_accountCode_periode: {
							accountCode,
							period,
							unitId: unitId,
						},
					},
					data: {
						debitTotal: { decrement: Number(debit) },
						creditTotal: { decrement: Number(credit) },
					},
				});
			}

			// await trx.journalEntry.create({
			// 	data: {
			// 		date: createJurnalEntryDto.date,
			// 		purposeTransaction: createJurnalEntryDto.purposeTransaction || '-',
			// 		referenceNumber: createJurnalEntryDto.referenceNumber,
			// 		description: createJurnalEntryDto.description || '-',
			// 		numberJurnal: createJurnalEntryDto.numberJurnal,
			// 		journalEntryId: journalId,
			// 		createdBy: decoded.name || 'System',
			// 		module: '-',
			// 		staffId: decoded.id,
			// 		status: 'CONFIRMED',
			// 		isRevert: 'Y',
			// 		isPosted: true,
			// 		unitId: createJurnalEntryDto.unitId,
			// 		typeJournalEntry: createJurnalEntryDto.typeJournalEntry,
			// 		currencyValue: createJurnalEntryDto.currencyValue,
			// 		totalBalance: createJurnalEntryDto.totalBalance,
			// 		totalBalanceUs: createJurnalEntryDto.totalBalanceUs || 0,
			// 		details: {
			// 			create: createJurnalEntryDto.details.map((items) => ({
			// 				debit: items.debit || 0,
			// 				accountCode: items.accountCode,
			// 				description: items.description || '-',
			// 				credit: items.credit || 0,
			// 				unitId: items.unitId,
			// 				creditDollar: items.creditDollar || 0,
			// 				debitDollar: items.debitDollar || 0,
			// 			})), // Filter untuk mengabaikan entry kosong
			// 		},
			// 	},
			// });

			// Mark journal as posted
			await trx.journalEntry.update({
				where: { id: journalId },
				data: { isPosted: false, status: 'DRAFT' },
			});
		});
	}

	findAll() {
		return `This action returns all postJurnal`;
	}

	private async getOpeningBalance(accountCode: string, unitId: string, fiscalYear: string, decoded: DecodeTokenType) {
		const whereCondition: any = {
			accountCode,
			period: {
				startsWith: `${fiscalYear}-`, // contoh: '2025-'
			},
			deletedAt: null,
		};

		if (unitId && !(decoded.isRoot === 'Y' || decoded.isPusat)) {
			whereCondition.unitId = unitId;
		}
		const ob = await this.prisma.generalLedger.findMany({
			where: whereCondition,
		});

		const debit = ob.reduce((sum, item) => sum + Number(item.openingDebit), 0);
		const credit = ob.reduce((sum, item) => sum + Number(item.openingCredit), 0);

		return {
			debit: debit || 0,
			credit: credit || 0,
		};
	}

	private async getGeneralLedger(accountCode: string, unitId: string, period: string, decoded: DecodeTokenType) {
		const whereCondition: any = {
			accountCode,
			period,
			deletedAt: null,
		};
		if (unitId && !(decoded.isRoot === 'Y' || decoded.isPusat)) {
			whereCondition.unitId = unitId;
		}
		const gl = await this.prisma.generalLedger.findMany({
			where: whereCondition,
		});

		const debit = gl.reduce((sum, item) => sum + Number(item.debitTotal), 0);
		const credit = gl.reduce((sum, item) => sum + Number(item.creditTotal), 0);

		return {
			debit: debit || 0,
			credit: credit || 0,
		};
	}

	private getPreviousPeriod(period: string): string {
		const [year, month] = period.split('-').map(Number);
		const prev = new Date(year, month - 2); // minus 1 month
		return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
	}

	async findBukuBesar(query: GetPostJurnalEntryDto, decoded: DecodeTokenType) {
		const [year, month] = query.startDate.split('-').map(Number);
		const neracaAwal = await this.getOpeningBalance(query.accountCode, query.unitId, `${year}`, decoded);
		const prevPeriod = this.getPreviousPeriod(query.startDate);
		let saldoAwal = {
			debit: 0,
			credit: 0,
		};

		if (month !== 1) {
			saldoAwal = await this.getGeneralLedger(query.accountCode, query.unitId, prevPeriod, decoded);
		}

		const start = dayjs(query.startDate).startOf('day').toDate();
		const end = dayjs(query.endDate).endOf('day').toDate();

		const whereCondition: any = {
			isRevert: 'N',
			date: {
				gte: start,
				lte: end,
			},
			isPosted: true,
			details: {
				some: {
					accountCode: query.accountCode,
				},
			},
		};

		if (query.unitId && !(decoded.isRoot === 'Y' || decoded.isPusat)) {
			whereCondition.unitId = query.unitId;
		}
		try {
			// Ambil semua JournalEntry yang memiliki detail untuk accountCode tertentu
			const journalEntries = await this.prisma.journalEntry.findMany({
				where: whereCondition,
				include: {
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
						where: { accountCode: query.accountCode },
						select: {
							debit: true,
							credit: true,
							account: true,
							creditDollar: true,
							debitDollar: true,
							description: true,
						},
					},
				},
				orderBy: { date: 'asc' }, // Urutkan berdasarkan tanggal
			});

			const account = await this.prisma.account.findUnique({
				where: {
					code: query.accountCode,
				},
			});

			const whereOpeningBalance: any = {};
			if (query.unitId) {
				whereOpeningBalance.unitId = query.unitId;
			}

			const dataOpening = await this.prisma.openingBalanceHeader.findMany({
				where: {
					...whereOpeningBalance,
					isRevert: 'N',
					fiscalYear: `${year}`,
					openingMaterialItems: {
						some: {
							accountCode: query.accountCode,
						},
					},
				},
				include: {
					openingMaterialItems: {
						where: {
							accountCode: query.accountCode,
						},
					},
				},
			});

			const mergedOpeningMaterialItems = dataOpening.flatMap((item) => item.openingMaterialItems);
			let unit = null;
			if (query.unitId && !(decoded.isRoot === 'Y' || decoded.isPusat)) {
				unit = await this.prisma.masterUnit.findUnique({
					where: {
						id: query.unitId,
					},
				});
			}

			// const months = query.periode.split('-')[1];

			let saldo = 0;
			let totalDebitAwal = 0;
			let totalCreditAwal = 0;
			totalDebitAwal = Number(neracaAwal.debit) + Number(saldoAwal.debit);
			totalCreditAwal = Number(neracaAwal.credit) + Number(saldoAwal.credit);
			saldo = Number(neracaAwal.debit) - Number(neracaAwal.credit) + Number(saldoAwal.debit) - Number(saldoAwal.credit);

			const sumCredit = journalEntries.reduce((sum, jurnal) => {
				return sum + jurnal.details.reduce((s, d) => s + Number(d.credit || 0), 0);
			}, 0);

			const sumDebit = journalEntries.reduce((sum, jurnal) => {
				return sum + jurnal.details.reduce((s, d) => s + Number(d.debit || 0), 0);
			}, 0);

			const totalSaldoDebit = sumDebit + totalDebitAwal;
			const totalSaldoCredit = sumCredit + totalCreditAwal;
			const sumAllDebit = totalSaldoDebit - totalSaldoCredit < 0 ? 0 : totalSaldoDebit - totalSaldoCredit;
			const sumAllCredit = totalSaldoCredit - totalSaldoDebit < 0 ? 0 : totalSaldoCredit - totalSaldoDebit;

			const bukuBesar = [
				{
					tanggal: `01-01-${year}`, // atau null
					noJurnal: null,
					noTransaksi: '-',
					keterangan: 'Saldo Awal',
					name: account.name,
					fisikWarehouseIssue: mergedOpeningMaterialItems?.reduce((acc, item) => acc + Number(item.quantity || 0), 0) || 0,
					fisikWarehouseReceipt: mergedOpeningMaterialItems?.reduce((acc, item) => acc + Number(item.quantity || 0), 0) || 0,
					fisikCreditDollar: 0,
					fisikDebitDollar: 0,
					debit: Number(neracaAwal.debit) + Number(saldoAwal.debit),
					kredit: Number(neracaAwal.credit) + Number(saldoAwal.credit),
					saldo,
				},
				...journalEntries.flatMap((j) =>
					j.details.map((d) => {
						saldo += Number(d.debit) - Number(d.credit);
						return {
							tanggal: j.date,
							noJurnal: j.numberJurnal,
							noTransaksi: j.referenceNumber || '-',
							keterangan: `${j.description}-${d.description}`,
							fisikWarehouseIssue: j.transactionIssueId?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0,
							fisikWarehouseReceipt: j.transactionReceiptId?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0,
							fisikCreditDollar: Number(d.creditDollar) || 0,
							fisikDebitDollar: Number(d.debitDollar) || 0,
							name: d.account.name,
							debit: Number(d.debit),
							kredit: Number(d.credit),
							saldo,
						};
					}),
				),
			];
			return {
				accountCode: account.code || '-',
				code: account.code || '-',
				name: account.name || '-',
				unit: unit?.nama || 'Semua',
				totalDebitAwal,
				totalCreditAwal,
				sumDebit,
				sumCredit,
				totalSaldoDebit,
				totalSaldoCredit,
				sumAllDebit,
				sumAllCredit,
				bukuBesar,
			};
		} catch (e) {
			throw new InternalServerErrorException(e);
		}
	}
}

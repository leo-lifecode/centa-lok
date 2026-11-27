import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { TaxType, TypePenjualan } from '@prisma/client';
import { DecodeTokenType } from '@src/modules/auth/authentikasi/authentikasi.controller';
import { PrismaService } from '@src/modules/common/prisma.service';
import { ShareModuleService } from '@src/modules/share-module/share-module.service';
import { nowWIBString } from '@src/shared/utils/glolabalFunc';
import dayjs from 'dayjs';
import { CreateCashOutFlowDto } from './dto/create-transaction-out.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { GetTransactionDto } from './dto/get-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
@Injectable({ scope: Scope.REQUEST })
export class TransactionService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly shareModuleService: ShareModuleService,
	) {}

	async createJournal(plus = 1) {
		const code = await this.shareModuleService.getNextCode('JournalEntry', 'numberJurnal', 'JRN', plus);
		return code;
	}

	private getTypeByUnitId(unitId: string): TypePenjualan {
		const unitTypeMap: Record<string, TypePenjualan> = {
			'78fcaf27-a258-408f-b576-b049a8bd0c92': 'pusat',
			'dec5789a-425f-4818-937c-82ae1190bc22': 'RA',
			'bd519639-332d-4e3b-a75b-02a6adc052db': 'RN',
			'2678e985-04a3-4476-855f-521aade71bcf': 'Rubber_Thread',
		};

		const type = unitTypeMap[unitId];

		if (!type) {
			throw new BadRequestException('Unit yang dipilih belum memiliki pemetaan tipe transaksi.');
		}

		return type;
	}

	// =====================================================
	// UANG MASUK BANK (RP) CREATE TRANSACTION
	// Mendukung:
	// 1. Dengan Invoice
	// 2. Manual / Tanpa Invoice
	// =====================================================
	async create(createTransactionDto: CreateTransactionDto, decoded: DecodeTokenType) {
		// Validasi bank account dan akun kas
		const bankAccount = await this.prisma.bankAccount.findUnique({
			where: { id: createTransactionDto.bank_account_id },
			include: { account: true }, // akun kas/bank
		});

		if (!bankAccount) {
			throw new NotFoundException('Bank account not found');
		}

		// Temukan akun pendapatan jasa
		const incomeAccount = await this.prisma.account.findFirst({
			where: { code: bankAccount.accountCode }, // kode akun pendapatan jasa
		});

		if (!incomeAccount) {
			throw new NotFoundException('Income account not found');
		}

		return this.prisma.$transaction(
			async (tx) => {
				// =====================================================
				// MODE MANUAL: UANG MASUK BANK (RP) TANPA INVOICE
				// Hanya berjalan jika invoiceId tidak dikirim.
				// =====================================================
				if (!createTransactionDto.invoiceId) {
					const typeByUnit = this.getTypeByUnitId(createTransactionDto.unitId);
					const numberJurnal = await this.createJournal();

					// Update saldo bank
					await tx.bankAccount.update({
						where: { id: createTransactionDto.bank_account_id },
						data: {
							currentBalance: {
								increment: createTransactionDto.jumlahBayar || 0,
							},
						},
					});

					const cashBankTransactionDetails = createTransactionDto.cashBankTransactionDetails.filter(
						(item) => item.accountCode !== null,
					);

					const dataJurnalDetails = cashBankTransactionDetails.map((item) => ({
						accountCode: item.accountCode,
						unitId: bankAccount.unitId,
						credit: item.credit,
						debit: item.debit,
						description: item.keterangan,
					}));

					console.log('NOMOR TRANSAKSI MANUAL:', createTransactionDto.transactionNumber);

					const transaction = await tx.cashBankTransaction.create({
						data: {
							transactionNumber: createTransactionDto.transactionNumber,
							amountInIDR: createTransactionDto.jumlahBayar,
							amountOriginal: createTransactionDto.jumlahBayar,
							currency: 'RP',
							exchangeRate: createTransactionDto.exchangeRate,
							date: createTransactionDto.date,
							grossAmount: 0,
							type: 'CASH_IN',
							description: createTransactionDto.description,
							receivedFrom: createTransactionDto.receivedFrom ?? null,
							purpose: createTransactionDto.purpose ?? null,
							administrasiAmount: createTransactionDto.administrasiAmount,
							bank_account_id: createTransactionDto.bank_account_id,

							// Transaksi manual tidak memiliki invoice.
							invoiceId: null,
							typeTransaction: typeByUnit,

							unitId: createTransactionDto.unitId,
							staffId: decoded.id,

							// Tidak membuat withholding tax karena tidak ada invoice.
							cashBankTransactionDetails: {
								create: cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							},

							journalEntry: {
								create: {
									module: 'SALES',
									date: createTransactionDto.date,
									description: createTransactionDto.description === '-' ? 'Penerimaan Kas' : createTransactionDto.description,
									purposeTransaction: createTransactionDto.description || '-',
									referenceNumber: createTransactionDto.transactionNumber,
									numberJurnal,
									unitId: bankAccount.unitId,
									createdBy: 'System',
									staffId: decoded.id,
									typeJournalEntry: typeByUnit,
									totalBalance: createTransactionDto.amount,

									details: {
										create: [
											{
												accountCode: incomeAccount.code,
												debit: createTransactionDto.jumlahBayar || 0,
												unitId: bankAccount.unitId,
												credit: 0,
												description: incomeAccount.name,
											},
											...dataJurnalDetails,
										],
									},
								},
							},
						},
					});

					// Mirror jurnal jika unit transaksi berbeda dengan unit bank.
					if (createTransactionDto.unitId !== bankAccount.unitId) {
						const numberJurnalMirror = await this.createJournal(2);

						await tx.journalEntry.create({
							data: {
								module: 'SALES',
								date: createTransactionDto.date,
								description: 'Mirror TMP: penerimaan kas via Pusat',
								referenceNumber: createTransactionDto.transactionNumber,
								purposeTransaction: createTransactionDto.description || '-',
								numberJurnal: numberJurnalMirror,
								createdBy: 'System',
								staffId: decoded.id,
								transactionId: transaction.id,
								unitId: createTransactionDto.unitId,
								is_intercompany: true,
								typeJournalEntry: typeByUnit,
								intercompanyReference: numberJurnal,
								totalBalance: createTransactionDto.amount || 0,

								details: {
									create: [
										{
											accountCode: '8888',
											debit: createTransactionDto.amount || 0,
											unitId: createTransactionDto.unitId,
											credit: 0,
											description: 'Sesuaikan Akun',
										},
										{
											accountCode: '8888',
											debit: 0,
											unitId: createTransactionDto.unitId,
											credit: createTransactionDto.amount || 0,
											description: 'Sesuaikan Akun',
										},
									],
								},
							},
						});
					}

					return transaction;
				}

				// =====================================================
				// MODE DEFAULT: KODE LAMA TETAP DIPERTAHANKAN
				// =====================================================

				const invoice = await tx.invoice.findUnique({
					where: { id: createTransactionDto.invoiceId },
					include: {
						invoiceTaxes: true, // Mengambil pajak terkait transaksi
						spb: {
							include: {
								purchaseOrder: {
									include: {
										customer: true,
									},
								},
							},
						},
					},
				});
				if (!invoice) {
					throw new Error('Invoice tidak ditemukan');
				}
				const sumPayment = createTransactionDto.amount + (Number(invoice.downPayment) || 0);

				if (sumPayment >= invoice.amountWithTax) {
					await tx.invoice.update({
						where: { id: createTransactionDto.invoiceId },
						data: {
							selectionStatus: 'SELECTED',
							status: 'LUNAS',
						},
					});
				}

				await tx.invoice.update({
					where: { id: createTransactionDto.invoiceId },
					data: {
						paymentDate: nowWIBString(),
						downPayment: sumPayment,
					},
				});

				await tx.purchaseOrder.update({
					where: { id: invoice.spb.purchaseOrderId },
					data: {
						status: 'APPROVED',
					},
				});
				// Cek pajak yang berlaku
				const taxes = invoice.invoiceTaxes || [];
				let totalPPh22 = 0;
				let totalPPh23 = 0;
				let totalPPNBM = 0;
				taxes.forEach((tax) => {
					switch (tax.taxType) {
						case 'PPh 22':
							totalPPh22 = tax.taxAmount; // PPh 22 dihitung
							break;
						case 'PPh 23':
							totalPPh23 = tax.taxAmount; // PPh 23 dihitung
							break;
						case 'PPNBM':
							totalPPNBM = tax.taxAmount; // PPh 23 dihitung
							break;
						// Tambahkan pajak lainnya jika perlu
					}
				});
				const numberJurnal = await this.createJournal();
				// Update saldo
				await tx.bankAccount.update({
					where: { id: createTransactionDto.bank_account_id },
					data: {
						currentBalance: { increment: createTransactionDto.jumlahBayar || 0 },
					},
				});

				const cashBankTransactionDetails = createTransactionDto.cashBankTransactionDetails.filter(
					(item) => item.accountCode !== null,
				);

				const dataJurnalDetails = cashBankTransactionDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: bankAccount.unitId,
					credit: item.credit,
					debit: item.debit,
					description: item.keterangan,
				}));

				console.log('NOMOR TRANSAKSI:', createTransactionDto.transactionNumber);

				const transaction = await tx.cashBankTransaction.create({
					data: {
						transactionNumber: createTransactionDto.transactionNumber,
						amountInIDR: createTransactionDto.jumlahBayar,
						amountOriginal: createTransactionDto.amountOriginal
							? createTransactionDto.amountOriginal
							: createTransactionDto.jumlahBayar,
						currency: createTransactionDto.currency ? createTransactionDto.currency : 'RP',
						exchangeRate: createTransactionDto.exchangeRate,
						date: createTransactionDto.date,
						grossAmount: invoice.totalAmount,
						type: 'CASH_IN',
						description: createTransactionDto.description,
						receivedFrom: createTransactionDto.receivedFrom ?? null,
						purpose: createTransactionDto.purpose ?? null,
						administrasiAmount: createTransactionDto.administrasiAmount,
						bank_account_id: createTransactionDto.bank_account_id,
						invoiceId: createTransactionDto.invoiceId,
						typeTransaction: invoice.typeInvoice,
						unitId: createTransactionDto.unitId,
						staffId: decoded.id,
						withholdingTaxes: {
							create: [
								...(totalPPh22 > 0 ? [{ amount: totalPPh22, type: TaxType.PPH22 }] : []),
								...(totalPPh23 > 0 ? [{ amount: totalPPh23, type: TaxType.PPH23 }] : []),
								...(totalPPNBM > 0 ? [{ amount: totalPPNBM, type: TaxType.PPH4_2 }] : []),
							],
						},
						cashBankTransactionDetails: {
							create: [
								// {
								// 	accountCode: incomeAccount.code,
								// 	accountName: incomeAccount.name,
								// 	debit: createTransactionDto.jumlahBayar || 0,
								// 	unitId: bankAccount.unitId,
								// 	credit: 0,
								// 	keterangan: incomeAccount.name,
								// },
								...cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							],
						},
						journalEntry: {
							create: {
								module: 'SALES',
								date: createTransactionDto.date,
								description: createTransactionDto.description === '-' ? 'Penerimaan Kas' : createTransactionDto.description,
								purposeTransaction: createTransactionDto.description || '-',
								referenceNumber: createTransactionDto.transactionNumber,
								numberJurnal: numberJurnal,
								unitId: bankAccount.unitId,
								createdBy: 'System',
								staffId: decoded.id,
								typeJournalEntry: invoice.typeInvoice,
								totalBalance: createTransactionDto.amount,
								details: {
									create: [
										{
											accountCode: incomeAccount.code,
											debit: createTransactionDto.jumlahBayar || 0,
											unitId: bankAccount.unitId,
											credit: 0,
											description: incomeAccount.name,
										},
										...dataJurnalDetails,
									],
								},
							},
						},
					},
				});

				if (createTransactionDto.unitId !== bankAccount.unitId) {
					const numberJurnalMirror = await this.createJournal(2);
					//Mirror jurnal
					await tx.journalEntry.create({
						data: {
							module: 'SALES',
							date: createTransactionDto.date,
							description: `Mirror TMP: pelunasan piutang via Pusat`,
							referenceNumber: createTransactionDto.transactionNumber,
							purposeTransaction: createTransactionDto.description || '-',
							numberJurnal: numberJurnalMirror,
							createdBy: 'System',
							staffId: decoded.id,
							transactionId: transaction.id,
							unitId: createTransactionDto.unitId,
							is_intercompany: true,
							typeJournalEntry: invoice.typeInvoice,
							intercompanyReference: numberJurnal,
							totalBalance: createTransactionDto.amount || 0,
							details: {
								// create: sortedMirror,
								create: [
									{
										accountCode: '8888',
										debit: createTransactionDto.amount || 0,
										unitId: createTransactionDto.unitId,
										credit: 0,
										description: 'Sesuaikan Akun',
									},
									{
										accountCode: '8888',
										debit: 0,
										unitId: createTransactionDto.unitId,
										credit: createTransactionDto.amount || 0,
										description: 'Sesuaikan Akun',
									},
								],
							},
						},
					});
				}

				return transaction;
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	// =====================================================
	// POSTING UANG MASUK BANK (RP)
	// Membuat ulang jurnal yang sudah dihapus
	// Mengikuti struktur jurnal pada create()
	// =====================================================
	async postingCashInFlow(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Ambil transaksi Uang Masuk Bank (Rp).
				const transaction = await tx.cashBankTransaction.findFirst({
					where: {
						id,
						deletedAt: null,
						type: 'CASH_IN',
						currency: 'RP',
					},
					include: {
						bank_account: {
							include: {
								account: true,
							},
						},
						cashBankTransactionDetails: {
							where: {
								deletedAt: null,
							},
							orderBy: {
								createdAt: 'asc',
							},
						},
					},
				});

				if (!transaction) {
					throw new NotFoundException('Transaksi Uang Masuk Bank (Rp) tidak ditemukan.');
				}

				// 2. Pastikan belum ada jurnal aktif.
				const existingJournal = await tx.journalEntry.findFirst({
					where: {
						transactionId: id,
						deletedAt: null,
					},
				});

				if (existingJournal) {
					throw new BadRequestException('Transaksi ini sudah memiliki jurnal aktif.');
				}

				const bankAccount = transaction.bank_account;

				if (!bankAccount) {
					throw new NotFoundException('Rekening bank transaksi tidak ditemukan.');
				}

				// 3. Ambil akun pendapatan sesuai pola create().
				const incomeAccount = await tx.account.findFirst({
					where: {
						code: bankAccount.accountCode,
					},
				});

				if (!incomeAccount) {
					throw new NotFoundException('Income account not found');
				}

				const amount = Number(transaction.amountInIDR || 0);
				const isDifferentUnit = transaction.unitId !== bankAccount.unitId;
				const isManual = !transaction.invoiceId;

				// 4. Ambil nomor jurnal utama.
				const numberJurnal = await this.createJournal();

				// 5. Susun detail jurnal utama sesuai create().
				const dataJurnalDetails = transaction.cashBankTransactionDetails
					.filter((item) => item.accountCode !== null)
					.map((item) => ({
						accountCode: item.accountCode,
						unitId: bankAccount.unitId,
						credit: item.credit,
						debit: item.debit,
						description: item.keterangan,
					}));

				// 6. Buat jurnal utama.
				const mainJournal = await tx.journalEntry.create({
					data: {
						module: 'SALES',
						date: transaction.date,
						description: transaction.description === '-' ? 'Penerimaan Kas' : transaction.description,
						purposeTransaction: transaction.description || '-',
						referenceNumber: transaction.transactionNumber,
						numberJurnal,
						unitId: bankAccount.unitId,
						createdBy: 'System',
						staffId: transaction.staffId || decoded.id,
						transactionId: transaction.id,
						typeJournalEntry: transaction.typeTransaction,
						totalBalance: amount,
						details: {
							create: [
								{
									accountCode: incomeAccount.code,
									debit: amount,
									unitId: bankAccount.unitId,
									credit: 0,
									description: incomeAccount.name,
								},
								...dataJurnalDetails,
							],
						},
					},
				});

				// 7. Buat jurnal mirror jika unit transaksi berbeda
				// dengan unit rekening bank.
				let mirrorJournal = null;

				if (isDifferentUnit) {
					const numberJurnalMirror = await this.createJournal(2);

					mirrorJournal = await tx.journalEntry.create({
						data: {
							module: 'SALES',
							date: transaction.date,
							description: isManual ? 'Mirror TMP: penerimaan kas via Pusat' : 'Mirror TMP: pelunasan piutang via Pusat',
							referenceNumber: transaction.transactionNumber,
							purposeTransaction: transaction.description || '-',
							numberJurnal: numberJurnalMirror,
							createdBy: 'System',
							staffId: transaction.staffId || decoded.id,
							transactionId: transaction.id,
							unitId: transaction.unitId,
							is_intercompany: true,
							typeJournalEntry: transaction.typeTransaction,
							intercompanyReference: numberJurnal,
							totalBalance: amount,
							details: {
								create: [
									{
										accountCode: '8888',
										debit: amount,
										unitId: transaction.unitId,
										credit: 0,
										description: 'Sesuaikan Akun',
									},
									{
										accountCode: '8888',
										debit: 0,
										unitId: transaction.unitId,
										credit: amount,
										description: 'Sesuaikan Akun',
									},
								],
							},
						},
					});
				}

				return {
					transactionId: transaction.id,
					journalId: mainJournal.id,
					journalNumber: mainJournal.numberJurnal,
					mirrorJournalId: mirrorJournal?.id ?? null,
					mirrorJournalNumber: mirrorJournal?.numberJurnal ?? null,
				};
			},
			{
				maxWait: 10000,
				timeout: 20000,
			},
		);
	}

	async createDollar(createTransactionDto: CreateTransactionDto, decoded: DecodeTokenType) {
		// Validasi bank account dan akun kas
		const bankAccount = await this.prisma.bankAccount.findUnique({
			where: { id: createTransactionDto.bank_account_id },
			include: { account: true }, // akun kas/bank
		});
		if (!bankAccount) {
			throw new NotFoundException('Bank account not found');
		}
		// Temukan akun pendapatan jasa
		const incomeAccount = await this.prisma.account.findFirst({
			where: { code: bankAccount.accountCode }, // kode akun pendapatan jasa
		});
		if (!incomeAccount) {
			throw new NotFoundException('Income account not found');
		}
		return this.prisma.$transaction(
			async (tx) => {
				// =====================================================
				// MODE MANUAL: UANG MASUK BANK DOLLAR TANPA INVOICE
				// =====================================================
				if (!createTransactionDto.invoiceId) {
					const cashBankTransactionDetails = createTransactionDto.cashBankTransactionDetails.filter(
						(item) => item.accountCode !== null,
					);

					// Ambil nominal Dollar dari debit akun bank
					const resultClean = cashBankTransactionDetails.find((item) => item.accountCode === bankAccount.accountCode)?.debit;

					if (resultClean === undefined || resultClean === null) {
						throw new BadRequestException('Detail debit akun bank tidak ditemukan.');
					}

					// Nominal Rupiah berdasarkan kurs
					const sumIDR = resultClean * createTransactionDto.exchangeRate;

					const numberJurnal = await this.createJournal();

					// Update saldo bank Dollar dan Rupiah
					await tx.bankAccount.update({
						where: { id: bankAccount.id },
						data: {
							currentBalance: (bankAccount.currentBalance ?? 0) + sumIDR,
							currentBalanceDollar: (bankAccount.currentBalanceDollar ?? 0) + resultClean,
						},
					});

					// Detail jurnal Dollar
					const dataJurnalDetails = cashBankTransactionDetails.map((item) => ({
						accountCode: item.accountCode,
						unitId: bankAccount.unitId,
						creditDollar: item.credit,
						debitDollar: item.debit,
						description: item.keterangan,
					}));

					// Simpan transaksi manual
					const transaction = await tx.cashBankTransaction.create({
						include: {
							unit: true,
							journalEntry: true,
						},
						data: {
							transactionNumber: createTransactionDto.transactionNumber,
							amountInIDR: sumIDR || 0,
							amountOriginal: resultClean || 0,
							currency: 'DOLLAR',
							exchangeRate: createTransactionDto.exchangeRate,
							date: createTransactionDto.date,
							grossAmount: 0,
							type: 'CASH_IN',
							description: createTransactionDto.description,
							receivedFrom: createTransactionDto.receivedFrom ?? null,
							purpose: createTransactionDto.purpose ?? null,
							administrasiAmount: createTransactionDto?.administrasiAmount || 0,
							bank_account_id: createTransactionDto.bank_account_id,
							invoiceEksporId: null,
							typeTransaction: 'RN_EKSPOR',
							unitId: createTransactionDto.unitId,
							staffId: decoded.id,
							cashBankTransactionDetails: {
								create: cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							},
							journalEntry: {
								create: {
									module: 'SALES',
									date: createTransactionDto.date,
									description: createTransactionDto.description === '-' ? 'Penerimaan Kas' : createTransactionDto.description,
									purposeTransaction: createTransactionDto.description || '-',
									referenceNumber: createTransactionDto.transactionNumber,
									numberJurnal,
									createdBy: 'System',
									staffId: decoded.id,
									unitId: bankAccount.unitId,
									typeJournalEntry: 'RN_EKSPOR',
									currencyValue: createTransactionDto.exchangeRate,
									totalBalance: sumIDR,
									totalBalanceUs: resultClean || 0,
									details: {
										create: dataJurnalDetails,
									},
								},
							},
						},
					});

					// Mirror jurnal jika unit transaksi berbeda dengan unit bank
					if (createTransactionDto.unitId !== bankAccount.unitId) {
						const numberJurnalMirror = await this.createJournal(2);

						await tx.journalEntry.create({
							data: {
								module: 'SALES',
								date: createTransactionDto.date,
								description: 'Mirror TMP: pelunasan piutang via Pusat',
								referenceNumber: createTransactionDto.transactionNumber,
								numberJurnal: numberJurnalMirror,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: createTransactionDto.unitId,
								is_intercompany: true,
								typeJournalEntry: 'RN_EKSPOR',
								transactionId: transaction.id,
								intercompanyReference: numberJurnal,
								currencyValue: createTransactionDto.exchangeRate,
								totalBalanceUs: resultClean || 0,
								totalBalance: sumIDR,
								details: {
									create: [
										{
											accountCode: '8888',
											debitDollar: resultClean || 0,
											unitId: createTransactionDto.unitId,
											creditDollar: 0,
											description: 'Sesuaikan Akun',
										},
										{
											accountCode: '8888',
											debitDollar: 0,
											unitId: createTransactionDto.unitId,
											creditDollar: resultClean || 0,
											description: 'Sesuaikan Akun',
										},
									],
								},
							},
						});
					}

					return transaction;
				}

				// =====================================================
				// MODE INVOICE: KODE LAMA TETAP BERJALAN
				// =====================================================

				const invoice = await tx.invoiceEkspor.findUnique({
					where: { id: createTransactionDto.invoiceId },
				});
				if (!invoice) {
					throw new Error('Invoice tidak ditemukan');
				}
				const cashBankTransactionDetails = createTransactionDto.cashBankTransactionDetails.filter(
					(item) => item.accountCode !== null,
				);
				const resultClean = cashBankTransactionDetails.find((item) => item.accountCode === bankAccount.accountCode).debit;
				const sumIDR = resultClean * createTransactionDto.exchangeRate;
				// const sumDebit = cashBankTransactionDetails.reduce((acc, cur) => acc + cur.debit, 0);
				const sumPayment = Number(createTransactionDto.jumlahBayarDollar || 0) + (Number(invoice.donePayment) || 0);
				if (sumPayment >= Number(invoice.totalCIF)) {
					await tx.invoiceEkspor.update({
						where: { id: createTransactionDto.invoiceId },
						data: {
							status: 'LUNAS',
						},
					});
				}

				await tx.invoiceEkspor.update({
					where: { id: createTransactionDto.invoiceId },
					data: {
						donePayment: sumPayment,
					},
				});

				await tx.purchaseOrder.update({
					where: { orderNumber: invoice.purchaseOrder },
					data: {
						status: 'APPROVED',
					},
				});
				const numberJurnal = await this.createJournal();

				// Update saldo
				// await tx.bankAccount.update({
				// 	where: { id: createTransactionDto.bank_account_id },
				// 	data: {
				// 		currentBalance: { increment: sumIDR || 0 },
				// 		currentBalanceDollar: { increment: resultClean || 0 },
				// 	},
				// });

				await tx.bankAccount.update({
					where: { id: bankAccount.id },
					data: {
						currentBalance: (bankAccount.currentBalance ?? 0) + (sumIDR ?? 0),
						currentBalanceDollar: (bankAccount.currentBalanceDollar ?? 0) + (resultClean ?? 0),
					},
				});

				const dataJurnalDetails = cashBankTransactionDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: bankAccount.unitId,
					creditDollar: item.credit,
					debitDollar: item.debit,
					description: item.keterangan,
				}));
				//FIXME

				const transaction = await tx.cashBankTransaction.create({
					include: {
						unit: true,
						journalEntry: true,
					},
					data: {
						transactionNumber: createTransactionDto.transactionNumber,
						amountInIDR: sumIDR || 0,
						amountOriginal: resultClean || 0,
						currency: createTransactionDto.currency ? createTransactionDto.currency : 'RP',
						exchangeRate: createTransactionDto.exchangeRate,
						date: createTransactionDto.date,
						grossAmount: invoice.totalCIF,
						type: 'CASH_IN',
						description: createTransactionDto.description,
						receivedFrom: createTransactionDto.receivedFrom ?? null,
						purpose: createTransactionDto.purpose ?? null,
						administrasiAmount: createTransactionDto?.administrasiAmount || 0,
						bank_account_id: createTransactionDto.bank_account_id,
						invoiceEksporId: createTransactionDto.invoiceId,
						typeTransaction: 'RN_EKSPOR',
						unitId: createTransactionDto.unitId,
						staffId: decoded.id,
						cashBankTransactionDetails: {
							create: [
								...createTransactionDto.cashBankTransactionDetails
									.filter((item) => item.accountCode !== null)
									.map((item) => ({
										accountCode: item.accountCode,
										accountName: item.accountName,
										keterangan: item.keterangan,
										unitId: item.unitId,
										credit: item.credit,
										debit: item.debit,
									})),
							],
						},
						journalEntry: {
							create: {
								module: 'SALES',
								date: createTransactionDto.date,
								description: createTransactionDto.description === '-' ? 'Penerimaan Kas' : createTransactionDto.description,
								purposeTransaction: createTransactionDto.description || '-',
								referenceNumber: createTransactionDto.transactionNumber,
								numberJurnal: numberJurnal,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: bankAccount.unitId,
								typeJournalEntry: 'RN_EKSPOR',
								currencyValue: createTransactionDto.exchangeRate,
								totalBalance: sumIDR,
								totalBalanceUs: resultClean || 0,
								details: {
									create: dataJurnalDetails,
								},
							},
						},
					},
				});

				if (createTransactionDto.unitId !== bankAccount.unitId) {
					const numberJurnalMirror = await this.createJournal(2);
					//Mirror jurnal
					await tx.journalEntry.create({
						data: {
							module: 'SALES',
							date: createTransactionDto.date,
							description: `Mirror TMP: pelunasan piutang via Pusat`,
							referenceNumber: createTransactionDto.transactionNumber,
							numberJurnal: numberJurnalMirror,
							createdBy: 'System',
							staffId: decoded.id,
							unitId: createTransactionDto.unitId,
							is_intercompany: true,
							typeJournalEntry: 'RN_EKSPOR',
							transactionId: transaction.id,
							intercompanyReference: numberJurnal,
							currencyValue: createTransactionDto.exchangeRate,
							totalBalanceUs: resultClean || 0,
							totalBalance: sumIDR,
							details: {
								create: [
									{
										accountCode: '8888',
										debitDollar: resultClean || 0,
										unitId: createTransactionDto.unitId,
										creditDollar: 0,
										description: 'Sesuaikan Akun',
									},
									{
										accountCode: '8888',
										debitDollar: 0,
										unitId: createTransactionDto.unitId,
										creditDollar: resultClean || 0,
										description: 'Sesuaikan Akun',
									},
								],
							},
						},
					});
				}

				return transaction;
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	// =====================================================
	// POSTING UANG MASUK BANK (DOLLAR)
	// Membuat ulang jurnal yang sudah dihapus
	// Mengikuti struktur jurnal pada createDollar()
	// =====================================================
	async postingCashInFlowDollar(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Ambil transaksi Uang Masuk Bank Dollar.
				const transaction = await tx.cashBankTransaction.findFirst({
					where: {
						id,
						deletedAt: null,
						type: 'CASH_IN',
						currency: 'DOLLAR',
					},
					include: {
						bank_account: {
							include: {
								account: true,
							},
						},
						cashBankTransactionDetails: {
							where: {
								deletedAt: null,
							},
							orderBy: {
								createdAt: 'asc',
							},
						},
					},
				});

				if (!transaction) {
					throw new NotFoundException('Transaksi Uang Masuk Bank (Dollar) tidak ditemukan.');
				}

				// 2. Pastikan belum ada jurnal aktif.
				const existingJournal = await tx.journalEntry.findFirst({
					where: {
						transactionId: id,
						deletedAt: null,
					},
				});

				if (existingJournal) {
					throw new BadRequestException('Transaksi ini sudah memiliki jurnal aktif.');
				}

				const bankAccount = transaction.bank_account;

				if (!bankAccount) {
					throw new NotFoundException('Rekening bank transaksi tidak ditemukan.');
				}

				// 3. Ambil detail transaksi Dollar.
				const transactionDetails = transaction.cashBankTransactionDetails.filter((item) => item.accountCode !== null);

				if (transactionDetails.length === 0) {
					throw new BadRequestException('Detail transaksi Dollar tidak ditemukan.');
				}

				// Nominal Dollar dan Rupiah yang benar-benar diterima.
				const amountDollar = Number(transaction.amountOriginal || 0);
				const amountIDR = Number(transaction.amountInIDR || 0);
				const exchangeRate = Number(transaction.exchangeRate || 0);

				if (amountDollar <= 0 || amountIDR <= 0) {
					throw new BadRequestException('Nominal transaksi Dollar atau Rupiah tidak valid.');
				}

				const isDifferentUnit = transaction.unitId !== bankAccount.unitId;
				const isManual = !transaction.invoiceEksporId;

				// 4. Buat nomor jurnal utama.
				const numberJurnal = await this.createJournal();

				// 5. Susun detail jurnal Dollar.
				const dataJurnalDetails = transactionDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: bankAccount.unitId,
					debitDollar: item.debit,
					creditDollar: item.credit,
					description: item.keterangan,
				}));

				// 6. Buat jurnal utama.
				const mainJournal = await tx.journalEntry.create({
					data: {
						module: 'SALES',
						date: transaction.date,
						description: transaction.description === '-' ? 'Penerimaan Kas' : transaction.description,
						purposeTransaction: transaction.description || '-',
						referenceNumber: transaction.transactionNumber,
						numberJurnal,
						createdBy: 'System',
						staffId: transaction.staffId || decoded.id,
						unitId: bankAccount.unitId,
						transactionId: transaction.id,
						typeJournalEntry: 'RN_EKSPOR',
						currencyValue: exchangeRate,
						totalBalance: amountIDR,
						totalBalanceUs: amountDollar,
						details: {
							create: dataJurnalDetails,
						},
					},
				});

				// 7. Buat jurnal mirror jika unit berbeda.
				let mirrorJournal = null;

				if (isDifferentUnit) {
					const numberJurnalMirror = await this.createJournal(2);

					mirrorJournal = await tx.journalEntry.create({
						data: {
							module: 'SALES',
							date: transaction.date,
							description: isManual ? 'Mirror TMP: penerimaan kas via Pusat' : 'Mirror TMP: pelunasan piutang via Pusat',
							referenceNumber: transaction.transactionNumber,
							numberJurnal: numberJurnalMirror,
							createdBy: 'System',
							staffId: transaction.staffId || decoded.id,
							unitId: transaction.unitId,
							is_intercompany: true,
							typeJournalEntry: 'RN_EKSPOR',
							transactionId: transaction.id,
							intercompanyReference: numberJurnal,
							currencyValue: exchangeRate,
							totalBalanceUs: amountDollar,
							totalBalance: amountIDR,
							details: {
								create: [
									{
										accountCode: '8888',
										debitDollar: amountDollar,
										unitId: transaction.unitId,
										creditDollar: 0,
										description: 'Sesuaikan Akun',
									},
									{
										accountCode: '8888',
										debitDollar: 0,
										unitId: transaction.unitId,
										creditDollar: amountDollar,
										description: 'Sesuaikan Akun',
									},
								],
							},
						},
					});
				}

				return {
					transactionId: transaction.id,
					journalId: mainJournal.id,
					journalNumber: mainJournal.numberJurnal,
					mirrorJournalId: mirrorJournal?.id ?? null,
					mirrorJournalNumber: mirrorJournal?.numberJurnal ?? null,
				};
			},
			{
				maxWait: 10000,
				timeout: 20000,
			},
		);
	}

	async updateDollar(id: string, createTransactionDto: CreateTransactionDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// Ambil transaksi lama terlebih dahulu agar jenis transaksi dapat ditentukan.
				const oldTransaction = await tx.cashBankTransaction.findUnique({
					where: { id },
					include: {
						journalEntry: { include: { details: true } },
						cashBankTransactionDetails: true,
					},
				});
				if (!oldTransaction) {
					throw new BadRequestException('Transaksi tidak ditemukan cashBankTransaction');
				}

				// =====================================================
				// UPDATE MANUAL DOLLAR
				// =====================================================
				if (!oldTransaction.invoiceEksporId) {
					const bankAccount = await tx.bankAccount.findUnique({
						where: { id: createTransactionDto.bank_account_id },
						include: { account: true },
					});

					if (!bankAccount) {
						throw new NotFoundException('Bank account not found');
					}

					const mainJournal = oldTransaction.journalEntry.find((j) => !j.is_intercompany);

					const mirrorJournal = oldTransaction.journalEntry.find((j) => j.is_intercompany);

					const wasIntercompany = !!mirrorJournal;

					if (!mainJournal) {
						throw new BadRequestException('Jurnal utama tidak ditemukan.');
					}

					if (mainJournal.isPosted) {
						throw new BadRequestException('Jurnal utama sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
					}

					if (mirrorJournal?.isPosted) {
						throw new BadRequestException('Jurnal mirror unit sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
					}

					const cashBankTransactionDetails = createTransactionDto.cashBankTransactionDetails.filter(
						(item) => item.accountCode !== null,
					);

					const matchingDetail = cashBankTransactionDetails.find((item) => item.accountCode === bankAccount.accountCode);

					if (matchingDetail?.debit === undefined || matchingDetail?.debit === null) {
						throw new BadRequestException('Detail debit akun bank tidak ditemukan.');
					}

					const resultClean = matchingDetail.debit;
					const sumIDR = resultClean * createTransactionDto.exchangeRate;

					const isIntercompany = !this.isSameUnit(createTransactionDto.unitId, bankAccount.unitId);

					// Kembalikan saldo transaksi lama
					await tx.bankAccount.update({
						where: { id: oldTransaction.bank_account_id },
						data: {
							currentBalance: {
								decrement: oldTransaction.amountInIDR || 0,
							},
							currentBalanceDollar: {
								decrement: oldTransaction.amountOriginal || 0,
							},
						},
					});

					// Tambahkan saldo transaksi baru
					await tx.bankAccount.update({
						where: { id: bankAccount.id },
						data: {
							currentBalance: {
								increment: sumIDR || 0,
							},
							currentBalanceDollar: {
								increment: resultClean || 0,
							},
						},
					});

					// Update transaksi Manual
					await tx.cashBankTransaction.update({
						where: { id },
						data: {
							transactionNumber: createTransactionDto.transactionNumber,
							amountInIDR: sumIDR || 0,
							amountOriginal: resultClean || 0,
							currency: 'DOLLAR',
							exchangeRate: createTransactionDto.exchangeRate,
							date: createTransactionDto.date,
							grossAmount: 0,
							type: 'CASH_IN',
							description: createTransactionDto.description,
							receivedFrom: createTransactionDto.receivedFrom,
							purpose: createTransactionDto.purpose,
							administrasiAmount: createTransactionDto.administrasiAmount || 0,
							bank_account_id: createTransactionDto.bank_account_id,
							invoiceEksporId: null,
							typeTransaction: 'RN_EKSPOR',
							unitId: createTransactionDto.unitId,
							staffId: decoded.id,
							cashBankTransactionDetails: {
								deleteMany: {
									cashBankTransactionId: id,
								},
								create: cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							},
						},
					});

					// Update detail jurnal utama
					const dataJurnalDetails = cashBankTransactionDetails.map((item) => ({
						accountCode: item.accountCode,
						unitId: bankAccount.unitId,
						creditDollar: item.credit,
						debitDollar: item.debit,
						description: item.keterangan,
					}));

					await tx.journalEntryDetail.deleteMany({
						where: { journalEntryId: mainJournal.id },
					});

					await tx.journalEntry.update({
						where: { id: mainJournal.id },
						data: {
							date: createTransactionDto.date,
							addjust: false,
							description: createTransactionDto.description === '-' ? 'Penerimaan Kas' : createTransactionDto.description,
							referenceNumber: createTransactionDto.transactionNumber,
							purposeTransaction: createTransactionDto.description || '-',
							unitId: bankAccount.unitId,
							currencyValue: createTransactionDto.exchangeRate,
							totalBalance: sumIDR,
							totalBalanceUs: resultClean || 0,
							details: {
								create: dataJurnalDetails,
							},
						},
					});

					// Update / create / hapus jurnal mirror
					let currentMirrorJournal: typeof mirrorJournal | null = mirrorJournal ?? null;

					const newJournalDetailsMirror = [
						{
							accountCode: '8888',
							unitId: createTransactionDto.unitId,
							debitDollar: resultClean || 0,
							creditDollar: 0,
							description: 'Sesuaikan Akun',
						},
						{
							accountCode: '8888',
							unitId: createTransactionDto.unitId,
							debitDollar: 0,
							creditDollar: resultClean || 0,
							description: 'Sesuaikan Akun',
						},
					];

					if (isIntercompany) {
						if (mirrorJournal) {
							await tx.journalEntryDetail.deleteMany({
								where: { journalEntryId: mirrorJournal.id },
							});

							currentMirrorJournal = await tx.journalEntry.update({
								where: { id: mirrorJournal.id },
								data: {
									date: createTransactionDto.date,
									addjust: false,
									description: 'Mirror TMP: pelunasan piutang via Pusat',
									referenceNumber: createTransactionDto.transactionNumber,
									purposeTransaction: createTransactionDto.description || '-',
									unitId: createTransactionDto.unitId,
									currencyValue: createTransactionDto.exchangeRate,
									totalBalanceUs: resultClean || 0,
									totalBalance: sumIDR,
									details: {
										create: newJournalDetailsMirror,
									},
								},
								include: { details: true },
							});
						} else {
							const numberJurnalMirror = await this.createJournal(2);

							currentMirrorJournal = await tx.journalEntry.create({
								data: {
									module: 'SALES',
									date: createTransactionDto.date,
									description: 'Mirror TMP: pelunasan piutang via Pusat',
									referenceNumber: createTransactionDto.transactionNumber,
									numberJurnal: numberJurnalMirror,
									createdBy: 'System',
									staffId: decoded.id,
									unitId: createTransactionDto.unitId,
									is_intercompany: true,
									typeJournalEntry: 'RN_EKSPOR',
									transactionId: id,
									intercompanyReference: mainJournal.numberJurnal,
									currencyValue: createTransactionDto.exchangeRate,
									totalBalanceUs: resultClean || 0,
									totalBalance: sumIDR,
									details: {
										create: newJournalDetailsMirror,
									},
								},
								include: { details: true },
							});
						}
					} else if (mirrorJournal) {
						await tx.journalAdjustmentSuggestion.deleteMany({
							where: { journalEntryId: mirrorJournal.id },
						});

						await tx.journalEntryDetail.deleteMany({
							where: { journalEntryId: mirrorJournal.id },
						});

						await tx.journalEntry.delete({
							where: { id: mirrorJournal.id },
						});

						currentMirrorJournal = null;
					}

					// Adjustment suggestion
					const detailChanges = this.computeJournalDiff(mainJournal, dataJurnalDetails);

					const mirrorChanges = mirrorJournal ? this.computeJournalDiff(mirrorJournal, newJournalDetailsMirror) : [];

					await tx.journalAdjustmentSuggestion.deleteMany({
						where: {
							journalEntryId: mainJournal.id,
							status: 'PENDING',
						},
					});

					if (detailChanges.length > 0) {
						await tx.journalAdjustmentSuggestion.create({
							data: {
								journalEntryId: mainJournal.id,
								transactionId: id,
								status: 'PENDING',
								changes: {
									fields: detailChanges,
									snapshot: {
										isIntercompany,
										wasIntercompany,
										dataJurnalDetails,
										unitId: bankAccount.unitId,
										bankUnitId: bankAccount.unitId,
										amount: sumIDR,
										jumlahBayar: resultClean,
										date: createTransactionDto.date,
										description: createTransactionDto.description,
										transactionNumber: createTransactionDto.transactionNumber,
										mirrorJournalId: currentMirrorJournal?.id ?? null,
									},
								} as any,
							},
						});
					}

					if (currentMirrorJournal && mirrorChanges.length > 0) {
						await tx.journalAdjustmentSuggestion.deleteMany({
							where: {
								journalEntryId: currentMirrorJournal.id,
								status: 'PENDING',
							},
						});

						await tx.journalAdjustmentSuggestion.create({
							data: {
								journalEntryId: currentMirrorJournal.id,
								transactionId: id,
								status: 'PENDING',
								changes: {
									fields: mirrorChanges,
									snapshot: {
										isIntercompany,
										wasIntercompany,
										newJournalDetailsMirror,
										unitId: createTransactionDto.unitId,
										bankUnitId: bankAccount.unitId,
										amount: sumIDR,
										jumlahBayar: resultClean,
										date: createTransactionDto.date,
										description: createTransactionDto.description,
										transactionNumber: createTransactionDto.transactionNumber,
										mirrorJournalId: currentMirrorJournal.id,
									},
								} as any,
							},
						});
					}

					return {
						id,
						journalId: mainJournal.id,
						journalNumber: mainJournal.numberJurnal,
						hasChanges: detailChanges.length > 0 || mirrorChanges.length > 0,
						journalChanges: detailChanges,
						mirrorChanges,
					};
				}

				// =====================================================
				// UPDATE INVOICE DOLLAR (LOGIKA ASLI, TIDAK DIUBAH)
				// =====================================================
				const bankAccount = await tx.bankAccount.findUnique({
					where: { id: createTransactionDto.bank_account_id },
					include: { account: true },
				});
				if (!bankAccount) {
					throw new NotFoundException('Bank account not found');
				}

				const invoice = await tx.invoiceEkspor.findUnique({
					where: { id: createTransactionDto.invoiceId },
				});
				if (!invoice) {
					throw new BadRequestException('Invoice tidak ditemukan');
				}

				// ini
				const mainJournal = oldTransaction.journalEntry.find((j) => !j.is_intercompany);
				const mirrorJournal = oldTransaction.journalEntry.find((j) => j.is_intercompany);
				const wasIntercompany = !!mirrorJournal;

				// FIX: guard posted journals — same rule updateCashOutFlow enforces, missing here entirely.
				if (!mainJournal) {
					throw new BadRequestException('Jurnal utama tidak ditemukan.');
				}
				if (mainJournal.isPosted) {
					throw new BadRequestException('Jurnal utama sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
				}
				if (mirrorJournal?.isPosted) {
					throw new BadRequestException('Jurnal mirror unit sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
				}

				const incomeAccount = await tx.account.findFirst({ where: { code: bankAccount.accountCode } });
				if (!incomeAccount) {
					throw new NotFoundException('Income account not found');
				}

				const cashBankTransactionDetails = createTransactionDto.cashBankTransactionDetails.filter(
					(item) => item.accountCode !== null,
				);

				// FIX: derive resultClean/sumIDR from the details + exchangeRate, exactly like
				// createDollar. The original trusted dto.amount / dto.jumlahBayar directly, fields
				// createDollar never even uses — the two flows had drifted out of sync.
				const matchingDetail = cashBankTransactionDetails.find((item) => item.accountCode === bankAccount.accountCode);
				if (!matchingDetail) {
					throw new BadRequestException('Detail transaksi untuk akun bank tidak ditemukan.');
				}
				const resultClean = matchingDetail.debit;
				const sumIDR = resultClean * createTransactionDto.exchangeRate;

				const isIntercompany = !this.isSameUnit(createTransactionDto.unitId, bankAccount.unitId);
				// FIX: reverse the OLD balances (IDR *and* Dollar) off the OLD bank account.
				// Original only touched currentBalance and never reversed currentBalanceDollar at all.
				const bankAccountAfterUpdate = await tx.bankAccount.update({
					where: { id: oldTransaction.bank_account_id },
					data: {
						currentBalance: { decrement: oldTransaction.amountInIDR || 0 },
						currentBalanceDollar: { decrement: oldTransaction.amountOriginal || 0 },
					},
				});

				// Apply the NEW balances onto the NEW bank account.
				// await tx.bankAccount.update({
				// 	where: { id: createTransactionDto.bank_account_id },
				// 	data: {
				// 		currentBalance: { increment: sumIDR || 0 },
				// 		currentBalanceDollar: { increment: resultClean || 0 },
				// 	},
				// });

				await tx.bankAccount.update({
					where: { id: bankAccount.id },
					data: {
						currentBalance: (bankAccountAfterUpdate.currentBalance ?? 0) + (sumIDR ?? 0),
						currentBalanceDollar: (bankAccountAfterUpdate.currentBalanceDollar ?? 0) + (resultClean ?? 0),
					},
				});

				// FIX: recompute invoice.donePayment — subtract this transaction's OLD contribution,
				// add its NEW one. Original never touched invoice/donePayment/status on update at all,
				// so editing an export payment silently desynced the invoice.
				const oldSumDebit = oldTransaction.amountOriginal || 0;
				const newSumDebit = createTransactionDto.jumlahBayarDollar || 0;
				const sumPayment = Number(invoice.donePayment || 0) - oldSumDebit + newSumDebit;
				await tx.invoiceEkspor.update({
					where: { id: createTransactionDto.invoiceId },
					data: {
						donePayment: sumPayment,
						// NOTE: only flips to LUNAS on threshold met. If your status enum has a
						// "not yet paid" value distinct from the current default, tell me and I'll
						// add the reverse-branch (e.g. sumPayment < totalCIF -> 'BELUM_LUNAS').
						...(sumPayment >= Number(invoice.totalCIF) ? { status: 'LUNAS' } : { status: 'HUTANG' }),
					},
				});
				// Update transaksi utama
				await tx.cashBankTransaction.update({
					where: { id },
					data: {
						transactionNumber: createTransactionDto.transactionNumber,
						amountInIDR: createTransactionDto.amount || 0,
						amountOriginal: resultClean || 0,
						currency: createTransactionDto.currency ?? 'RP',
						exchangeRate: createTransactionDto.exchangeRate,
						date: createTransactionDto.date,
						grossAmount: invoice.totalCIF,
						type: 'CASH_IN',
						description: createTransactionDto.description,
						receivedFrom: createTransactionDto.receivedFrom,
						purpose: createTransactionDto.purpose,
						administrasiAmount: createTransactionDto.administrasiAmount,
						bank_account_id: createTransactionDto.bank_account_id,
						invoiceEksporId: createTransactionDto.invoiceId,
						typeTransaction: 'RN_EKSPOR',
						unitId: createTransactionDto.unitId,
						staffId: decoded.id,
						cashBankTransactionDetails: {
							deleteMany: { cashBankTransactionId: id },
							create: cashBankTransactionDetails.map((item) => ({
								accountCode: item.accountCode,
								accountName: item.accountName,
								keterangan: item.keterangan,
								unitId: item.unitId,
								credit: item.credit,
								debit: item.debit,
							})),
						},
					},
				});

				// FIX: rebuild the actual journal detail rows instead of leaving them untouched
				// (original explicitly skipped this with a "❌ details TIDAK disentuh" comment).
				const dataJurnalDetails = cashBankTransactionDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: bankAccount.unitId,
					creditDollar: item.credit,
					debitDollar: item.debit,
					description: item.keterangan,
				}));
				// const newJournalDetailsMain = [
				// 	{
				// 		accountCode: incomeAccount.code,
				// 		unitId: bankAccount.unitId,
				// 		creditDollar: 0,
				// 		debitDollar: resultClean,
				// 		description: incomeAccount.name,
				// 	},
				// 	...dataJurnalDetails,
				// ];

				await tx.journalEntryDetail.deleteMany({ where: { journalEntryId: mainJournal.id } });
				await tx.journalEntry.update({
					where: { id: mainJournal.id },
					data: {
						date: createTransactionDto.date,
						addjust: false,
						description: createTransactionDto.description === '-' ? 'Penerimaan Kas' : createTransactionDto.description,
						referenceNumber: createTransactionDto.transactionNumber,
						purposeTransaction: createTransactionDto.description || '-',
						unitId: bankAccount.unitId,
						currencyValue: createTransactionDto.exchangeRate,
						totalBalance: sumIDR,
						totalBalanceUs: resultClean || 0,
						details: { create: dataJurnalDetails },
					},
				});

				// FIX: handle intercompany *transitions*, not just "update mirror if it happens to exist".
				// Original left three gaps: (a) if it becomes intercompany on edit, no mirror was ever
				// created; (b) if it stops being intercompany, the stale mirror stuck around forever;
				// (c) mirror details were never rewritten even when it did exist.
				let currentMirrorJournal: typeof mirrorJournal | null = mirrorJournal ?? null;
				const newJournalDetailsMirror = [
					{
						accountCode: '8888',
						unitId: createTransactionDto.unitId,
						debitDollar: resultClean || 0,
						creditDollar: 0,
						description: 'Sesuaikan Akun',
					},
					{
						accountCode: '8888',
						unitId: createTransactionDto.unitId,
						debitDollar: 0,
						creditDollar: resultClean || 0,
						description: 'Sesuaikan Akun',
					},
				];

				if (isIntercompany) {
					if (mirrorJournal) {
						await tx.journalEntryDetail.deleteMany({ where: { journalEntryId: mirrorJournal.id } });
						currentMirrorJournal = await tx.journalEntry.update({
							where: { id: mirrorJournal.id },
							data: {
								date: createTransactionDto.date,
								addjust: false,
								description: `Mirror TMP: pelunasan piutang via Pusat`,
								referenceNumber: createTransactionDto.transactionNumber,
								purposeTransaction: createTransactionDto.description || '-',
								unitId: createTransactionDto.unitId,
								currencyValue: createTransactionDto.exchangeRate,
								totalBalanceUs: resultClean || 0,
								totalBalance: sumIDR,
								details: { create: newJournalDetailsMirror },
							},
							include: { details: true },
						});
					} else {
						const numberJurnalMirror = await this.createJournal(2);
						currentMirrorJournal = await tx.journalEntry.create({
							data: {
								module: 'SALES',
								date: createTransactionDto.date,
								description: `Mirror TMP: pelunasan piutang via Pusat`,
								referenceNumber: createTransactionDto.transactionNumber,
								numberJurnal: numberJurnalMirror,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: createTransactionDto.unitId,
								is_intercompany: true,
								typeJournalEntry: 'RN_EKSPOR',
								transactionId: id,
								intercompanyReference: mainJournal.numberJurnal,
								currencyValue: createTransactionDto.exchangeRate,
								totalBalanceUs: resultClean || 0,
								totalBalance: sumIDR,
								details: { create: newJournalDetailsMirror },
							},
							include: { details: true },
						});
					}
				} else if (mirrorJournal) {
					// no longer intercompany -> remove the stale mirror journal and its pending suggestions
					await tx.journalAdjustmentSuggestion.deleteMany({ where: { journalEntryId: mirrorJournal.id } });
					await tx.journalEntryDetail.deleteMany({ where: { journalEntryId: mirrorJournal.id } });
					await tx.journalEntry.delete({ where: { id: mirrorJournal.id } });
					currentMirrorJournal = null;
				}

				// ─── Diff & pending adjustment suggestions (same pattern as updateCashOutFlow) ───
				const detailChanges = this.computeJournalDiff(mainJournal, dataJurnalDetails);
				const mirrorChanges = currentMirrorJournal ? this.computeJournalDiff(mirrorJournal, newJournalDetailsMirror) : [];

				await tx.journalAdjustmentSuggestion.deleteMany({ where: { journalEntryId: mainJournal.id, status: 'PENDING' } });
				if (detailChanges.length > 0) {
					await tx.journalAdjustmentSuggestion.create({
						data: {
							journalEntryId: mainJournal.id,
							transactionId: id,
							status: 'PENDING',
							changes: {
								fields: detailChanges,
								snapshot: {
									isIntercompany,
									wasIntercompany,
									dataJurnalDetails,
									unitId: bankAccount.unitId,
									bankUnitId: bankAccount.unitId,
									amount: sumIDR,
									jumlahBayar: resultClean,
									date: createTransactionDto.date,
									description: createTransactionDto.description,
									transactionNumber: createTransactionDto.transactionNumber,
									mirrorJournalId: currentMirrorJournal?.id ?? null,
								},
							} as any,
						},
					});
				}

				if (currentMirrorJournal && mirrorChanges.length > 0) {
					await tx.journalAdjustmentSuggestion.deleteMany({
						where: { journalEntryId: currentMirrorJournal.id, status: 'PENDING' },
					});
					await tx.journalAdjustmentSuggestion.create({
						data: {
							journalEntryId: currentMirrorJournal.id,
							transactionId: id,
							status: 'PENDING',
							changes: {
								fields: mirrorChanges,
								snapshot: {
									isIntercompany,
									wasIntercompany,
									newJournalDetailsMirror,
									unitId: createTransactionDto.unitId,
									bankUnitId: bankAccount.unitId,
									amount: sumIDR,
									jumlahBayar: resultClean,
									date: createTransactionDto.date,
									description: createTransactionDto.description,
									transactionNumber: createTransactionDto.transactionNumber,
									mirrorJournalId: currentMirrorJournal?.id ?? null,
								},
							} as any,
						},
					});
				}

				// FIX: always return a well-formed response — original fell through to `undefined`
				// whenever allChanges.length was 0.
				return {
					id,
					journalId: mainJournal.id,
					journalNumber: mainJournal.numberJurnal,
					hasChanges: detailChanges.length > 0 || mirrorChanges.length > 0,
					journalChanges: detailChanges,
					mirrorChanges,
				};
			},
			{
				maxWait: 10000,
				timeout: 20000,
			},
		);
	}

	async createCashOutFLow(createTransactionDto: CreateCashOutFlowDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(async (tx) => {
			const numberJurnal = await this.createJournal();
			const bankAccount = await tx.bankAccount.findFirst({
				where: { id: createTransactionDto.bank_account_id },
				include: { account: true }, // akun kas/bank
			});

			if (bankAccount) {
				// Update saldo
				await tx.bankAccount.updateMany({
					where: { id: createTransactionDto.bank_account_id },
					data: {
						currentBalance: { decrement: createTransactionDto.amount || 0 },
					},
				});
			}

			//sesama unit pusat
			if (bankAccount.unitId === createTransactionDto.unitId) {
				const dataJurnalDetails = createTransactionDto.cashBankTransactionDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: item.unitId,
					credit: item.credit,
					debit: item.debit,
					description: item.keterangan,
				}));
				const transaction = await tx.cashBankTransaction.create({
					data: {
						staffId: decoded.id,
						transactionNumber: createTransactionDto.transactionNumber,
						amountInIDR: createTransactionDto.amount,
						amountOriginal: createTransactionDto.amount,
						currency: 'RP',
						unitId: bankAccount.unitId,
						date: createTransactionDto.date,
						grossAmount: createTransactionDto.amount,
						type: 'CASH_OUT',
						description: createTransactionDto.description,
						accountCode: createTransactionDto.accountCode,
						bank_account_id: bankAccount ? bankAccount.id : null,
						taxType: createTransactionDto.taxType,
						taxValue: createTransactionDto.taxValue,
						accounIdTax: createTransactionDto.accounIdTax,
						to: createTransactionDto.to,
						address: createTransactionDto.address,
						cashBankTransactionDetails: {
							create: [
								// {
								// 	accountCode: bankAccount.accountCode,
								// 	unitId: bankAccount.unitId,
								// 	accountName: bankAccount.account.name,
								// 	debit: 0,
								// 	credit: createTransactionDto.amount,
								// 	keterangan: createTransactionDto.description,
								// },
								...createTransactionDto.cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							],
						},
						journalEntry: {
							create: {
								module: 'FINANCE',
								date: createTransactionDto.date,
								description: createTransactionDto.to,
								purposeTransaction: createTransactionDto.to,
								referenceNumber: createTransactionDto.transactionNumber,
								numberJurnal: numberJurnal,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: bankAccount.unitId,
								totalBalance: createTransactionDto.amount,
								details: {
									create: [
										{
											accountCode: bankAccount.accountCode,
											unitId: bankAccount.unitId,
											debit: 0,
											description: createTransactionDto.description,
											credit: createTransactionDto.amount,
										},
										...dataJurnalDetails,
									].filter(Boolean),
									// create: dataJurnalDetails,
								},
							},
						},
					},
				});
				return transaction;
				//beda unit
			} else {
				const dataJurnalDetailsPusat = createTransactionDto.cashBankTransactionDetails.map((item) => ({
					accountCode: '8888',
					unitId: bankAccount.unitId,
					credit: item.credit,
					debit: item.debit,
					description: item.keterangan,
				}));
				const transaction = await tx.cashBankTransaction.create({
					data: {
						staffId: decoded.id,
						transactionNumber: createTransactionDto.transactionNumber,
						amountInIDR: createTransactionDto.amount,
						amountOriginal: createTransactionDto.amount,
						currency: 'RP',
						unitId: createTransactionDto.unitId,
						date: createTransactionDto.date,
						grossAmount: createTransactionDto.amount,
						type: 'CASH_OUT',
						description: createTransactionDto.description,
						accountCode: createTransactionDto.accountCode,
						bank_account_id: bankAccount ? bankAccount.id : null,
						taxType: createTransactionDto.taxType,
						taxValue: createTransactionDto.taxValue,
						accounIdTax: createTransactionDto.accounIdTax,
						to: createTransactionDto.to,
						address: createTransactionDto.address,
						cashBankTransactionDetails: {
							create: [
								{
									accountCode: bankAccount.accountCode,
									unitId: bankAccount.unitId,
									accountName: bankAccount.account.name,
									debit: 0,
									credit: createTransactionDto.amount,
									keterangan: createTransactionDto.description,
								},
								...createTransactionDto.cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							],
						},
						journalEntry: {
							create: {
								module: 'FINANCE',
								date: createTransactionDto.date,
								description: createTransactionDto.to,
								purposeTransaction: createTransactionDto.to,
								referenceNumber: createTransactionDto.transactionNumber,
								numberJurnal: numberJurnal,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: bankAccount.unitId,
								totalBalance: createTransactionDto.amount,
								details: {
									create: [
										{
											accountCode: bankAccount.accountCode,
											unitId: bankAccount.unitId,
											debit: 0,
											isTmp: true,
											credit: createTransactionDto.amount,
											description: createTransactionDto.description,
										},
										...dataJurnalDetailsPusat,
									].filter(Boolean),
									// create: dataJurnalDetailsPusat,
								},
							},
						},
					},
				});
				const numberJurnalMirror = await this.createJournal(2);
				//Mirror jurnal
				const dataJurnalDetailsMirror = createTransactionDto.cashBankTransactionDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: createTransactionDto.unitId,
					credit: item.credit,
					debit: item.debit,
					description: item.keterangan,
				}));
				await tx.journalEntry.create({
					data: {
						module: 'SALES',
						date: createTransactionDto.date,
						description: `Mirror TMP: piutang via Pusat - ${createTransactionDto.to}`,
						purposeTransaction: createTransactionDto.to,
						referenceNumber: createTransactionDto.transactionNumber,
						numberJurnal: numberJurnalMirror,
						createdBy: 'System',
						staffId: decoded.id,
						transactionId: transaction.id,
						unitId: createTransactionDto.unitId,
						is_intercompany: true,
						intercompanyReference: numberJurnal,
						totalBalance: createTransactionDto.amount,
						details: {
							// create: dataJurnalDetailsMirror,
							create: [
								{
									accountCode: '8888',
									unitId: createTransactionDto.unitId,
									debit: 0,
									debitDollar: 0,
									creditDollar: 0,
									description: 'Sesuaikan Akun',
									credit: createTransactionDto.amount,
								},
								...dataJurnalDetailsMirror,
							].filter(Boolean),
						},
					},
				});
				return transaction;
			}
		});
	}

	// =====================================================
	// POSTING KAS KELUAR (RP)
	// Mengikuti struktur jurnal createCashOutFLow()
	// =====================================================
	async postingCashOutFlow(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(async (tx) => {
			// 1. Ambil transaksi Kas Keluar (Rp), bukan Kas Keluar Material.
			const transaction = await tx.cashBankTransaction.findFirst({
				where: {
					id,
					deletedAt: null,
					type: 'CASH_OUT',
					currency: 'RP',
					isMaterial: 'N',
				},
				include: {
					bank_account: {
						include: {
							account: true,
						},
					},
					cashBankTransactionDetails: {
						where: {
							deletedAt: null,
						},
						orderBy: {
							createdAt: 'asc',
						},
					},
				},
			});

			if (!transaction) {
				throw new NotFoundException('Transaksi Kas Keluar (Rp) tidak ditemukan.');
			}

			// 2. Cegah pembuatan jurnal jika masih ada jurnal aktif.
			const existingJournal = await tx.journalEntry.findFirst({
				where: {
					transactionId: id,
					deletedAt: null,
				},
			});

			if (existingJournal) {
				throw new BadRequestException('Transaksi ini sudah memiliki jurnal aktif.');
			}

			const bankAccount = transaction.bank_account;

			if (!bankAccount) {
				throw new NotFoundException('Rekening bank transaksi tidak ditemukan.');
			}

			const amount = Number(transaction.amountInIDR || 0);
			const isSameUnit = bankAccount.unitId === transaction.unitId;

			// 3. Ambil detail transaksi.
			let transactionDetails = transaction.cashBankTransactionDetails;

			// Saat create beda unit, detail transaksi sudah menyimpan
			// satu baris rekening bank secara otomatis.
			// Baris tersebut tidak boleh diproses sebagai detail akun lagi.
			if (!isSameUnit) {
				const bankDetailIndex = transactionDetails.findIndex(
					(item) =>
						item.accountCode === bankAccount.accountCode && Number(item.debit || 0) === 0 && Number(item.credit || 0) === amount,
				);

				if (bankDetailIndex !== -1) {
					transactionDetails = transactionDetails.filter((_, index) => index !== bankDetailIndex);
				}
			}

			const numberJurnal = await this.createJournal();

			// 4. Susun detail jurnal utama sesuai pola create.
			const dataJurnalDetails = transactionDetails.map((item) => ({
				accountCode: isSameUnit ? item.accountCode : '8888',
				unitId: bankAccount.unitId,
				credit: item.credit,
				debit: item.debit,
				description: item.keterangan,
			}));

			// 5. Buat jurnal utama.
			const mainJournal = await tx.journalEntry.create({
				data: {
					module: 'FINANCE',
					date: transaction.date,
					description: transaction.to,
					purposeTransaction: transaction.to,
					referenceNumber: transaction.transactionNumber,
					numberJurnal,
					createdBy: 'System',
					staffId: transaction.staffId || decoded.id,
					transactionId: transaction.id,
					unitId: bankAccount.unitId,
					totalBalance: amount,
					details: {
						create: [
							{
								accountCode: bankAccount.accountCode,
								unitId: bankAccount.unitId,
								debit: 0,
								credit: amount,
								isTmp: !isSameUnit,
								description: transaction.description,
							},
							...dataJurnalDetails,
						],
					},
				},
			});

			// 6. Jika beda unit, buat jurnal mirror sesuai pola createCashOutFLow.
			let mirrorJournal = null;

			if (!isSameUnit) {
				const numberJurnalMirror = await this.createJournal(2);

				const dataJurnalDetailsMirror = transactionDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: transaction.unitId,
					credit: item.credit,
					debit: item.debit,
					description: item.keterangan,
				}));

				mirrorJournal = await tx.journalEntry.create({
					data: {
						module: 'SALES',
						date: transaction.date,
						description: `Mirror TMP: piutang via Pusat - ${transaction.to}`,
						purposeTransaction: transaction.to,
						referenceNumber: transaction.transactionNumber,
						numberJurnal: numberJurnalMirror,
						createdBy: 'System',
						staffId: transaction.staffId || decoded.id,
						transactionId: transaction.id,
						unitId: transaction.unitId,
						is_intercompany: true,
						intercompanyReference: numberJurnal,
						totalBalance: amount,
						details: {
							create: [
								{
									accountCode: '8888',
									unitId: transaction.unitId,
									debit: 0,
									debitDollar: 0,
									creditDollar: 0,
									credit: amount,
									description: 'Sesuaikan Akun',
								},
								...dataJurnalDetailsMirror,
							],
						},
					},
				});
			}

			return {
				transactionId: transaction.id,
				journalId: mainJournal.id,
				journalNumber: mainJournal.numberJurnal,
				mirrorJournalId: mirrorJournal?.id ?? null,
				mirrorJournalNumber: mirrorJournal?.numberJurnal ?? null,
			};
		});
	}

	// =====================================================
	// POSTING KAS KELUAR MATERIAL (RP)
	// =====================================================
	async postingCashOutFlowRawMaterial(id: string, decoded: DecodeTokenType) {
		return this.prisma.$transaction(async (tx) => {
			// Ambil transaksi beserta detail dan rekening bank.
			const transaction = await tx.cashBankTransaction.findFirst({
				where: {
					id,
					deletedAt: null,
					type: 'CASH_OUT',
					currency: 'RP',
					isMaterial: 'Y',
				},
				include: {
					bank_account: {
						include: {
							account: true,
						},
					},
					cashBankTransactionDetails: {
						where: {
							deletedAt: null,
						},
						orderBy: {
							createdAt: 'asc',
						},
					},
				},
			});

			if (!transaction) {
				throw new NotFoundException('Transaksi Kas Keluar Material (Rp) tidak ditemukan.');
			}

			// Pastikan jurnal aktif belum pernah dibuat.
			const existingJournal = await tx.journalEntry.findFirst({
				where: {
					transactionId: id,
					deletedAt: null,
				},
			});

			if (existingJournal) {
				throw new BadRequestException('Transaksi ini sudah memiliki jurnal aktif.');
			}

			const bankAccount = transaction.bank_account;

			if (!bankAccount) {
				throw new NotFoundException('Rekening bank transaksi tidak ditemukan.');
			}

			const pembayaranSekarang = Number(transaction.amountInIDR || 0);

			// Ambil nomor jurnal utama.
			const numberJurnal = await this.createJournal();

			// Susun detail jurnal sesuai aturan saat create.
			const dataJurnalDetails = transaction.cashBankTransactionDetails.map((item) => ({
				accountCode: item.accountCode,
				unitId: bankAccount.unitId,
				description: item.keterangan,
				debit: item.debit,
				credit: item.credit,
			}));

			// Buat jurnal utama.
			const mainJournal = await tx.journalEntry.create({
				data: {
					module: 'FINANCE',
					date: transaction.date,
					description: transaction.description || transaction.to,
					purposeTransaction: transaction.to,
					referenceNumber: transaction.transactionNumber,
					numberJurnal,
					createdBy: 'System',
					staffId: transaction.staffId || decoded.id,
					transactionId: transaction.id,
					unitId: bankAccount.unitId,
					totalBalance: pembayaranSekarang,

					details: {
						create: [
							{
								accountCode: bankAccount.accountCode,
								description: bankAccount.account?.name,
								unitId: bankAccount.unitId,
								debit: 0,
								credit: pembayaranSekarang,
							},
							...dataJurnalDetails,
						],
					},
				},
			});

			// Buat jurnal mirror jika unit rekening bank berbeda dengan unit transaksi.
			let mirrorJournal = null;

			if (bankAccount.unitId !== transaction.unitId) {
				const numberJurnalMirror = await this.createJournal(2);

				mirrorJournal = await tx.journalEntry.create({
					data: {
						module: 'SALES',
						date: transaction.date,
						description: transaction.description || transaction.to,
						purposeTransaction: transaction.to,
						referenceNumber: transaction.transactionNumber,
						numberJurnal: numberJurnalMirror,
						createdBy: 'System',
						staffId: transaction.staffId || decoded.id,
						transactionId: transaction.id,
						unitId: transaction.unitId,
						is_intercompany: true,
						intercompanyReference: numberJurnal,
						totalBalance: pembayaranSekarang,

						details: {
							create: [
								{
									accountCode: bankAccount.accountCode,
									description: bankAccount.account?.name,
									unitId: transaction.unitId,
									credit: pembayaranSekarang,
									debit: 0,
								},
								...transaction.cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									description: item.keterangan,
									unitId: transaction.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							],
						},
					},
				});
			}

			return {
				message: 'Posting jurnal Kas Keluar Material (Rp) berhasil.',
				transactionId: transaction.id,
				journal: mainJournal,
				mirrorJournal,
			};
		});
	}

	async findAll(query: GetTransactionDto, decoded: DecodeTokenType) {
		const {
			page = 1,
			limit = 10,
			date,
			amountInIDR,
			description,
			transactionNumber,
			type,
			grossAmount,
			typeTransaction,
			invoiceNumber,
			isNotEkspor,
			isMaterial,
		} = query;

		const skip = (page - 1) * limit;
		const take = +limit;
		let whereCondition: any = {};

		if (!(decoded.isRoot === 'Y' || decoded.isPusat)) {
			whereCondition.unitId = decoded.unitId;
		}

		if (date) {
			const start = dayjs(date).startOf('day').toDate();
			const end = dayjs(date).endOf('day').toDate();
			whereCondition.date = {
				gte: start,
				lte: end,
			};
		}

		if (invoiceNumber) {
			whereCondition = {
				...whereCondition,
				invoiceEkspor: {
					invoiceNumber: {
						contains: invoiceNumber,
						mode: 'insensitive',
					},
				},
			};
		}

		if (isMaterial) {
			whereCondition.isMaterial = isMaterial;
		}

		if (description) {
			whereCondition.description = {
				contains: description,
				mode: 'insensitive',
			};
		}

		if (transactionNumber) {
			whereCondition.transactionNumber = {
				contains: transactionNumber,
				mode: 'insensitive',
			};
		}

		if (type) {
			whereCondition.type = type;
		}

		if (isNotEkspor) {
			whereCondition.OR = [
				{
					typeTransaction: {
						notIn: ['RN_EKSPOR'],
					},
				},
				{
					typeTransaction: null,
				},
			];
		}

		if (typeTransaction) {
			whereCondition.typeTransaction = typeTransaction;
		}

		if (amountInIDR) {
			whereCondition.amountInIDR = +amountInIDR;
		}

		if (grossAmount) {
			whereCondition.grossAmount = +grossAmount;
		}

		const [data, totalData] = await this.prisma.$transaction([
			this.prisma.cashBankTransaction.findMany({
				include: {
					invoice: true,
					invoiceEkspor: true,

					// Ambil status jurnal yang terhubung dengan transaksi
					journalEntry: {
						where: {
							deletedAt: null,
						},
						select: {
							id: true,
							isPosted: true,
							is_intercompany: true,
						},
					},
				},
				skip,
				take,
				where: whereCondition,
				orderBy: {
					createdAt: 'desc',
				},
			}),

			this.prisma.cashBankTransaction.count({
				where: whereCondition,
			}),
		]);

		return {
			data,
			page: +page,
			limit: +limit,
			totalData,
			totalPages: Math.ceil(totalData / +limit),
		};
	}

	async findOne(id: string) {
		const transaction = await this.prisma.cashBankTransaction.findUnique({
			where: { id },
			include: {
				bank_account: true,
				journalEntry: {
					select: { isPosted: true, addjust: true },
				},
				unit: true,
				cashBankTransactionDetails: true,
				account: true,
				withholdingTaxes: true,
				invoiceEkspor: {
					include: {
						spb: {
							include: {
								purchaseOrder: true,
							},
						},
					},
				},
				invoice: {
					include: {
						invoiceTaxes: {
							include: {
								tax: true,
							},
						},
						spb: {
							include: {
								purchaseOrder: true,
							},
						},
					},
				},
			},
		});

		if (!transaction) {
			throw new NotFoundException('Transaksi tidak ditemukan.');
		}

		// Ambil downPayment khusus transaksi Raw Material.
		if (transaction.materialId) {
			const receipt = await this.prisma.rawMaterialReceipt.findUnique({
				where: {
					id: transaction.materialId,
				},
				select: {
					downPayment: true,
					isLunas: true,
				},
			});

			return {
				...transaction,
				downPayment: Number(receipt?.downPayment || 0),
				isLunas: receipt?.isLunas || 'N',
			};
		}

		return transaction;
	}

	// =====================================================
	// UANG MASUK BANK (RP) UPDATE TRANSACTION
	// Mendukung:
	// 1. Dengan Invoice
	// 2. Manual / Tanpa Invoice
	// =====================================================
	async update(id: string, updateTransactionDto: UpdateTransactionDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// =====================================================
				// 1. AMBIL TRANSAKSI LAMA TERLEBIH DAHULU
				// =====================================================
				const oldTransaction = await tx.cashBankTransaction.findUnique({
					where: { id },
					include: {
						journalEntry: {
							include: {
								details: true,
							},
						},
					},
				});

				if (!oldTransaction) {
					throw new BadRequestException('Transaksi tidak ditemukan cashBankTransaction');
				}

				// =====================================================
				// 2. UPDATE MANUAL / TANPA INVOICE
				// =====================================================
				if (!oldTransaction.invoiceId) {
					const typeByUnit = this.getTypeByUnitId(updateTransactionDto.unitId);
					// Validasi bank account
					const bankAccount = await this.prisma.bankAccount.findUnique({
						where: { id: updateTransactionDto.bank_account_id },
						include: { account: true },
					});

					if (!bankAccount) {
						throw new NotFoundException('Bank account not found');
					}

					// Validasi akun kas/bank
					const incomeAccount = await this.prisma.account.findFirst({
						where: { code: bankAccount.accountCode },
					});

					if (!incomeAccount) {
						throw new NotFoundException('Income account not found');
					}

					const wasIntercompany = !this.isSameUnit(oldTransaction.unitId, bankAccount.unitId);

					const isIntercompany = !this.isSameUnit(updateTransactionDto.unitId, bankAccount.unitId);

					// =====================================================
					// 2A. UPDATE SALDO BANK
					// Tambahkan nominal baru, kemudian kembalikan nominal lama
					// =====================================================
					await tx.bankAccount.update({
						where: { id: bankAccount.id },
						data: {
							currentBalance: {
								increment: updateTransactionDto.jumlahBayar || 0,
							},
						},
					});

					await tx.bankAccount.update({
						where: { id: oldTransaction.bank_account_id },
						data: {
							currentBalance: {
								decrement: oldTransaction.amountInIDR,
							},
						},
					});

					// =====================================================
					// 2B. FILTER DETAIL TRANSAKSI
					// =====================================================
					const cashBankTransactionDetails = updateTransactionDto.cashBankTransactionDetails.filter(
						(item) => item.accountCode !== null,
					);

					// =====================================================
					// 2C. UPDATE CASH BANK TRANSACTION
					// invoiceId tetap null karena transaksi ini Manual
					// =====================================================
					await tx.cashBankTransaction.update({
						where: { id },
						data: {
							amountInIDR: updateTransactionDto.jumlahBayar || 0,
							amountOriginal: updateTransactionDto.amountOriginal
								? updateTransactionDto.amountOriginal
								: updateTransactionDto.jumlahBayar,
							currency: updateTransactionDto.currency ? updateTransactionDto.currency : 'RP',
							exchangeRate: updateTransactionDto.exchangeRate,
							date: updateTransactionDto.date,
							description: updateTransactionDto.description,
							receivedFrom: updateTransactionDto.receivedFrom,
							purpose: updateTransactionDto.purpose,
							administrasiAmount: updateTransactionDto.administrasiAmount,
							bank_account_id: updateTransactionDto.bank_account_id,
							invoiceId: null,
							typeTransaction: typeByUnit,
							unitId: updateTransactionDto.unitId,
							staffId: decoded.id,
							cashBankTransactionDetails: {
								deleteMany: {
									cashBankTransactionId: id,
								},
								create: cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							},
						},
					});

					// =====================================================
					// 2D. AMBIL JURNAL UTAMA
					// =====================================================
					const journal = oldTransaction.journalEntry.find((j) => !j.is_intercompany);

					if (!journal) {
						return {
							id,
							hasChanges: false,
							journalChanges: [],
						};
					}

					// Update header jurnal utama
					// Detail jurnal tidak langsung diubah,
					// mengikuti mekanisme pending suggestion yang sudah ada.
					await tx.journalEntry.update({
						where: { id: journal.id },
						data: {
							date: updateTransactionDto.date,
							addjust: false,
							description: updateTransactionDto.description,
							referenceNumber: updateTransactionDto.transactionNumber,
							totalBalance: updateTransactionDto.jumlahBayar,
							purposeTransaction: updateTransactionDto.description || '-',
							typeJournalEntry: typeByUnit,
							unitId: bankAccount.unitId,
						},
					});

					// =====================================================
					// 2E. UPDATE HEADER MIRROR JIKA ADA
					// =====================================================
					const mirrorJournal = await tx.journalEntry.findFirst({
						where: {
							transactionId: id,
							is_intercompany: true,
						},
						include: {
							details: true,
						},
					});

					if (mirrorJournal) {
						await tx.journalEntry.update({
							where: { id: mirrorJournal.id },
							data: {
								date: updateTransactionDto.date,
								addjust: false,
								description: updateTransactionDto.description,
								referenceNumber: updateTransactionDto.transactionNumber,
								totalBalance: updateTransactionDto.jumlahBayar,
								purposeTransaction: updateTransactionDto.description || '-',
								typeJournalEntry: typeByUnit,
								unitId: updateTransactionDto.unitId,
							},
						});
					}

					// =====================================================
					// 2F. SIAPKAN DETAIL JURNAL UTAMA BARU
					// =====================================================
					const newJournalDetailsMain = [
						{
							accountCode: bankAccount.accountCode,
							unitId: bankAccount.unitId,
							debit: updateTransactionDto.jumlahBayar || 0,
							keterangan: bankAccount.bankName,
							credit: 0,
						},
						...cashBankTransactionDetails.map((item) => ({
							accountCode: item.accountCode,
							unitId: item.unitId,
							credit: item.credit,
							keterangan: item.keterangan,
							debit: item.debit,
						})),
					];

					// =====================================================
					// 2G. SIAPKAN DETAIL JURNAL MIRROR JIKA ADA
					// =====================================================
					const newJournalDetailsMirror = [
						{
							accountCode: '8888',
							unitId: bankAccount.unitId,
							debit: updateTransactionDto.jumlahBayar || 0,
							keterangan: 'Sesuaikan Akun',
							credit: 0,
						},
						...cashBankTransactionDetails.map((item) => ({
							accountCode: item.accountCode,
							unitId: item.unitId,
							credit: item.credit,
							keterangan: item.keterangan,
							debit: item.debit,
						})),
					];

					// =====================================================
					// 2H. HITUNG PERUBAHAN DETAIL JURNAL
					// =====================================================
					const detailChanges = this.computeJournalDiff(journal, newJournalDetailsMain);

					const mirrorChanges = mirrorJournal ? this.computeJournalDiff(mirrorJournal, newJournalDetailsMirror) : [];

					// Mengikuti mekanisme yang sudah ada:
					// perubahan jurnal utama menjadi hasil utama.
					const allChanges = detailChanges;

					// =====================================================
					// 2I. SIMPAN PENDING SUGGESTION JURNAL UTAMA
					// =====================================================
					if (allChanges.length > 0) {
						await tx.journalAdjustmentSuggestion.deleteMany({
							where: {
								journalEntryId: journal.id,
								status: 'PENDING',
							},
						});

						await tx.journalAdjustmentSuggestion.create({
							data: {
								journalEntryId: journal.id,
								transactionId: id,
								status: 'PENDING',
								changes: {
									fields: allChanges,
									snapshot: {
										isIntercompany,
										wasIntercompany,
										newJournalDetailsMain,
										unitId: bankAccount.unitId,
										bankUnitId: bankAccount.unitId,
										amount: updateTransactionDto.amount,
										jumlahBayar: updateTransactionDto.jumlahBayar,
										date: updateTransactionDto.date,
										description: updateTransactionDto.description,
										transactionNumber: updateTransactionDto.transactionNumber,
										mirrorJournalId: mirrorJournal?.id ?? null,
									},
								} as any,
							},
						});
					}

					// =====================================================
					// 2J. SIMPAN PENDING SUGGESTION MIRROR JIKA ADA
					// =====================================================
					if (mirrorJournal && mirrorChanges.length > 0 && updateTransactionDto.unitId !== bankAccount.unitId) {
						await tx.journalAdjustmentSuggestion.deleteMany({
							where: {
								journalEntryId: mirrorJournal.id,
								status: 'PENDING',
							},
						});

						await tx.journalAdjustmentSuggestion.create({
							data: {
								journalEntryId: mirrorJournal.id,
								transactionId: id,
								status: 'PENDING',
								changes: {
									fields: mirrorChanges,
									snapshot: {
										isIntercompany,
										wasIntercompany,
										newJournalDetailsMirror,
										unitId: updateTransactionDto.unitId,
										bankUnitId: bankAccount.unitId,
										amount: updateTransactionDto.amount,
										jumlahBayar: updateTransactionDto.jumlahBayar,
										date: updateTransactionDto.date,
										description: updateTransactionDto.description,
										transactionNumber: updateTransactionDto.transactionNumber,
										mirrorJournalId: mirrorJournal.id,
									},
								} as any,
							},
						});
					}

					// =====================================================
					// 2K. RETURN UPDATE MANUAL
					// =====================================================
					return {
						id,
						journalId: journal.id,
						journalNumber: journal.numberJurnal,
						hasChanges: allChanges.length > 0,
						journalChanges: allChanges,
					};
				}

				// =====================================================
				// 3. UPDATE DENGAN INVOICE
				// =====================================================
				// BAGIAN INVOICE DI BAWAH INI DIPERTAHANKAN
				// SESUAI KODE UPDATE INVOICE SEBELUMNYA.
				// =====================================================

				const invoice = await tx.invoice.findUnique({
					where: { id: updateTransactionDto.invoiceId },
					include: {
						invoiceTaxes: true, // Mengambil pajak terkait transaksi
						spb: {
							include: {
								purchaseOrder: {
									include: {
										customer: true,
									},
								},
							},
						},
					},
				});

				if (!invoice) {
					throw new Error('Invoice tidak ditemukan');
				}

				// Validasi bank account dan akun kas
				const bankAccount = await this.prisma.bankAccount.findUnique({
					where: { id: updateTransactionDto.bank_account_id },
					include: { account: true }, // akun kas/bank
				});

				if (!bankAccount) {
					throw new NotFoundException('Bank account not found');
				}

				const wasIntercompany = !this.isSameUnit(oldTransaction.unitId, bankAccount.unitId);

				const isIntercompany = !this.isSameUnit(updateTransactionDto.unitId, bankAccount.unitId);

				// ─── 2. apply saldo bank ────────────────────────
				await tx.bankAccount.update({
					where: { id: bankAccount.id },
					data: {
						currentBalance: {
							increment: updateTransactionDto.jumlahBayar || 0,
						},
					},
				});

				// Reverse
				await tx.bankAccount.update({
					where: { id: oldTransaction.bank_account_id },
					data: {
						currentBalance: {
							decrement: oldTransaction.amountInIDR,
						},
					},
				});

				// Temukan akun pendapatan jasa
				const incomeAccount = await this.prisma.account.findFirst({
					where: { code: bankAccount.accountCode },
				});

				if (!incomeAccount) {
					throw new NotFoundException('Income account not found');
				}

				const cashBankTransactionDetails = updateTransactionDto.cashBankTransactionDetails.filter(
					(item) => item.accountCode !== null,
				);

				await tx.cashBankTransaction.update({
					where: { id },
					data: {
						amountInIDR: updateTransactionDto.jumlahBayar || 0,
						amountOriginal: updateTransactionDto.amountOriginal
							? updateTransactionDto.amountOriginal
							: updateTransactionDto.jumlahBayar,
						currency: updateTransactionDto.currency ? updateTransactionDto.currency : 'RP',
						exchangeRate: updateTransactionDto.exchangeRate,
						date: updateTransactionDto.date,
						description: updateTransactionDto.description,
						receivedFrom: updateTransactionDto.receivedFrom,
						purpose: updateTransactionDto.purpose,
						administrasiAmount: updateTransactionDto.administrasiAmount,
						bank_account_id: updateTransactionDto.bank_account_id,
						invoiceId: updateTransactionDto.invoiceId,
						unitId: updateTransactionDto.unitId,
						staffId: decoded.id,
						cashBankTransactionDetails: {
							deleteMany: { cashBankTransactionId: id },
							create: [
								...cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							],
						},
					},
				});

				const journal = oldTransaction.journalEntry.find((j) => !j.is_intercompany);

				if (!journal) {
					return {
						id,
						hasChanges: false,
						journalChanges: [],
					};
				}

				await tx.journalEntry.update({
					where: { id: journal.id },
					data: {
						date: updateTransactionDto.date,
						addjust: false,
						description: updateTransactionDto.description,
						referenceNumber: updateTransactionDto.transactionNumber,
						totalBalance: updateTransactionDto.jumlahBayar,
						purposeTransaction: updateTransactionDto.description || '-',
						unitId: bankAccount.unitId,
						// details TIDAK disentuh di sini
					},
				});

				// Update header mirror juga jika ada
				const mirrorJournal = await tx.journalEntry.findFirst({
					where: { transactionId: id, is_intercompany: true },
					include: { details: true },
				});

				if (mirrorJournal) {
					await tx.journalEntry.update({
						where: { id: mirrorJournal.id },
						data: {
							date: updateTransactionDto.date,
							addjust: false,
							description: updateTransactionDto.description,
							referenceNumber: updateTransactionDto.transactionNumber,
							totalBalance: updateTransactionDto.jumlahBayar,
							purposeTransaction: updateTransactionDto.description || '-',
							unitId: updateTransactionDto.unitId,
							// details TIDAK disentuh di sini
						},
					});
				}

				// ─── 6. Hitung diff details untuk ditampilkan ke user ─────
				const newJournalDetailsMain = [
					{
						accountCode: bankAccount.accountCode,
						unitId: bankAccount.unitId,
						debit: updateTransactionDto.jumlahBayar || 0,
						keterangan: bankAccount.bankName,
						credit: 0,
					},
					...cashBankTransactionDetails.map((item) => ({
						accountCode: item.accountCode,
						unitId: item.unitId,
						credit: item.credit,
						keterangan: item.keterangan,
						debit: item.debit,
					})),
				];

				const newJournalDetailsMirror = [
					{
						accountCode: '8888',
						unitId: bankAccount.unitId,
						debit: updateTransactionDto.amount,
						keterangan: 'Sesuaikan Akun',
						credit: 0,
					},
					...cashBankTransactionDetails.map((item) => ({
						accountCode: item.accountCode,
						unitId: item.unitId,
						credit: item.credit,
						keterangan: item.keterangan,
						debit: item.debit,
					})),
				];

				const detailChanges = this.computeJournalDiff(journal, newJournalDetailsMain);

				const mirrorChanges = this.computeJournalDiff(mirrorJournal, newJournalDetailsMirror);

				const allChanges = detailChanges;

				// ─── 7. Simpan pending suggestion (hanya details) ─────────
				if (allChanges.length > 0) {
					await tx.journalAdjustmentSuggestion.deleteMany({
						where: { journalEntryId: journal.id, status: 'PENDING' },
					});

					await tx.journalAdjustmentSuggestion.create({
						data: {
							journalEntryId: journal.id,
							transactionId: id,
							status: 'PENDING',
							changes: {
								fields: allChanges,
								snapshot: {
									isIntercompany,
									wasIntercompany,
									newJournalDetailsMain,
									unitId: bankAccount.unitId,
									bankUnitId: bankAccount.unitId,
									amount: updateTransactionDto.amount,
									jumlahBayar: updateTransactionDto.jumlahBayar,
									date: updateTransactionDto.date,
									description: updateTransactionDto.description,
									transactionNumber: updateTransactionDto.transactionNumber,
									mirrorJournalId: mirrorJournal?.id ?? null,
								},
							} as any,
						},
					});
				}

				// ─── 7. Simpan pending suggestion (hanya details) ─────────
				if (mirrorChanges.length > 0 && updateTransactionDto.unitId !== bankAccount.unitId) {
					await tx.journalAdjustmentSuggestion.deleteMany({
						where: { journalEntryId: mirrorJournal.id, status: 'PENDING' },
					});

					await tx.journalAdjustmentSuggestion.create({
						data: {
							journalEntryId: mirrorJournal.id,
							transactionId: id,
							status: 'PENDING',
							changes: {
								fields: mirrorChanges,
								snapshot: {
									isIntercompany,
									wasIntercompany,
									newJournalDetailsMirror,
									unitId: updateTransactionDto.unitId,
									bankUnitId: bankAccount.unitId,
									amount: updateTransactionDto.amount,
									jumlahBayar: updateTransactionDto.jumlahBayar,
									date: updateTransactionDto.date,
									description: updateTransactionDto.description,
									transactionNumber: updateTransactionDto.transactionNumber,
									mirrorJournalId: mirrorJournal?.id ?? null,
								},
							} as any,
						},
					});
				}

				return {
					id,
					journalId: journal.id,
					journalNumber: journal.numberJurnal,
					hasChanges: allChanges.length > 0,
					journalChanges: allChanges,
				};
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async updateActionAccess(id: string, isActionEnabled: boolean, decoded: DecodeTokenType) {
		const allowedUserIds = ['8c6a2b36-43f2-4020-b06c-1f6ff0914b99', 'dd54ff73-599f-4bfd-8b70-0e861ee49b30'];

		if (!allowedUserIds.includes(decoded.id)) {
			throw new ForbiddenException('Anda tidak memiliki akses untuk mengubah status transaksi.');
		}

		if (typeof isActionEnabled !== 'boolean') {
			throw new BadRequestException('isActionEnabled harus berupa boolean.');
		}

		const transaction = await this.prisma.cashBankTransaction.findFirst({
			where: {
				id,
				type: {
					in: ['CASH_IN', 'CASH_OUT'],
				},
				deletedAt: null,
			},
		});

		if (!transaction) {
			throw new NotFoundException('Transaksi uang masuk tidak ditemukan.');
		}

		return this.prisma.cashBankTransaction.update({
			where: { id },
			data: { isActionEnabled },
			select: {
				id: true,
				isActionEnabled: true,
			},
		});
	}

	// =====================================================
	// UANG MASUK BANK (RP) REMOVE TRANSACTION
	// Mendukung:
	// 1. Dengan Invoice
	// 2. Manual / Tanpa Invoice
	// =====================================================

	async remove(id: string) {
		return this.prisma.$transaction(
			async (tx) => {
				const existing = await tx.cashBankTransaction.findFirstOrThrow({
					where: { id },
					include: {
						journalEntry: { include: { details: true } },
						cashBankTransactionDetails: true,
					},
				});

				const mainJournal = existing.journalEntry.find((j) => !j.is_intercompany);
				const mirrorJournal = existing.journalEntry.find((j) => j.is_intercompany);

				if (!mainJournal) {
					throw new BadRequestException('Jurnal utama tidak ditemukan.');
				}

				if (mainJournal.isPosted) {
					throw new BadRequestException('Jurnal utama sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
				}

				if (mirrorJournal?.isPosted) {
					throw new BadRequestException('Jurnal mirror unit sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
				}

				// =====================================================
				// REVERSE SALDO BANK
				// =====================================================
				if (existing.bank_account_id) {
					if (existing.currency === 'DOLLAR') {
						// Kembalikan saldo Rupiah dan Dollar
						await tx.bankAccount.update({
							where: { id: existing.bank_account_id },
							data: {
								currentBalance: {
									decrement: existing.amountInIDR || 0,
								},
								currentBalanceDollar: {
									decrement: existing.amountOriginal || 0,
								},
							},
						});
					} else {
						// Mekanisme transaksi Rupiah tetap seperti sebelumnya
						await tx.bankAccount.update({
							where: { id: existing.bank_account_id },
							data: {
								currentBalance: {
									decrement: existing.amountInIDR || 0,
								},
							},
						});
					}
				}

				// =====================================================
				// REVERSE PEMBAYARAN INVOICE EKSPOR (DOLLAR)
				// =====================================================
				if (existing.currency === 'DOLLAR' && existing.invoiceEksporId) {
					const invoice = await tx.invoiceEkspor.findUnique({
						where: { id: existing.invoiceEksporId },
					});

					if (!invoice) {
						throw new NotFoundException('Invoice ekspor tidak ditemukan.');
					}

					// Kurangi pembayaran dari transaksi yang dihapus
					const remainingPayment = Number(invoice.donePayment || 0) - Number(existing.amountOriginal || 0);

					const donePayment = Math.max(0, remainingPayment);

					await tx.invoiceEkspor.update({
						where: { id: existing.invoiceEksporId },
						data: {
							donePayment,
							status: donePayment >= Number(invoice.totalCIF) ? 'LUNAS' : 'HUTANG',
						},
					});
				}

				// =====================================================
				// HAPUS JURNAL DAN DETAIL
				// =====================================================
				await tx.journalAdjustmentSuggestion.deleteMany({
					where: { transactionId: id },
				});

				await tx.journalEntryDetail.deleteMany({
					where: { journalEntryId: mainJournal.id },
				});

				await tx.journalEntry.delete({
					where: { id: mainJournal.id },
				});

				if (mirrorJournal) {
					await tx.journalEntryDetail.deleteMany({
						where: { journalEntryId: mirrorJournal.id },
					});

					await tx.journalEntry.delete({
						where: { id: mirrorJournal.id },
					});
				}

				// Hapus detail transaksi
				await tx.cashBankTransactionDetails.deleteMany({
					where: { cashBankTransactionId: id },
				});

				// Soft delete transaksi utama
				return tx.cashBankTransaction.update({
					where: { id },
					data: {
						deletedAt: nowWIBString(),
						transactionNumber: crypto.randomUUID(),
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async removeCashOutFlowRawMaterial(id: string) {
		return this.prisma.$transaction(
			async (tx) => {
				// 1. Ambil transaksi yang akan dihapus.
				const existing = await tx.cashBankTransaction.findFirstOrThrow({
					where: {
						id,
						type: 'CASH_OUT',
						currency: 'RP',
						isMaterial: 'Y',
						deletedAt: null,
					},
					include: {
						journalEntry: { include: { details: true } },
						cashBankTransactionDetails: true,
					},
				});

				// 2. Pastikan jurnal utama dan mirror tidak terposting.
				const mainJournal = existing.journalEntry.find((j) => !j.is_intercompany);
				const mirrorJournal = existing.journalEntry.find((j) => j.is_intercompany);

				if (!mainJournal) {
					throw new BadRequestException('Jurnal utama tidak ditemukan.');
				}

				if (mainJournal.isPosted) {
					throw new BadRequestException('Jurnal utama sudah terpost, tidak dapat dihapus. Revert dulu (Jurnal Khusus).');
				}

				if (mirrorJournal?.isPosted) {
					throw new BadRequestException('Jurnal mirror unit sudah terpost, tidak dapat dihapus. Revert dulu (Jurnal Khusus).');
				}

				// 3. Kembalikan saldo rekening bank.
				if (existing.bank_account_id) {
					await tx.bankAccount.update({
						where: { id: existing.bank_account_id },
						data: {
							currentBalance: {
								increment: Number(existing.amountInIDR || 0),
							},
						},
					});
				}

				// 4. Hitung ulang pembayaran material setelah transaksi dihapus.
				if (existing.materialId) {
					// Ambil transaksi pembayaran material lain yang masih aktif.
					const transaksiPembayaran = await tx.cashBankTransaction.findMany({
						where: {
							materialId: existing.materialId,
							type: 'CASH_OUT',
							currency: 'RP',
							isMaterial: 'Y',
							deletedAt: null,
							id: {
								not: id,
							},
						},
						select: {
							cashBankTransactionDetails: {
								where: {
									deletedAt: null,
								},
								orderBy: {
									createdAt: 'asc',
								},
								take: 1,
								select: {
									debit: true,
								},
							},
						},
					});

					// Akumulasi hanya debit baris pertama (pembayaran material).
					const totalPembayaran = transaksiPembayaran.reduce(
						(total, transaksi) => total + Number(transaksi.cashBankTransactionDetails[0]?.debit || 0),
						0,
					);

					// grossAmount mengikuti create: total tagihan material.
					const totalTagihan = Number(existing.grossAmount || 0);

					// Perbarui akumulasi pembayaran dan status pelunasan.
					await tx.rawMaterialReceipt.update({
						where: {
							id: existing.materialId,
						},
						data: {
							downPayment: totalPembayaran,
							isLunas: totalPembayaran >= totalTagihan ? 'Y' : 'N',
						},
					});
				}

				// 5. Hapus saran jurnal terkait transaksi.
				await tx.journalAdjustmentSuggestion.deleteMany({
					where: { transactionId: id },
				});

				// 6. Hapus detail jurnal utama.
				await tx.journalEntryDetail.deleteMany({
					where: { journalEntryId: mainJournal.id },
				});

				await tx.journalEntry.delete({
					where: { id: mainJournal.id },
				});

				// 7. Hapus jurnal mirror jika tersedia.
				if (mirrorJournal) {
					await tx.journalEntryDetail.deleteMany({
						where: { journalEntryId: mirrorJournal.id },
					});

					await tx.journalEntry.delete({
						where: { id: mirrorJournal.id },
					});
				}

				// 8. Hapus detail transaksi kas keluar.
				await tx.cashBankTransactionDetails.deleteMany({
					where: { cashBankTransactionId: id },
				});

				// 9. Soft delete transaksi.
				return tx.cashBankTransaction.update({
					where: { id },
					data: {
						deletedAt: nowWIBString(),
						transactionNumber: crypto.randomUUID(),
					},
				});
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	async patchCashOutFlow(id: string, updateDto: CreateCashOutFlowDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(async (tx) => {
			// Ambil data lama untuk hitung selisih saldo & update jurnal
			const oldTransaction = await tx.cashBankTransaction.findUnique({
				where: { id },
			});

			if (!oldTransaction) {
				throw new BadRequestException('Transaksi tidak ditemukan cashBankTransaction');
			}

			const bankAccount = await tx.bankAccount.findFirst({
				where: { id: updateDto.bank_account_id },
				include: { account: true }, // akun kas/bank
			});

			if (!bankAccount) {
				throw new BadRequestException('Transaksi tidak ditemukan bankAccount');
			}

			// 2. Reverse & apply saldo bank
			await tx.bankAccount.update({
				where: { id: oldTransaction.bank_account_id },
				data: { currentBalance: { increment: oldTransaction.amountInIDR } },
			});
			await tx.bankAccount.update({
				where: { id: bankAccount.id },
				data: { currentBalance: { decrement: updateDto.amount } },
			});

			await tx.cashBankTransaction.update({
				where: { id },
				data: {
					amountInIDR: updateDto.amount,
					amountOriginal: updateDto.amount,
					unitId: updateDto.unitId,
					date: updateDto.date,
					grossAmount: updateDto.amount,
					type: 'CASH_OUT',
					description: updateDto.description,
					accountCode: updateDto.accountCode,
					bank_account_id: updateDto.bank_account_id,
					address: updateDto.address,
					to: updateDto.to,
					cashBankTransactionDetails: {
						deleteMany: {},
						create: [
							{
								accountCode: bankAccount.accountCode,
								unitId: bankAccount.unitId,
								accountName: bankAccount.account.name,
								debit: 0,
								credit: updateDto.amount,
								keterangan: updateDto.description,
							},
							...updateDto.cashBankTransactionDetails.map((item) => ({
								accountCode: item.accountCode,
								accountName: item.accountName,
								keterangan: item.keterangan,
								unitId: item.unitId,
								credit: item.credit,
								debit: item.debit,
							})),
						],
					},
				},
			});
		});
	}

	async createCashOutFLowRawMaterial(createTransactionDto: CreateCashOutFlowDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				// =====================================================
				// MODE MANUAL: KAS KELUAR MATERIAL TANPA PENERIMAAN MATERIAL
				// =====================================================
				if (!createTransactionDto.materialId) {
					const bankAccount = await tx.bankAccount.findUnique({
						where: {
							id: createTransactionDto.bank_account_id,
						},
						include: {
							account: true,
						},
					});

					if (!bankAccount) {
						throw new NotFoundException('Bank account tidak ditemukan.');
					}

					const numberJurnalManual = await this.createJournal();

					const payAmount = Number(createTransactionDto.payAmount || 0);

					// Ambil detail jurnal yang memiliki COA.
					const cashBankTransactionDetails = (createTransactionDto.cashBankTransactionDetails || []).filter((item) =>
						Boolean(item.accountCode),
					);

					// Kurangi saldo rekening bank.
					await tx.bankAccount.update({
						where: {
							id: bankAccount.id,
						},
						data: {
							currentBalance: {
								decrement: payAmount,
							},
						},
					});

					// Detail jurnal utama.
					const dataJurnalDetails = cashBankTransactionDetails.map((item) => ({
						accountCode: item.accountCode,
						unitId: bankAccount.unitId,
						description: item.keterangan,
						debit: item.debit,
						credit: item.credit,
					}));

					// Simpan transaksi manual.
					const transaction = await tx.cashBankTransaction.create({
						data: {
							staffId: decoded.id,
							transactionNumber: createTransactionDto.transactionNumber,

							amountInIDR: payAmount,
							amountOriginal: payAmount,
							currency: 'RP',
							unitId: createTransactionDto.unitId,
							date: createTransactionDto.date,
							grossAmount: payAmount,
							type: 'CASH_OUT',
							isMaterial: 'Y',
							description: createTransactionDto.description,
							accountCode: createTransactionDto.accountCode || null,
							bank_account_id: bankAccount.id,
							to: createTransactionDto.to,
							address: createTransactionDto.address,

							cashBankTransactionDetails: {
								create: cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: bankAccount.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							},

							journalEntry: {
								create: {
									module: 'FINANCE',
									date: createTransactionDto.date,
									description: createTransactionDto.description || createTransactionDto.to,
									purposeTransaction: createTransactionDto.to,
									referenceNumber: createTransactionDto.transactionNumber,
									numberJurnal: numberJurnalManual,
									createdBy: 'System',
									staffId: decoded.id,
									unitId: bankAccount.unitId,
									totalBalance: payAmount,

									details: {
										create: [
											{
												accountCode: bankAccount.accountCode,
												description: bankAccount.account?.name,
												unitId: bankAccount.unitId,
												debit: 0,
												credit: payAmount,
											},
											...dataJurnalDetails,
										],
									},
								},
							},
						},
					});

					// Buat jurnal mirror jika unit rekening bank berbeda
					// dengan unit transaksi.
					if (bankAccount.unitId !== createTransactionDto.unitId) {
						const numberJurnalMirror = await this.createJournal(2);

						await tx.journalEntry.create({
							data: {
								module: 'SALES',
								date: createTransactionDto.date,
								description: createTransactionDto.description || createTransactionDto.to,
								purposeTransaction: createTransactionDto.to,
								referenceNumber: createTransactionDto.transactionNumber,
								numberJurnal: numberJurnalMirror,
								createdBy: 'System',
								staffId: decoded.id,
								transactionId: transaction.id,
								unitId: createTransactionDto.unitId,
								is_intercompany: true,
								intercompanyReference: numberJurnalManual,
								totalBalance: payAmount,

								details: {
									create: [
										{
											accountCode: bankAccount.accountCode,
											description: bankAccount.account?.name,
											unitId: createTransactionDto.unitId,
											credit: payAmount,
											debit: 0,
										},
										...cashBankTransactionDetails.map((item) => ({
											accountCode: item.accountCode,
											description: item.keterangan,
											unitId: createTransactionDto.unitId,
											credit: item.credit,
											debit: item.debit,
										})),
									],
								},
							},
						});
					}

					return transaction;
				}

				// =====================================================
				// MODE MATERIAL: KAS KELUAR MATERIAL DARI PENERIMAAN
				// =====================================================

				// Ambil akun bank berdasarkan accountCode.
				const bankAccount = await tx.bankAccount.findFirst({
					where: {
						accountCode: createTransactionDto.BankaccountCode,
					},
					include: {
						account: true,
					},
				});

				if (!bankAccount) {
					throw new NotFoundException('Bank account tidak ditemukan.');
				}

				// Ambil data penerimaan material.
				const dataRaw = await tx.rawMaterialReceipt.findUnique({
					where: {
						id: createTransactionDto.materialId,
					},
					include: {
						items: {
							where: {
								deletedAt: null,
							},
						},
					},
				});

				if (!dataRaw) {
					throw new NotFoundException('Data penerimaan barang mentah tidak ditemukan.');
				}

				// Hitung total tagihan penerimaan material dari RawMaterialReceiptItem.
				const totalTagihan = dataRaw.items.reduce((total, item) => total + Number(item.Total || 0), 0);

				if (totalTagihan <= 0) {
					throw new BadRequestException('Jumlah transaksi tidak valid.');
				}

				// Ambil detail transaksi dari frontend.
				const detailTransaksi = createTransactionDto.cashBankTransactionDetails || [];

				// Ambil debit baris pertama sebagai pembayaran material.
				const debitBarisPertama = Number(detailTransaksi[0]?.debit || 0);

				// Ambil detail jurnal yang memiliki COA.
				const cashBankTransactionDetails = detailTransaksi.filter((item) => Boolean(item.accountCode));

				// Ambil seluruh transaksi pembayaran material yang masih aktif.
				const transaksiPembayaran = await tx.cashBankTransaction.findMany({
					where: {
						materialId: createTransactionDto.materialId,
						type: 'CASH_OUT',
						currency: 'RP',
						isMaterial: 'Y',
						deletedAt: null,
					},
					include: {
						cashBankTransactionDetails: {
							where: {
								deletedAt: null,
							},
							orderBy: {
								createdAt: 'asc',
							},
						},
					},
				});

				// Hitung akumulasi pembayaran sebelumnya dari debit baris pertama.
				const pembayaranSebelumnya = transaksiPembayaran.reduce(
					(total, transaksi) => total + Number(transaksi.cashBankTransactionDetails[0]?.debit || 0),
					0,
				);

				// Total uang kas keluar.
				const pembayaranSekarang = Number(createTransactionDto.payAmount);

				if (!Number.isFinite(pembayaranSekarang) || pembayaranSekarang <= 0) {
					throw new BadRequestException('Jumlah pembayaran harus lebih dari 0.');
				}

				// Validasi debit baris pertama.
				if (!Number.isFinite(debitBarisPertama) || debitBarisPertama <= 0) {
					throw new BadRequestException('Debit pembayaran material harus lebih dari 0.');
				}

				// Pastikan total uang keluar bank tidak lebih kecil dari pembayaran material.
				if (pembayaranSekarang < debitBarisPertama) {
					throw new BadRequestException('Total pembayaran tidak boleh lebih kecil dari debit pembayaran material.');
				}

				// Hitung akumulasi pembayaran material.
				const totalPembayaran = pembayaranSebelumnya + debitBarisPertama;

				// Hitung sisa pembayaran material.
				const sisaTagihan = totalTagihan - pembayaranSebelumnya;

				// Tolak jika pembayaran melebihi nilai material.
				if (totalPembayaran > totalTagihan) {
					throw new BadRequestException(`Pembayaran melebihi nilai material. Sisa pembayaran: ${sisaTagihan}`);
				}

				const isLunas = totalPembayaran >= totalTagihan;

				// Buat nomor jurnal setelah validasi pembayaran berhasil.
				const numberJurnal = await this.createJournal();

				// Kurangi saldo rekening bank setelah validasi berhasil.
				await tx.bankAccount.update({
					where: {
						id: bankAccount.id,
					},
					data: {
						currentBalance: {
							decrement: pembayaranSekarang,
						},
					},
				});

				// Update pembayaran penerimaan material.
				await tx.rawMaterialReceipt.update({
					where: {
						id: createTransactionDto.materialId,
					},
					data: {
						downPayment: totalPembayaran,
						isLunas: isLunas ? 'Y' : 'N',
					},
				});

				// Simpan transaksi kas keluar material.
				const transaction = await tx.cashBankTransaction.create({
					data: {
						staffId: decoded.id,
						transactionNumber: createTransactionDto.transactionNumber,
						materialId: createTransactionDto.materialId,
						amountInIDR: pembayaranSekarang,
						amountOriginal: pembayaranSekarang,
						currency: 'RP',
						unitId: createTransactionDto.unitId,
						date: createTransactionDto.date,
						grossAmount: totalTagihan,
						type: 'CASH_OUT',
						isMaterial: 'Y',
						description: createTransactionDto.description,
						accountCode: createTransactionDto.accountCode,
						bank_account_id: bankAccount.id,
						accounIdTax: createTransactionDto.accounIdTax,
						to: createTransactionDto.to,
						address: createTransactionDto.address,

						cashBankTransactionDetails: {
							create: [
								// Detail transaksi sesuai input frontend.
								...cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: bankAccount.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							],
						},

						journalEntry: {
							create: {
								module: 'FINANCE',
								date: createTransactionDto.date,
								description: createTransactionDto.description || createTransactionDto.to,
								purposeTransaction: createTransactionDto.to,
								referenceNumber: createTransactionDto.transactionNumber,
								numberJurnal: numberJurnal,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: bankAccount.unitId,
								totalBalance: pembayaranSekarang,

								details: {
									create: [
										{
											accountCode: bankAccount.accountCode,
											description: bankAccount.account?.name,
											unitId: bankAccount.unitId,
											debit: 0,
											credit: pembayaranSekarang,
										},
										...cashBankTransactionDetails.map((item) => ({
											accountCode: item.accountCode,
											unitId: bankAccount.unitId,
											description: item.keterangan,
											credit: item.credit,
											debit: item.debit,
										})),
									],
								},
							},
						},
					},
				});

				// Buat jurnal mirror jika unit rekening bank berbeda
				// dengan unit transaksi.
				if (bankAccount.unitId !== createTransactionDto.unitId) {
					const numberJurnalMirror = await this.createJournal(2);

					// Mirror jurnal.
					await tx.journalEntry.create({
						data: {
							module: 'SALES',
							date: createTransactionDto.date,
							description: createTransactionDto.description || createTransactionDto.to,
							purposeTransaction: createTransactionDto.to,
							referenceNumber: createTransactionDto.transactionNumber,
							numberJurnal: numberJurnalMirror,
							createdBy: 'System',
							staffId: decoded.id,
							transactionId: transaction.id,
							unitId: createTransactionDto.unitId,
							is_intercompany: true,
							intercompanyReference: numberJurnal,
							totalBalance: pembayaranSekarang,

							details: {
								create: [
									{
										accountCode: bankAccount.accountCode,
										description: bankAccount.account?.name,
										unitId: createTransactionDto.unitId,
										credit: pembayaranSekarang,
										debit: 0,
									},
									...cashBankTransactionDetails.map((item) => ({
										accountCode: item.accountCode,
										description: item.keterangan,
										unitId: createTransactionDto.unitId,
										credit: item.credit,
										debit: item.debit,
									})),
								],
							},
						},
					});
				}

				return transaction;
			},
			{
				maxWait: 10000,
				timeout: 15000,
			},
		);
	}

	private isSameUnit(userUnitId: string, bankUnitId: string): boolean {
		return userUnitId === bankUnitId;
	}

	private computeJournalDiff(
		oldEntry: any & { details: any[] },
		newDetails: any[],

		// ← tambah parameter in
	): any[] {
		const changes: any[] = []; // Diff details — pakai newDetails bukan hitung ulang dari dto
		oldEntry?.details?.forEach((old, i) => {
			const next = newDetails[i];
			if (!next) {
				changes.push({
					field: `details[${i}]`,
					label: `Baris ${i + 1} (${old.accountCode}) — dihapus`,
					oldValue: { debit: old.debit, credit: old.credit },
					newValue: null,
				});
				return;
			}

			if (old.description !== next.description) {
				changes.push({
					field: `details[${i}].description`,
					label: `Baris ${i + 1} — Keterangan`,
					oldValue: old.description || old.keterangan,
					newValue: next.keterangan || next.description,
				});
			}
			if (old.debit !== next.debit || old.credit !== next.credit) {
				changes.push({
					field: `details[${i}].amount`,
					label: `Baris ${i + 1} — Nominal`,
					oldValue: { debit: old.debit, credit: old.credit },
					newValue: { debit: next.debit, credit: next.credit },
				});
			}
			if (old.accountCode !== next.accountCode) {
				changes.push({
					field: `details[${i}].accountCode`,
					label: `Baris ${i + 1} — Kode Akun`,
					oldValue: old.accountCode,
					newValue: next.accountCode,
				});
			}
		});

		// Baris baru yang ditambahkan
		if (newDetails.length > oldEntry?.details?.length) {
			newDetails.slice(oldEntry.details.length).forEach((d, i) => {
				changes.push({
					field: `details[${oldEntry.details.length + i}]`,
					label: `Baris ${oldEntry.details.length + i + 1} — baru ditambahkan`,
					oldValue: null,
					newValue: { debit: d.debit, credit: d.credit, accountCode: d.accountCode },
				});

				changes.push({
					field: `details[${oldEntry.details.length + i}].description`,
					label: `Baris ${oldEntry.details.length + i + 1} — Keterangan`,
					oldValue: null,
					newValue: d.keterangan || d.description,
				});

				changes.push({
					field: `details[${oldEntry.details.length + i}].accountCode`,
					label: `Baris ${oldEntry.details.length + i + 1} — Kode Akun`,
					oldValue: null,
					newValue: d.accountCode,
				});
			});
		}

		return changes;
	}

	// private computeMirrorDiff({ wasIntercompany, isIntercompany, mirrorJournal, dto }: MirrorDiffParams): any[] {
	// 	const changes: any[] = [];

	// 	if (!wasIntercompany && isIntercompany) {
	// 		// Same → Beda: mirror baru akan dibuat
	// 		changes.push({
	// 			field: 'mirror',
	// 			label: 'Jurnal Mirror (Intercompany)',
	// 			oldValue: null,
	// 			newValue: `Akan dibuat untuk unit ${dto.unitId}`,
	// 			tag: 'MIRROR_CREATE',
	// 		});
	// 	}

	// 	if (wasIntercompany && !isIntercompany) {
	// 		// Beda → Same: mirror akan dihapus
	// 		changes.push({
	// 			field: 'mirror',
	// 			label: 'Jurnal Mirror (Intercompany)',
	// 			oldValue: `Mirror ${mirrorJournal?.numberJurnal ?? ''} akan dihapus`,
	// 			newValue: null,
	// 			tag: 'MIRROR_DELETE',
	// 		});
	// 	}

	// 	if (wasIntercompany && isIntercompany && mirrorJournal) {
	// 		// Beda → Beda: cek apakah amount atau unitId berubah
	// 		const oldAmount = mirrorJournal.totalBalance;
	// 		if (oldAmount !== dto.amount) {
	// 			changes.push({
	// 				field: 'mirror.totalBalance',
	// 				label: 'Mirror — Total Nominal',
	// 				oldValue: oldAmount,
	// 				newValue: dto.amount,
	// 				tag: 'MIRROR_UPDATE',
	// 			});
	// 		}
	// 		if (mirrorJournal.unitId !== dto.unitId) {
	// 			changes.push({
	// 				field: 'mirror.unitId',
	// 				label: 'Mirror — Unit',
	// 				oldValue: mirrorJournal.unitId,
	// 				newValue: dto.unitId,
	// 				tag: 'MIRROR_UPDATE',
	// 			});
	// 		}
	// 	}

	// 	return changes;
	// }

	async update2(id: string, dto: CreateCashOutFlowDto, decoded: DecodeTokenType) {
		// journal.helper.ts
		return this.prisma.$transaction(async (tx) => {
			// ─── 1. Validasi ──────────────────────────────────────────
			const old = await tx.cashBankTransaction.findUnique({
				where: { id },
				include: {
					journalEntry: { include: { details: true } }, // ← pakai plural
				},
			});

			if (!old) throw new NotFoundException('Transaksi tidak ditemukan');
			if (old.type !== 'CASH_OUT') throw new BadRequestException('Bukan transaksi CASH_OUT');
			// ─── Pisahkan jurnal utama & mirror ───────────────────────
			const journalMain = old.journalEntry.find((j) => !j.is_intercompany);

			// Cek posted di jurnal utama
			if (journalMain?.isPosted) {
				throw new BadRequestException(`Jurnal ${journalMain.numberJurnal} sudah diposting, transaksi tidak dapat diubah`);
			}

			const bankAccount = await tx.bankAccount.findUnique({
				where: { id: dto.bank_account_id },
				include: { account: true },
			});

			if (!bankAccount) throw new NotFoundException('Bank account tidak ditemukan');

			const wasIntercompany = !this.isSameUnit(old.unitId, bankAccount.unitId);
			const isIntercompany = !this.isSameUnit(dto.unitId, bankAccount.unitId);

			// ─── 2.apply saldo bank ────────────────────────
			await tx.bankAccount.update({
				where: { id: bankAccount.id },
				data: { currentBalance: { decrement: dto.amount } },
			});
			// Reverse
			await tx.bankAccount.update({
				where: { id: old.bank_account_id },
				data: { currentBalance: { increment: old.amountInIDR } },
			});

			// ─── 3. Update invoice ────────────────────────────────────
			// const invoice = await tx.invoice.findUnique({
			// 	where: { id: dto.invoiceId },
			// 	include: { invoiceTaxes: true, spb: true },
			// });
			// if (!invoice) throw new NotFoundException('Invoice tidak ditemukan');

			// const sumPayment = dto.amount + (Number(invoice.downPayment) || 0);
			// const isLunas = sumPayment >= invoice.amountWithTax;

			// await tx.invoice.update({
			// 	where: { id: dto.invoiceId },
			// 	data: {
			// 		paymentDate: nowWIBString(),
			// 		downPayment: sumPayment,
			// 		...(isLunas && { selectionStatus: 'SELECTED', status: 'LUNAS' }),
			// 	},
			// });

			// ─── 4. Update transaksi + details ────────────────────────
			const cashBankDetails = dto.cashBankTransactionDetails.filter((item) => item.accountCode !== null);

			await tx.cashBankTransaction.update({
				where: { id },
				data: {
					staffId: decoded.id,
					transactionNumber: dto.transactionNumber,
					amountInIDR: dto.jumlahBayar,
					amountOriginal: dto.jumlahBayar,
					currency: 'RP',
					unitId: dto.unitId,
					date: dto.date,
					grossAmount: dto.amount,
					type: 'CASH_OUT',
					description: dto.description,
					accountCode: dto.accountCode,
					bank_account_id: bankAccount ? bankAccount.id : null,
					taxType: dto.taxType,
					taxValue: dto.taxValue,
					accounIdTax: dto.accounIdTax,
					to: dto.to,
					address: dto.address,
					cashBankTransactionDetails: {
						deleteMany: { cashBankTransactionId: id },
						create: cashBankDetails.map((item) => ({
							accountCode: item.accountCode,
							accountName: item.accountName,
							keterangan: item.keterangan,
							unitId: item.unitId,
							credit: item.credit,
							debit: item.debit,
						})),
					},
				},
			});

			// ─── 5. Update JournalEntry HEADER saja (bukan details) ───
			const journal = old.journalEntry.find((j) => !j.is_intercompany);
			if (!journal) return { id, hasChanges: false, journalChanges: [] };

			await tx.journalEntry.update({
				where: { id: journal.id },
				data: {
					date: dto.date,
					addjust: false,
					description: dto.description,
					referenceNumber: dto.transactionNumber,
					totalBalance: dto.jumlahBayar,
					unitId: bankAccount.unitId,
					// ❌ details TIDAK disentuh di sini
				},
			});

			// Update header mirror juga jika ada
			const mirrorJournal = await tx.journalEntry.findFirst({
				where: { transactionId: id, is_intercompany: true },
				include: { details: true },
			});

			if (mirrorJournal) {
				await tx.journalEntry.update({
					where: { id: mirrorJournal.id },
					data: {
						date: dto.date,
						addjust: false,
						description: dto.description,
						referenceNumber: dto.transactionNumber,
						totalBalance: dto.jumlahBayar,
						unitId: dto.unitId,
						// ❌ details TIDAK disentuh di sini
					},
				});
			}

			// ─── 6. Hitung diff details untuk ditampilkan ke user ─────
			// const newJournalDetailsMain = [
			// 	{ accountCode: bankAccount.accountCode, debit: dto.amount || 0, unitId: bankAccount.unitId, credit: 0 },
			// 	{ accountCode: INTERCOMPANY_CODE, debit: 0, unitId: bankAccount.unitId, credit: dto.amount || 0 },
			// ];

			const newJournalDetailsMain = [
				{
					accountCode: bankAccount.accountCode,
					unitId: bankAccount.unitId,
					debit: 0,
					keterangan: bankAccount.account.name,
					credit: dto.jumlahBayar || dto.payAmount || 0,
				},
				...dto.cashBankTransactionDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: item.unitId,
					credit: item.credit,
					keterangan: item.keterangan,
					debit: item.debit,
				})),
			];

			const newJournalDetailsMirror = [
				{
					accountCode: '8888',
					unitId: dto.unitId,
					debit: 0,
					keterangan: 'Sesuaikan Akun',
					credit: dto.jumlahBayar || dto.payAmount || 0,
				},
				...cashBankDetails.map((item) => ({
					accountCode: item.accountCode,
					unitId: bankAccount.unitId,
					credit: item.credit,
					keterangan: item.keterangan,
					debit: item.debit,
				})),
			];

			const detailChanges = this.computeJournalDiff(journal, newJournalDetailsMain);
			const mirrorChanges = this.computeJournalDiff(mirrorJournal, newJournalDetailsMirror);

			// const mirrorChanges = this.computeMirrorDiff({ wasIntercompany, isIntercompany, mirrorJournal, dto });
			// const allChanges = [...detailChanges, ...mirrorChanges];
			const allChanges = detailChanges;

			// ─── 7. Simpan pending suggestion (hanya details) ─────────
			if (allChanges.length > 0) {
				await tx.journalAdjustmentSuggestion.deleteMany({
					where: { journalEntryId: journal.id, status: 'PENDING' },
				});
				await tx.journalAdjustmentSuggestion.create({
					data: {
						journalEntryId: journal.id,
						transactionId: id,
						status: 'PENDING',
						changes: {
							fields: allChanges,
							snapshot: {
								isIntercompany,
								wasIntercompany,
								newJournalDetailsMain,
								unitId: bankAccount.unitId,
								bankUnitId: bankAccount.unitId,
								amount: dto.amount,
								jumlahBayar: dto.jumlahBayar,
								date: dto.date,
								description: dto.description,
								transactionNumber: dto.transactionNumber,
								mirrorJournalId: mirrorJournal?.id ?? null,
							},
						} as any,
					},
				});
			}
			// ─── 7. Simpan pending suggestion (hanya details) ─────────
			if (mirrorChanges.length > 0 && dto.unitId !== bankAccount.unitId) {
				await tx.journalAdjustmentSuggestion.deleteMany({
					where: { journalEntryId: mirrorJournal.id, status: 'PENDING' },
				});
				await tx.journalAdjustmentSuggestion.create({
					data: {
						journalEntryId: mirrorJournal.id,
						transactionId: id,
						status: 'PENDING',
						changes: {
							fields: mirrorChanges,
							snapshot: {
								isIntercompany,
								wasIntercompany,
								newJournalDetailsMirror,
								unitId: dto.unitId,
								bankUnitId: bankAccount.unitId,
								amount: dto.amount,
								jumlahBayar: dto.jumlahBayar,
								date: dto.date,
								description: dto.description,
								transactionNumber: dto.transactionNumber,
								mirrorJournalId: mirrorJournal?.id ?? null,
							},
						} as any,
					},
				});
			}

			return {
				id,
				journalId: journal.id,
				journalNumber: journal.numberJurnal,
				hasChanges: allChanges.length > 0,
				journalChanges: allChanges, // ← FE pakai ini untuk highlight merah
			};
		});
	}

	async updateCashOutFlow(id: string, dto: CreateCashOutFlowDto, decoded: DecodeTokenType) {
		try {
			return this.prisma.$transaction(
				async (tx) => {
					const existing = await tx.cashBankTransaction.findFirstOrThrow({
						where: { id },
						include: {
							journalEntry: { include: { details: true } },
							cashBankTransactionDetails: true,
						},
					});

					const mainJournal = existing.journalEntry.find((j) => !j.is_intercompany);
					const mirrorJournal = existing.journalEntry.find((j) => j.is_intercompany);
					const wasIntercompany = !!mirrorJournal;

					if (!mainJournal) {
						throw new BadRequestException('Jurnal utama tidak ditemukan.');
					}

					if (mainJournal.isPosted) {
						throw new BadRequestException('Jurnal utama sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
					}

					if (mirrorJournal && mirrorJournal.isPosted) {
						throw new BadRequestException('Jurnal mirror unit sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
					}

					const bankAccount = await tx.bankAccount.findFirstOrThrow({
						where: { id: dto.bank_account_id },
						include: { account: true },
					});

					const isNowIntercompany = bankAccount.unitId !== dto.unitId;

					// Kembalikan saldo bank lama
					await tx.bankAccount.update({
						where: { id: existing.bank_account_id },
						data: { currentBalance: { increment: existing.amountInIDR } },
					});
					// Kurangi saldo bank baru
					await tx.bankAccount.update({
						where: { id: dto.bank_account_id },
						data: { currentBalance: { decrement: dto.amount } },
					});

					// Hapus details transaksi lama
					await tx.cashBankTransactionDetails.deleteMany({
						where: { cashBankTransactionId: id },
					});
					const isIntercompany = !this.isSameUnit(dto.unitId, bankAccount.unitId);

					let newJournalDetailsMain = [];
					let newJournalDetailsMirror = [];

					// Hapus detail dari SEMUA jurnal yang terhubung ke transaksi ini
					for (const journal of existing.journalEntry) {
						await tx.journalEntryDetail.deleteMany({
							where: {
								journalEntryId: journal.id,
							},
						});
					}

					if (mirrorJournal) {
						await tx.journalAdjustmentSuggestion.deleteMany({
							where: { journalEntryId: mirrorJournal.id, status: 'PENDING' },
						});
					}
					if (mainJournal) {
						await tx.journalAdjustmentSuggestion.deleteMany({
							where: { journalEntryId: mainJournal.id, status: 'PENDING' },
						});
					}

					const numberJurnal = await this.createJournal();
					const numberJurnalMirror = await this.createJournal(2);
					await tx.journalEntry.deleteMany({ where: { transactionId: id } });

					let journalId = null;
					let mirrorJournalId = null;

					// ── CASE 1: create pusat -> edit pusat ────────────────────────────
					if (existing.unitId === bankAccount.unitId && existing.unitId === dto.unitId) {
						journalId = await tx.journalEntry.create({
							data: {
								module: 'FINANCE',
								date: dto.date,
								description: dto.to,
								purposeTransaction: dto.to,
								referenceNumber: dto.transactionNumber,
								numberJurnal: numberJurnal,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: bankAccount.unitId,
								transactionId: id,
								totalBalance: dto.amount,
								details: {
									create: buildJournalDetails(dto, bankAccount, true),
								},
							},
						});
						newJournalDetailsMain = buildJournalDetails(dto, bankAccount, true);
					}

					// ── CASE 2: create beda unit → edit beda unit ────────────────────────────
					else if (existing.unitId !== bankAccount.unitId && bankAccount.unitId !== dto.unitId) {
						journalId = await tx.journalEntry.create({
							data: {
								module: 'FINANCE',
								date: dto.date,
								description: dto.to,
								purposeTransaction: dto.to,
								referenceNumber: dto.transactionNumber,
								numberJurnal: numberJurnal,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: bankAccount.unitId,
								transactionId: id,
								totalBalance: dto.amount,
								details: {
									create: buildJournalDetails(dto, bankAccount, true),
								},
							},
						});
						newJournalDetailsMain = buildJournalDetails(dto, bankAccount, false);
						mirrorJournalId = await tx.journalEntry.create({
							data: {
								module: 'SALES',
								date: dto.date,
								description: `Mirror TMP: piutang via Pusat - ${dto.to}`,
								purposeTransaction: dto.to,
								referenceNumber: dto.transactionNumber,
								numberJurnal: numberJurnalMirror,
								createdBy: 'System',
								staffId: decoded.id,
								transactionId: id,
								unitId: dto.unitId,
								is_intercompany: true,
								intercompanyReference: numberJurnal,
								totalBalance: dto.amount,
								details: {
									create: buildMirrorDetails(dto),
								},
							},
						});
						newJournalDetailsMirror = buildMirrorDetails(dto);
					}

					// ── CASE 3: create pusat → edit beda unit ────────────────────────────
					else if (existing.unitId === bankAccount.unitId && bankAccount.unitId !== dto.unitId) {
						journalId = await tx.journalEntry.create({
							data: {
								module: 'FINANCE',
								date: dto.date,
								description: dto.to,
								purposeTransaction: dto.to,
								referenceNumber: dto.transactionNumber,
								transactionId: id,
								numberJurnal: numberJurnal,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: bankAccount.unitId,
								totalBalance: dto.amount,
								details: {
									create: buildJournalDetails(dto, bankAccount, true),
								},
							},
						});
						newJournalDetailsMain = buildJournalDetails(dto, bankAccount, false);
						mirrorJournalId = await tx.journalEntry.create({
							data: {
								module: 'SALES',
								date: dto.date,
								description: `Mirror TMP: piutang via Pusat - ${dto.to}`,
								purposeTransaction: dto.to,
								referenceNumber: existing.transactionNumber,
								numberJurnal: numberJurnalMirror,
								createdBy: 'System',
								staffId: decoded.id,
								transactionId: id,
								unitId: dto.unitId,
								is_intercompany: true,
								intercompanyReference: journalId.numberJurnal,
								totalBalance: dto.amount,
								details: {
									create: buildMirrorDetails(dto),
								},
							},
						});
						newJournalDetailsMirror = buildMirrorDetails(dto);
					}

					// ── CASE 4: create beda unit → edit pusat ────────────────────────────
					else if (existing.unitId !== bankAccount.unitId && bankAccount.unitId === dto.unitId) {
						journalId = await tx.journalEntry.create({
							data: {
								module: 'FINANCE',
								date: dto.date,
								description: dto.to,
								purposeTransaction: dto.to,
								referenceNumber: dto.transactionNumber,
								numberJurnal: numberJurnal,
								createdBy: 'System',
								staffId: decoded.id,
								unitId: bankAccount.unitId,
								transactionId: id,
								totalBalance: dto.amount,
								details: {
									create: buildJournalDetails(dto, bankAccount, true),
								},
							},
						});
						newJournalDetailsMain = buildJournalDetails(dto, bankAccount, true);
					}

					// ─── 6. Hitung diff details untuk ditampilkan ke user ─────
					// const newJournalDetailsMain = [
					// 	{ accountCode: bankAccount.accountCode, debit: dto.amount || 0, unitId: bankAccount.unitId, credit: 0 },
					// 	{ accountCode: INTERCOMPANY_CODE, debit: 0, unitId: bankAccount.unitId, credit: dto.amount || 0 },
					// ];
					const detailChanges = this.computeJournalDiff(mainJournal, newJournalDetailsMain);
					const mirrorChanges = this.computeJournalDiff(mirrorJournal, newJournalDetailsMirror);

					// const mirrorChanges = this.computeMirrorDiff({ wasIntercompany, isIntercompany, mirrorJournal, dto });
					// const allChanges = [...detailChanges, ...mirrorChanges];
					const allChanges = detailChanges;

					// ─── 7. Simpan pending suggestion (hanya details) ─────────
					if (allChanges.length > 0) {
						await tx.journalAdjustmentSuggestion.create({
							data: {
								journalEntryId: journalId.id,
								transactionId: id,
								status: 'PENDING',
								changes: {
									fields: allChanges,
									snapshot: {
										isIntercompany,
										wasIntercompany,
										newJournalDetailsMain,
										unitId: bankAccount.unitId,
										bankUnitId: bankAccount.unitId,
										amount: dto.amount,
										jumlahBayar: dto.jumlahBayar,
										date: dto.date,
										description: dto.description,
										transactionNumber: dto.transactionNumber,
										mirrorJournalId: mirrorJournal?.id ?? null,
									},
								} as any,
							},
						});
					}
					// ─── 7. Simpan pending suggestion (hanya details) ─────────
					if (mirrorJournal && mirrorChanges.length > 0 && dto.unitId !== bankAccount.unitId) {
						await tx.journalAdjustmentSuggestion.create({
							data: {
								journalEntryId: mirrorJournalId.id,
								transactionId: id,
								status: 'PENDING',
								changes: {
									fields: mirrorChanges,
									snapshot: {
										isIntercompany,
										wasIntercompany,
										newJournalDetailsMirror,
										unitId: dto.unitId,
										bankUnitId: bankAccount.unitId,
										amount: dto.amount,
										jumlahBayar: dto.jumlahBayar,
										date: dto.date,
										description: dto.description,
										transactionNumber: dto.transactionNumber,
										mirrorJournalId: mirrorJournal?.id ?? null,
									},
								} as any,
							},
						});
					}

					// Update transaksi utama
					return tx.cashBankTransaction.update({
						where: { id },
						data: {
							amountInIDR: dto.amount,
							amountOriginal: dto.amount,
							grossAmount: dto.amount,
							date: dto.date,
							description: dto.description,
							accountCode: dto.accountCode,
							bank_account_id: bankAccount.id,
							unitId: isNowIntercompany ? dto.unitId : bankAccount.unitId,
							to: dto.to,
							address: dto.address,
							taxType: dto.taxType,
							taxValue: dto.taxValue,
							accounIdTax: dto.accounIdTax,
							cashBankTransactionDetails: {
								create: dto.cashBankTransactionDetails.map((item) => ({
									accountCode: item.accountCode,
									accountName: item.accountName,
									keterangan: item.keterangan,
									unitId: item.unitId,
									credit: item.credit,
									debit: item.debit,
								})),
							},
						},
					});
				},
				{
					maxWait: 10000,
					timeout: 15000,
				},
			);
		} catch (err) {
			throw err;
		}
	}

	async updateCashOutFlowRawMaterial(id: string, dto: CreateCashOutFlowDto, decoded: DecodeTokenType) {
		return this.prisma.$transaction(
			async (tx) => {
				const existing = await tx.cashBankTransaction.findFirst({
					where: {
						id,
						type: 'CASH_OUT',
						currency: 'RP',
						isMaterial: 'Y',
						deletedAt: null,
					},
					include: {
						journalEntry: { include: { details: true } },
						cashBankTransactionDetails: true,
					},
				});

				if (!existing) {
					throw new NotFoundException('Transaksi Kas Keluar Material tidak ditemukan.');
				}

				// Mode transaksi wajib mengikuti data awal di database.
				const isMaterialMode = Boolean(existing.materialId);

				if (isMaterialMode && dto.materialId && dto.materialId !== existing.materialId) {
					throw new BadRequestException('Transaksi tidak boleh dipindahkan ke penerimaan material lain.');
				}

				if (!isMaterialMode && dto.materialId) {
					throw new BadRequestException('Transaksi Manual tidak boleh diubah menjadi Raw Material.');
				}

				const mainJournal = existing.journalEntry.find((journal) => !journal.is_intercompany);
				const mirrorJournal = existing.journalEntry.find((journal) => journal.is_intercompany);

				if (!mainJournal) {
					throw new BadRequestException('Jurnal utama tidak ditemukan.');
				}

				if (mainJournal.isPosted) {
					throw new BadRequestException('Jurnal utama sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
				}

				if (mirrorJournal?.isPosted) {
					throw new BadRequestException('Jurnal mirror unit sudah terpost, tidak dapat diubah. Revert dulu (Jurnal Khusus).');
				}

				const payAmount = Number(dto.payAmount || 0);

				if (!Number.isFinite(payAmount) || payAmount <= 0) {
					throw new BadRequestException('Jumlah pembayaran harus lebih dari 0.');
				}

				const transactionDate = new Date(String(dto.date));

				if (Number.isNaN(transactionDate.getTime())) {
					throw new BadRequestException('Tanggal transaksi tidak valid.');
				}

				if (!dto.bank_account_id) {
					throw new BadRequestException('Rekening bank wajib dipilih.');
				}

				const bankAccount = await tx.bankAccount.findUnique({
					where: { id: dto.bank_account_id },
					include: { account: true },
				});

				if (!bankAccount) {
					throw new NotFoundException('Bank account tidak ditemukan.');
				}

				const detailTransaksi = dto.cashBankTransactionDetails || [];
				const debitBarisPertama = Number(detailTransaksi[0]?.debit || 0);

				const details = detailTransaksi.filter((item) => Boolean(item.accountCode));
				let totalTagihanMaterial = Number(existing.grossAmount || 0);

				// Mode Raw Material: hitung ulang pembayaran tanpa transaksi yang sedang diedit.
				if (isMaterialMode) {
					const receipt = await tx.rawMaterialReceipt.findFirst({
						where: {
							id: existing.materialId,
							deletedAt: null,
						},
						include: {
							items: {
								where: { deletedAt: null },
							},
						},
					});

					if (!receipt) {
						throw new NotFoundException('Data penerimaan barang mentah tidak ditemukan.');
					}

					// Debit baris pertama adalah pembayaran material, bukan total uang keluar.
					if (!Number.isFinite(debitBarisPertama) || debitBarisPertama <= 0) {
						throw new BadRequestException('Pembayaran material harus lebih dari 0.');
					}

					if (payAmount < debitBarisPertama) {
						throw new BadRequestException('Total pembayaran tidak boleh lebih kecil dari pembayaran material.');
					}

					// Total tagihan material.
					totalTagihanMaterial = receipt.items.reduce((total, item) => total + Number(item.Total || 0), 0);

					const totalTagihan = totalTagihanMaterial;

					if (totalTagihan <= 0) {
						throw new BadRequestException('Total tagihan material tidak valid.');
					}

					// Ambil transaksi pembayaran material lainnya,
					// kecuali transaksi yang sedang diedit.
					const otherPayments = await tx.cashBankTransaction.findMany({
						where: {
							id: { not: id },
							materialId: existing.materialId,
							type: 'CASH_OUT',
							currency: 'RP',
							isMaterial: 'Y',
							deletedAt: null,
						},
						select: {
							cashBankTransactionDetails: {
								where: { deletedAt: null },
								orderBy: { createdAt: 'asc' },
								take: 1,
								select: { debit: true },
							},
						},
					});

					// Hitung pembayaran material dari debit baris pertama.
					const previousPayment = otherPayments.reduce(
						(total, transaction) => total + Number(transaction.cashBankTransactionDetails[0]?.debit || 0),
						0,
					);

					// Pembayaran material setelah transaksi di-update.
					const receiptTotalPayment = previousPayment + debitBarisPertama;

					if (receiptTotalPayment > totalTagihan) {
						const remainingPayment = Math.max(0, totalTagihan - previousPayment);

						throw new BadRequestException(`Pembayaran material melebihi sisa tagihan. Sisa tagihan: ${remainingPayment}.`);
					}

					const isLunas = receiptTotalPayment >= totalTagihan ? 'Y' : 'N';

					await tx.rawMaterialReceipt.update({
						where: {
							id: existing.materialId,
						},
						data: {
							downPayment: receiptTotalPayment,
							isLunas,
						},
					});
				}

				// Reverse saldo rekening lama.
				if (existing.bank_account_id) {
					await tx.bankAccount.update({
						where: { id: existing.bank_account_id },
						data: {
							currentBalance: {
								increment: Number(existing.amountInIDR || 0),
							},
						},
					});
				}

				// Terapkan pembayaran terbaru ke rekening yang dipilih.
				await tx.bankAccount.update({
					where: { id: bankAccount.id },
					data: {
						currentBalance: {
							decrement: payAmount,
						},
					},
				});

				// Hapus saran jurnal lama sebelum membangun jurnal terbaru.
				await tx.journalAdjustmentSuggestion.deleteMany({
					where: { transactionId: id },
				});

				// Hapus seluruh detail jurnal lama, termasuk jurnal tambahan
				for (const journal of existing.journalEntry) {
					await tx.journalEntryDetail.deleteMany({
						where: { journalEntryId: journal.id },
					});
				}

				const numberJurnal = await this.createJournal();
				const isIntercompany = bankAccount.unitId !== dto.unitId;
				const numberJurnalMirror = isIntercompany ? await this.createJournal(2) : null;

				const journalDetails = details.map((item) => ({
					accountCode: item.accountCode,
					unitId: bankAccount.unitId,
					description: item.keterangan || item.description,
					debit: item.debit || 0,
					credit: item.credit || 0,
				}));

				const transaction = await tx.cashBankTransaction.update({
					where: { id },
					data: {
						transactionNumber: dto.transactionNumber,
						amountInIDR: payAmount,
						amountOriginal: payAmount,
						grossAmount: isMaterialMode ? totalTagihanMaterial : payAmount,
						currency: 'RP',
						type: 'CASH_OUT',
						isMaterial: 'Y',
						materialId: existing.materialId,
						unitId: dto.unitId,
						date: transactionDate,
						description: dto.description,
						accountCode: dto.accountCode || null,
						bank_account_id: bankAccount.id,
						accounIdTax: dto.accounIdTax,
						taxType: dto.taxType,
						taxValue: dto.taxValue,
						to: dto.to,
						address: dto.address,
						cashBankTransactionDetails: {
							deleteMany: {},
							create: details.map((item) => ({
								accountCode: item.accountCode,
								accountName: item.accountName || item.accountCode,
								keterangan: item.keterangan || item.description,
								unitId: bankAccount.unitId,
								debit: item.debit || 0,
								credit: item.credit || 0,
							})),
						},
					},
				});

				// Jurnal utama mengikuti pola CREATE.
				await tx.journalEntry.create({
					data: {
						module: 'FINANCE',
						date: transactionDate,
						description: dto.description || dto.to,
						purposeTransaction: dto.to,
						referenceNumber: dto.transactionNumber,
						numberJurnal,
						createdBy: 'System',
						staffId: decoded.id,
						unitId: bankAccount.unitId,
						transactionId: id,
						totalBalance: payAmount,
						details: {
							create: [
								{
									accountCode: bankAccount.accountCode,
									description: bankAccount.account?.name,
									unitId: bankAccount.unitId,
									debit: 0,
									credit: payAmount,
								},
								...journalDetails,
							],
						},
					},
				});

				// Jurnal mirror jika unit rekening bank berbeda dengan unit transaksi.
				if (isIntercompany && numberJurnalMirror) {
					await tx.journalEntry.create({
						data: {
							module: 'SALES',
							date: transactionDate,
							description: dto.description || dto.to,
							purposeTransaction: dto.to,
							referenceNumber: dto.transactionNumber,
							numberJurnal: numberJurnalMirror,
							createdBy: 'System',
							staffId: decoded.id,
							transactionId: id,
							unitId: dto.unitId,
							is_intercompany: true,
							intercompanyReference: numberJurnal,
							totalBalance: payAmount,
							details: {
								create: [
									{
										accountCode: bankAccount.accountCode,
										description: bankAccount.account?.name,
										unitId: dto.unitId,
										debit: 0,
										credit: payAmount,
									},
									...details.map((item) => ({
										accountCode: item.accountCode,
										description: item.keterangan || item.description,
										unitId: dto.unitId,
										debit: item.debit || 0,
										credit: item.credit || 0,
									})),
								],
							},
						},
					});
				}

				return transaction;
			},
			{
				maxWait: 10000,
				timeout: 30000,
			},
		);
	}
}

function buildJournalDetails(dto, bankAccount, isSameUnit) {
	return [
		{
			accountCode: bankAccount.accountCode,
			unitId: bankAccount.unitId,
			debit: 0,
			credit: dto.amount,
			description: dto.description,
			isTmp: !isSameUnit,
		},
		...dto.cashBankTransactionDetails.map((item) => ({
			accountCode: isSameUnit ? item.accountCode : '8888',
			unitId: isSameUnit ? item.unitId : bankAccount.unitId,
			credit: item.credit,
			debit: item.debit,
			description: item.keterangan,
		})),
	];
}

function buildMirrorDetails(dto) {
	return [
		{
			accountCode: '8888',
			unitId: dto.unitId,
			debit: 0,
			credit: dto.amount,
			description: 'Sesuaikan Akun',
		},
		...dto.cashBankTransactionDetails.map((item) => ({
			accountCode: item.accountCode,
			unitId: dto.unitId,
			credit: item.credit,
			debit: item.debit,
			description: item.keterangan,
		})),
	];
}

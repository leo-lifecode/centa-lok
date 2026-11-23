import { ApiProperty } from '@nestjs/swagger';
import * as Transformers from 'class-transformer';
import * as Validators from 'class-validator';

export class CashBankTransactionDetails {
	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'keterangan', type: String })
	keterangan: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'unitId', type: String })
	unitId: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'accountCode', type: String })
	accountCode: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'accountName', type: String })
	accountName: string;

	@Validators.IsNumber()
	@Validators.IsOptional()
	@ApiProperty({ description: 'debit', type: Number })
	debit: number;

	@Validators.IsNumber()
	@Validators.IsOptional()
	@ApiProperty({ description: 'credit', type: String })
	credit: number;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'description', type: String })
	description: string;
}

export class CreateTransactionDto {
	@Validators.IsString({ message: 'transactionNumber harus string' })
	@Validators.IsNotEmpty({ message: 'transactionNumber tidak boleh kosong' })
	@ApiProperty({ description: 'transactionNumber', type: String })
	transactionNumber: string;

	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'amount tidak boleh kosong' })
	@ApiProperty({ description: 'Input oleh user (jumlah kas masuk)', type: Number, example: 0 })
	amount: number;

	@Validators.IsNumber()
	@Validators.IsOptional()
	@ApiProperty({ description: 'Input oleh user (jumlah kas masuk)', type: Number, example: 0 })
	jumlahBayar: number;

	@Validators.IsNumber()
	@Validators.IsOptional()
	@ApiProperty({ description: 'amountOriginal', type: Number })
	amountOriginal?: number;

	@Validators.IsNumber()
	@Validators.IsOptional()
	@ApiProperty({ description: 'Biaya administrasi', type: Number })
	administrasiAmount: number;

	@Validators.IsNumber()
	@Validators.IsOptional()
	@ApiProperty({ description: 'Biaya administrasi', type: Number })
	exchangeRate: number;

	@Validators.IsString({ message: 'description harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'description', type: String })
	description: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'Penerima', type: String, required: false })
	to?: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'Alamat Penerima', type: String, required: false })
	address?: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({
		description: 'Diterima dari',
		type: String,
		required: false,
	})
	receivedFrom?: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({
		description: 'Untuk',
		type: String,
		required: false,
	})
	purpose?: string;

	@Validators.IsString({ message: 'accountCode harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'accountCode', type: String, example: 'kas | bank' })
	accountCode?: string;

	@Validators.IsString({ message: 'invoiceId harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'invoiceId', type: String })
	invoiceId?: string;

	@Validators.IsString({ message: 'bank_account_id harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'bank_account_id', type: String })
	bank_account_id: string;

	@Validators.IsString({ message: 'currency harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'currency', type: String })
	currency?: string;

	@Validators.IsString({ message: 'date harus string' })
	@Validators.IsNotEmpty({ message: 'date tidak boleh kosong' })
	@ApiProperty({ description: 'date', type: String })
	date: Date;

	@Validators.IsString({ message: 'unitId tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'unitId tidak boleh kosong' })
	@ApiProperty({ description: 'unitId oleh user (jumlah kas masuk)', type: String, example: 0 })
	unitId: string;

	@Validators.IsNumber()
	@Validators.IsOptional()
	@ApiProperty({ description: 'jumlahBayarDollar', type: Number })
	jumlahBayarDollar?: number;

	@Validators.ValidateNested()
	@Transformers.Type(() => CashBankTransactionDetails)
	@ApiProperty({ type: [CashBankTransactionDetails] })
	cashBankTransactionDetails: CashBankTransactionDetails[];
}

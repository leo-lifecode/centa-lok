import { ApiProperty, OmitType } from '@nestjs/swagger';
import * as Transformers from 'class-transformer';
import * as Validators from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

export class CashBankTransactionDetails {
	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'keterangan', type: String })
	keterangan: string;

	@Validators.IsString()
	@Validators.IsNotEmpty()
	@ApiProperty({ description: 'description', type: String })
	description: string;

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
	@ApiProperty({ description: 'credit', type: Number })
	credit: number;
}

export class CreateCashOutFlowDto extends OmitType(CreateTransactionDto, ['invoiceId'] as const) {
	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'taxType oleh user (jumlah kas masuk)', type: String, example: 0 })
	taxType: 'PPh 22' | 'PPh 21' | 'PPh 22' | 'PPh 23' | 'PPN 11%';

	@Validators.IsNumber()
	@Validators.IsOptional()
	@Transformers.Transform(({ value }) => (typeof value === 'string' ? Number(value) : value))
	@ApiProperty({ description: 'taxValue oleh user (jumlah kas masuk)', type: Number, example: 0 })
	taxValue: number;

	@Validators.IsNumber()
	@Validators.IsOptional()
	@Transformers.Transform(({ value }) => (typeof value === 'string' ? Number(value) : value))
	@ApiProperty({ description: 'payAmount)', type: Number, example: 0 })
	payAmount: number;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'accounIdTax oleh user (jumlah kas masuk)', type: String, example: 0 })
	accounIdTax: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'kategori', type: String, example: 0 })
	kategori: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'numberJurnal', type: String, example: 0 })
	numberJurnal: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'to', type: String })
	to: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'address', type: String })
	address: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'materialId', type: String })
	materialId: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({ description: 'BankaccountCode', type: String })
	BankaccountCode: string;

	@Validators.IsArray()
	@Validators.ValidateNested({ each: true })
	@Transformers.Type(() => CashBankTransactionDetails)
	@ApiProperty({ type: [CashBankTransactionDetails] })
	cashBankTransactionDetails: CashBankTransactionDetails[];
}

import { ApiProperty } from '@nestjs/swagger';
import { CurrencyType, Incoterms, TypePayment, TypePenjualan } from '@prisma/client';
import * as Transformers from 'class-transformer';
import { Type } from 'class-transformer';
import * as Validators from 'class-validator';
import { IsDate } from 'class-validator';

export class PurchaseOrderItemDto {
	@Validators.IsString({ message: 'productId tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'productId tidak boleh kosong' })
	@ApiProperty({ description: 'productId', type: String, example: 'uuid' })
	productId: string;

	@Validators.IsString({ message: 'kategoriProduct tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'kategoriProduct tidak boleh kosong' })
	@ApiProperty({ description: 'kategoriProduct', type: String, example: 'karet' })
	kategoriProduct: string;

	@Validators.IsString({ message: 'kodeBarangProduct tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'kodeBarangProduct tidak boleh kosong' })
	@ApiProperty({ description: 'kodeBarangProduct', type: String, example: 'BRG-001' })
	kodeBarangProduct: string;

	@Validators.IsString({ message: 'namabarangProduct tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'namabarangProduct tidak boleh kosong' })
	@ApiProperty({ description: 'namabarangProduct', type: String, example: 'karet' })
	namabarangProduct: string;

	@Validators.IsString({ message: 'satuanProduct tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'satuanProduct tidak boleh kosong' })
	@ApiProperty({ description: 'satuanProduct', type: String, example: 'Kg' })
	satuanProduct: string;

	@Validators.IsString({ message: 'spesifikasiProduct tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'spesifikasiProduct tidak boleh kosong' })
	@ApiProperty({ description: 'spesifikasiProduct', type: String, example: '-' })
	spesifikasiProduct: string;

	@Validators.IsString({ message: 'unitProduct tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'unitProduct tidak boleh kosong' })
	@ApiProperty({ description: 'unitProduct', type: String, example: '-' })
	unitProduct: string;

	@Transformers.Transform(({ value }) => {
		if (typeof value === 'string') {
			const normalized = value.trim().replace(',', '.');
			return normalized === '' ? value : Number(normalized);
		}

		return value;
	})
	@Validators.IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'quantity harus berupa angka yang valid' })
	@Validators.IsNotEmpty({ message: 'quantity tidak boleh kosong' })
	@ApiProperty({
		description: 'quantity',
		type: Number,
		example: 1.5,
	})
	quantity: number;

	@Validators.IsNumber()
	@Type(() => Number)
	@Validators.IsNotEmpty({ message: 'unitPrice tidak boleh kosong' })
	@ApiProperty({ description: 'unitPrice', type: Number, example: 200 })
	unitPrice: number;

	@Validators.IsNumber()
	@Type(() => Number)
	@Validators.IsNotEmpty({ message: 'Berat product tidak boleh kosong' })
	@ApiProperty({ description: 'Berat product', type: Number, example: 200 })
	beratproduct: number;

	@Validators.IsNumber()
	@Type(() => Number)
	@Validators.IsNotEmpty({ message: 'priceProduct product tidak boleh kosong' })
	@ApiProperty({ description: 'priceProduct product', type: Number, example: 200 })
	priceProduct: number;

	@Validators.IsNumber()
	@Type(() => Number)
	@Validators.IsNotEmpty({ message: 'stockProduct product tidak boleh kosong' })
	@ApiProperty({ description: 'stockProduct product', type: Number, example: 200 })
	stockProduct: number;

	@Validators.IsString({ message: 'namabarangProductInvoice tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'namabarangProductInvoice tidak boleh kosong' })
	@ApiProperty({ description: 'namabarangProductInvoice', type: String, example: '-' })
	namabarangProductInvoice: string;

	@Validators.IsNumber()
	@Type(() => Number)
	@Validators.IsNotEmpty({ message: 'nilaiSatuan product tidak boleh kosong' })
	@ApiProperty({ description: 'nilaiSatuan product', type: Number, example: 200 })
	nilaiSatuan: number;
}

export class AdditionalServiceDto {
	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'amount tidak boleh kosong' })
	@ApiProperty({ description: 'amount', type: Number })
	amount: number;

	@Validators.IsString({ message: 'description tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'description tidak boleh kosong' })
	@ApiProperty({ description: 'description', type: String })
	description: string;

	@Validators.IsString({ message: 'type tidak boleh kosong' })
	@Validators.IsNotEmpty({ message: 'type tidak boleh kosong' })
	@ApiProperty({ description: 'type', type: String })
	type: string;
}

export class PurchaseOrderTaxDto {
	@Validators.IsString({ message: 'taxId harus string' })
	@Validators.IsNotEmpty({ message: 'taxId tidak boleh kosong' })
	@ApiProperty({ description: 'taxId', type: String, example: 'uuid' })
	taxId: string;

	@Validators.IsString({ message: 'taxType harus string' })
	@Validators.IsNotEmpty({ message: 'taxType tidak boleh kosong' })
	@ApiProperty({ description: 'taxType', type: String, example: 'PPN' })
	taxType: string;

	@Validators.IsNumber({ allowNaN: false, allowInfinity: false })
	@Validators.Min(0, { message: 'taxValue tidak boleh negatif' })
	@Type(() => Number)
	@Validators.IsNotEmpty({ message: 'taxValue tidak boleh kosong' })
	@ApiProperty({ description: 'taxValue', type: Number, example: 0.11 })
	taxValue: number;

	@Validators.IsNumber({ allowNaN: false, allowInfinity: false })
	@Validators.Min(0, { message: 'taxAmount tidak boleh negatif' })
	@Type(() => Number)
	@Validators.IsNotEmpty({ message: 'taxAmount tidak boleh kosong' })
	@ApiProperty({ description: 'taxAmount', type: Number, example: 110 })
	taxAmount: number;
}

export class CreateOrderPoPraDto {
	@Validators.IsString({ message: 'orderNumber harus string' })
	@Validators.IsNotEmpty({ message: 'orderNumber tidak boleh kosong' })
	@ApiProperty({ description: 'orderNumber', type: String, example: 'ODR-0001' })
	orderNumber: string;

	@Validators.IsNotEmpty({ message: 'date tidak boleh kosong' })
	@Type(() => Date)
	@IsDate({ message: 'date harus berupa tanggal yang valid' })
	@ApiProperty({ description: 'date', type: String, example: '2025-04-10T00:00:00.000Z' })
	date: Date;

	@Validators.IsString({ message: 'description harus string' })
	@Validators.IsNotEmpty({ message: 'description tidak boleh kosong' })
	@ApiProperty({ description: 'description', type: String, example: 'desc' })
	description?: string;

	@Validators.IsString({ message: 'franco harus string' })
	@Validators.IsNotEmpty({ message: 'franco tidak boleh kosong' })
	@ApiProperty({ description: 'franco', type: String, example: 'JL. Contoh' })
	franco: string;

	@Validators.IsString({ message: 'file harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'file', type: String })
	file?: string;

	@Validators.IsString({ message: 'fileKontrak harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'fileKontrak', type: String })
	fileKontrak?: string;

	@Validators.IsString({ message: 'fileUrlEkspor harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'fileUrlEkspor', type: String })
	fileUrlEkspor?: string;

	@Validators.IsString({ message: 'fileUrlProduksi harus string' })
	@Validators.IsOptional()
	@ApiProperty({ description: 'fileUrlProduksi', type: String })
	fileUrlProduksi?: string;

	materialRequestId?: string;
	taxId?: string;

	@Validators.IsString({ message: 'customerId harus string' })
	@Validators.IsNotEmpty({ message: 'customerId tidak boleh kosong' })
	@ApiProperty({ description: 'customerId', type: String, example: 'uuid', required: true })
	customerId: string;

	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'subtotalAmount tidak boleh kosong' })
	@ApiProperty({ description: 'subtotalAmount', type: Number, example: 1000 })
	subtotalAmount: number;

	@Validators.ValidateIf((o) => o.typePo !== 'RN' && o.typePo !== 'RN_EKSPOR')
	@Validators.IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'totalAmount harus berupa angka yang valid' })
	@Validators.IsNotEmpty({
		message: 'totalAmount tidak boleh kosong',
	})
	@ApiProperty({
		description: 'totalAmount',
		type: Number,
		example: 1110,
		required: false,
	})
	totalAmount?: number;

	@Validators.IsString({ message: 'nama customer harus string' })
	@Validators.IsNotEmpty({ message: 'nama customer tidak boleh kosong' })
	@ApiProperty({ description: 'nama customer', type: String, example: '-', required: true })
	customerName: string;

	@Validators.IsString({ message: 'typePo customer harus string' })
	@Validators.IsNotEmpty({ message: 'typePo customer tidak boleh kosong' })
	@ApiProperty({ description: 'typePo customer', type: String, example: '-', required: true })
	typePo: TypePenjualan;

	@Validators.IsOptional()
	@ApiProperty({ description: 'typePayment', type: String })
	typePayment: TypePayment;

	@Validators.IsOptional()
	@ApiProperty({ description: 'downPayment', type: Number })
	downPayment: number;

	@Validators.IsOptional()
	@ApiProperty({ description: 'currency', type: String })
	currency: CurrencyType;

	@Validators.IsOptional()
	@ApiProperty({ description: 'incoterms', type: String })
	incoterms: Incoterms;

	@Validators.IsOptional()
	@ApiProperty({ description: 'kebun', type: String })
	kebun?: string;

	@Validators.ValidateNested()
	@Transformers.Type(() => PurchaseOrderItemDto)
	@ApiProperty({ type: [PurchaseOrderItemDto] })
	items: PurchaseOrderItemDto[];

	@Validators.ValidateNested()
	@Transformers.Type(() => AdditionalServiceDto)
	@ApiProperty({ type: [AdditionalServiceDto] })
	@Validators.IsOptional()
	additionalService?: AdditionalServiceDto[];

	@Validators.IsArray({ message: 'taxes harus berupa array' })
	@Validators.ValidateNested({ each: true })
	@Transformers.Type(() => PurchaseOrderTaxDto)
	@ApiProperty({ type: [PurchaseOrderTaxDto] })
	@Validators.IsOptional()
	taxes?: PurchaseOrderTaxDto[];
}

import { ApiProperty } from '@nestjs/swagger';
import { TypePenjualan } from '@prisma/client';
import * as Transformers from 'class-transformer';
import * as Validators from 'class-validator';

export class StockLogs {
	@Validators.IsString({ message: 'productId harus string' })
	@Validators.IsNotEmpty({ message: 'productId tidak boleh kosong' })
	@ApiProperty({ description: 'productId', type: String, example: 'uuid productId' })
	productId: string;

	// Wajib hanya untuk SPB RA. SPB RN / RN Ekspor tidak punya DeliveryOrderDetail, jadi dilewati.
	@Validators.ValidateIf((o: StockLogs) => o.typeSalesSPb === 'RA')
	@Validators.IsString({
		message: 'deliveryOrderDetailId harus string',
	})
	@Validators.IsNotEmpty({
		message: 'deliveryOrderDetailId tidak boleh kosong',
	})
	@ApiProperty({
		description: 'ID Detail Delivery Order (wajib untuk SPB RA)',
		type: String,
		required: false,
	})
	deliveryOrderDetailId?: string;

	@Validators.IsNumber()
	@Validators.IsNotEmpty()
	@ApiProperty({ description: 'quantity', type: Number, example: 10 })
	quantity: number;

	@Transformers.Transform(({ value }) => (typeof value === 'string' ? Number(value.replace(',', '.')) : value))
	@Validators.IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'qtyKirim harus berupa angka' })
	@Validators.IsOptional()
	@ApiProperty({
		description: 'qtyKirim',
		type: Number,
		required: false,
		example: 1.5,
	})
	qtyKirim?: number;

	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'stockProduct tidak boleh kosong' })
	@ApiProperty({ description: 'stockProduct', type: Number, example: '' })
	stockProduct: number;

	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'priceProduct tidak boleh kosong' })
	@ApiProperty({ description: 'priceProduct', type: Number, example: '' })
	priceProduct: number;

	@Validators.IsString({ message: 'type harus string' })
	@Validators.IsNotEmpty({ message: 'kodeBarangProduct tidak boleh kosong' })
	@ApiProperty({ description: 'kodeBarangProduct', type: String, example: '' })
	kodeBarangProduct: string;

	@Validators.IsString({ message: 'type harus string' })
	@Validators.IsNotEmpty({ message: 'namabarangProduct tidak boleh kosong' })
	@ApiProperty({ description: 'namabarangProduct', type: String, example: '' })
	namabarangProduct: string;

	@Validators.IsString({ message: 'type harus string' })
	@Validators.IsNotEmpty({ message: 'spesifikasiProduct tidak boleh kosong' })
	@ApiProperty({ description: 'spesifikasiProduct', type: String, example: '' })
	spesifikasiProduct: string;

	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'beratproduct tidak boleh kosong' })
	@ApiProperty({ description: 'beratproduct', type: Number, example: '' })
	beratproduct: number;

	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'beratproduct tidak boleh kosong' })
	@ApiProperty({ description: 'beratproduct', type: Number, example: 0 })
	total: number;

	@Validators.IsString({ message: 'type harus string' })
	@Validators.IsNotEmpty({ message: 'kategoriProduct tidak boleh kosong' })
	@ApiProperty({ description: 'kategoriProduct', type: String, example: '' })
	kategoriProduct: string;

	@Validators.IsString({ message: 'type harus string' })
	@Validators.IsNotEmpty({ message: 'satuanProduct tidak boleh kosong' })
	@ApiProperty({ description: 'satuanProduct', type: String, example: '' })
	satuanProduct: string;

	@Validators.IsString({ message: 'type harus string' })
	@Validators.IsNotEmpty({ message: 'unitProduct tidak boleh kosong' })
	@ApiProperty({ description: 'unitProduct', type: String, example: '' })
	unitProduct: string;

	@Validators.IsString({ message: 'type harus string' })
	@Validators.IsNotEmpty({ message: 'type tidak boleh kosong' })
	@ApiProperty({ description: 'type', type: String, example: 'IN/OUT' })
	type: string;

	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'type tidak boleh kosong' })
	@ApiProperty({ description: 'type', type: Number })
	nilaiSatuan: number;

	@Validators.IsString({ message: 'namabarangProductInvoice harus string' })
	@Validators.IsNotEmpty({ message: 'namabarangProductInvoice tidak boleh kosong' })
	@ApiProperty({ description: 'namabarangProductInvoice', type: String, example: 'IN/OUT' })
	namabarangProductInvoice: string;

	@Validators.IsString({ message: 'typeSalesSPb harus string' })
	@Validators.IsNotEmpty({ message: 'typeSalesSPb tidak boleh kosong' })
	@ApiProperty({ description: 'typeSalesSPb', type: String, example: '' })
	typeSalesSPb: string;
}

export class CreateSpbDto {
	@Validators.IsString({ message: 'purchaseOrderId harus string' })
	@Validators.IsNotEmpty({ message: 'purchaseOrderId tidak boleh kosong' })
	@ApiProperty({ description: 'purchaseOrderId', type: String, example: 'uuid purchaseOrderId' })
	purchaseOrderId: string;

	@Validators.IsString({ message: 'noSpb harus string' })
	@Validators.IsNotEmpty({ message: 'noSpb tidak boleh kosong' })
	@ApiProperty({ description: 'noSpb', type: String, example: 'noSpb' })
	noSpb: string;

	@Validators.IsString({ message: 'deliveryOrderId harus string' })
	@Validators.IsNotEmpty({ message: 'deliveryOrderId tidak boleh kosong' })
	@ApiProperty({ description: 'deliveryOrderId', type: String, example: 'uuid deliveryOrderId' })
	deliveryOrderId: string;

	@Validators.IsString({ message: 'orderNumber harus string' })
	@Validators.IsNotEmpty({ message: 'orderNumber tidak boleh kosong' })
	@ApiProperty({ description: 'orderNumber', type: String, example: '' })
	orderNumber: string;

	@Validators.IsString({ message: 'date harus string' })
	@Validators.IsNotEmpty({ message: 'date tidak boleh kosong' })
	@ApiProperty({ description: 'date', type: String, example: '' })
	date: string;

	@Validators.IsString({ message: 'description harus string' })
	@Validators.IsNotEmpty({ message: 'description tidak boleh kosong' })
	@ApiProperty({ description: 'description', type: String, example: '' })
	description: string;

	@Validators.IsString({ message: 'franco harus string' })
	@Validators.IsNotEmpty({ message: 'franco tidak boleh kosong' })
	@ApiProperty({ description: 'franco', type: String, example: '' })
	franco: string;

	@Validators.IsString({ message: 'customerName harus string' })
	@Validators.IsNotEmpty({ message: 'customerName tidak boleh kosong' })
	@ApiProperty({ description: 'customerName', type: String, example: '' })
	customerName: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({
		description: 'Nama atasan',
		type: String,
		required: false,
		example: 'Budi Santoso',
	})
	namaAtasan?: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({
		description: 'Jabatan atasan',
		type: String,
		required: false,
		example: 'Kepala Bagian',
	})
	jabatanAtasan?: string;

	@Validators.IsString()
	@Validators.IsOptional()
	@ApiProperty({
		description: 'Dikirim dengan',
		type: String,
		required: false,
		example: 'Truck',
	})
	dikirimDengan?: string;

	@Validators.IsNumber()
	@Validators.IsNotEmpty({ message: 'subtotalAmount tidak boleh kosong' })
	@ApiProperty({ description: 'subtotalAmount', type: Number, example: '' })
	subtotalAmount: number;

	@Validators.IsString()
	@Validators.IsNotEmpty({ message: 'tanggalPengiriman tidak boleh kosong' })
	@ApiProperty({ description: 'tanggalPengiriman', type: Date, example: '' })
	tanggalPengiriman: Date;

	@Validators.ValidateNested()
	@Transformers.Type(() => StockLogs)
	@ApiProperty({ type: [StockLogs] })
	stockLogs: StockLogs[];

	@Validators.IsString({ message: 'typeSalesSPb harus string' })
	@Validators.IsNotEmpty({ message: 'typeSalesSPb tidak boleh kosong' })
	@ApiProperty({ description: 'typeSalesSPb', type: String, example: '' })
	typeSalesSPb: TypePenjualan;
}

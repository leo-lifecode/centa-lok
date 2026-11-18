export interface TransactionType {
  purchaseOrderId: string;
}

export interface PurchaseOrderItemType {
  kodeBarangProduct: string;
  namabarangProduct: string;
  spesifikasiProduct: string;
  quantity: number;
  priceProduct: number;
  total: number;
  satuanProduct: string;
}

export interface PurchaseOrderTaxType {
  id: string;
  purchaseOrderId: string;
  taxId: string;
  taxType: string;
  taxValue: number;
  taxAmount: number;
}

export interface PurchaseOrderData {
  orderNumber: string;
  date: string;
  customerName: string;
  franco: string;
  description: string;
  subtotalAmount: number;
  taxAmount: number | null;
  totalAmount: number;
  PurchaseOrderTax: PurchaseOrderTaxType[];
  items: PurchaseOrderItemType[];
  customer: CutomerType;
  fileUrl: string;
  status: string;
}

export interface CutomerType {
  id: string;
  code: string;
  name: string;
  address: string;
  unit: string;
  email: string;
  phone: string;
  country: string;
  continent: string;
  regional_type: string;
  deletedAt: null;
  createdAt: Date;
}

export interface ProductType {
  productId: string;
  quantity: number;
  unitPrice: number;

  beratproduct: number;
  kategoriProduct: string;
  kodeBarangProduct: string;
  namabarangProduct: string;
  namabarangProductInvoice: string;
  priceProduct: number;
  satuanProduct: string;
  spesifikasiProduct: string;
  stockProduct: number;
  unitProduct: string;
  nilaiSatuan: number;
}

export interface PayloadOrderRNType {
  orderNumber: string;
  date: Date;
  description: string;
  franco: string;
  items: ItemType[];
  customerId: string;
  staffId: string;
  subtotalAmount: number;
  customerName: string;
  typePo: string;
  file: FileType;
  fileKontrak: FileType;
  totalAmount?: number;
  taxes: { taxId: string; taxType: string; taxValue: number; taxAmount: number }[];
}

export interface ItemType {
  productId: string;
  kategoriProduct: string;
  kodeBarangProduct: string;
  namabarangProduct: string;
  satuanProduct: string;
  spesifikasiProduct: string;
  unitProduct: string;
  quantity: number;
  unitPrice: number;
  beratproduct: number;
  priceProduct: number;
  stockProduct: number;
  namabarangProductInvoice: string;
}

export interface FileType {
  originFileObj: any;
}

export interface ParamsType {
  page?: number;
  limit?: number;
  date?: string | null;
  status?: string | null;
  name?: string;
}

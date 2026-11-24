import { Dayjs } from 'dayjs';

export interface TransactionType {
  id?: string;
  transactionNumber?: string;
  amountOriginal?: number;
  amountInIDR?: number;
  currency?: string;
  exchangeRate?: number | null;
  grossAmount?: number;
  type?: string;
  description?: string;
  receivedFrom?: string | null;
  purpose?: string | null;
  date?: Dayjs | string;
  kategori?: null;
  accountCode?: string;
  invoiceId?: string | null;
  bank_account_id?: string | null;
  typeTransaction?: string;
  deletedAt?: null;
  createdAt?: Date;
  invoice?: null;
  invoiceNumber?: string;
  amount?: number;
  isActionEnabled?: boolean;

  jumlahBayar?: number;
  bankAccountId?: string;
  inputDate: Dayjs;
  biaya?: string;
  unitId: string;
  jumlahBayarDollar: number;
  journalEntry?: {
    id: string;
    isPosted: boolean;
    is_intercompany: boolean;
  }[];
}

export interface InvoiceDatumType {
  id: string;
  spbId: string;
  contractId: null;
  invoiceNumber: string;
  invoiceDate: Date;
  amountWithTax: number;
  totalAmount: number;
  createdAt: Date;
  deletedAt: null;
  selectionStatus: string;
  typeInvoice: string;
  paymentDate: null;
  status: string;
  invoiceTaxes: InvoiceTax[];
  spb: Spb;
  downPayment: number;
}

export interface InvoiceTax {
  id: string;
  invoiceId: string;
  taxId: string;
  taxType: string;
  taxValue: number;
  withheldByCustomer: boolean;
  isIncludedInPrice: boolean;
  taxAmount: number;
  createdAt: Date;
}

export interface Spb {
  id: string;
  noSpb: string;
  purchaseOrderId: string;
  orderNumber: string;
  date: Date;
  description: string;
  franco: string;
  fileUrl: null;
  customerName: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  isComplete: string;
  isCekPajak: boolean;
  tanggalPengiriman: Date;
  selectionStatus: string;
  typeSalesSPb: string;
  createdAt: Date;
  status: string;
  deletedAt: null;
  itemsSPB: ItemsSPB[];
  purchaseOrder: PurchaseOrder;
}

export interface ItemsSPB {
  id: string;
  spbId: string;
  productId: string;
  quantity: number;
  unitPrice: null;
  total: number;
  orderNumber: string;
  customerName: string;
  stockProduct: number;
  priceProduct: number;
  kodeBarangProduct: string;
  namabarangProduct: string;
  namabarangProductInvoice: string;
  spesifikasiProduct: string;
  beratproduct: number;
  kategoriProduct: string;
  satuanProduct: string;
  unitProduct: string;
  isCekPajak: boolean;
  typeSalesSPb: string;
  timestamp: Date;
  date: Date;
  deletedAt: null;
}

export interface PurchaseOrder {
  id: string;
  customerId: string;
  staffId: string;
  orderNumber: string;
  date: Date;
  description: string;
  franco: string;
  fileUrl: string;
  subtotalAmount: number;
  approvedFile: null;
  customerName: string;
  status: string;
  typePo: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt: null;
  deletedAt: null;
  fileUrlSigned: null;
  selectionStatus: string;
  selectionStatusInvoice: string;
  taxAmount: null;
  totalAmount: null;
  cekPajak: string;
  customer: Customer;
  items: Item[];
}

export interface Customer {
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

export interface Item {
  id: string;
  purchaseOrderId: string;
  quantity: number;
  orderNumber: string;
  orderDate: Date;
  total: number;
  stockProduct: number;
  priceProduct: number;
  kodeBarangProduct: string;
  namabarangProduct: string;
  namabarangProductInvoice: string;
  spesifikasiProduct: string;
  beratproduct: number;
  kategoriProduct: string;
  satuanProduct: string;
  unitPrice: null;
  unitProduct: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: null;
  productId: string;
}

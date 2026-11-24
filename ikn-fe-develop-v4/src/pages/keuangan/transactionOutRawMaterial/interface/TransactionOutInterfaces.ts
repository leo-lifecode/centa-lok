export interface TransactionOutType {
  transactionNumber: string;
  amount: number;
  payAmount: number;
  description: string;
  accountCode: string;
  bank_account_id: string;
  BankaccountCode?: string;
  materialId?: string;
  date: Date | string;
  taxType?: string;
  taxValue?: number;
  accounIdTax: string;
  unit: string;
  to?: string;
  address: string;
}

export type UpdateCashOutRawMaterialPayload = {
  transactionNumber?: string;
  date: string | Date;
  description: string;
  amount: number;
  payAmount: number;
  bank_account_id: string;
  BankaccountCode?: string;
  accountCode?: string;
  unitId?: string;
  to?: string;
  address?: string;
  materialId?: string;
  taxType?: string;
  taxValue?: number;
  accounIdTax?: string;
  numberJurnal?: string;
  kategori?: string;
  cashBankTransactionDetails: {
    unitId?: string;
    description: string;
    accountCode?: string;
    accountName?: string;
    keterangan?: string;
    debit?: number;
    credit?: number;
  }[];
};

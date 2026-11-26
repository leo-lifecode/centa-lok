/**
 * Teks konfirmasi hapus jurnal, berbeda tiap tipe jurnal.
 * Isi `description` menjelaskan konsekuensi penghapusan sesuai perilaku backend saat ini.
 */
export interface DeleteJurnalConfirmSource {
  rawMaterialIssueId?: string | null;
  rawMaterialReceiptId?: string | null;
  transactionId?: string | null;
  transaction?: { type?: string | null; currency?: string | null; isMaterial?: string | null } | null;
  spbId?: string | null;
  sPBTaxId?: string | null;
  purchaseOrderTaxId?: string | null;
  is_intercompany?: boolean | null;
}

export interface DeleteJurnalConfirm {
  title: string;
  description: string;
}

const COMMON = 'Saran penyesuaian jurnal ikut dihapus permanen. Jurnal turunan (mirror), jika ada, ikut dihapus.';

export const getDeleteJurnalConfirm = (record: DeleteJurnalConfirmSource): DeleteJurnalConfirm => {
  const title = 'Hapus jurnal ini?';

  if (record?.rawMaterialIssueId) {
    return {
      title: 'Hapus jurnal Barang Material (Pengeluaran)?',
      description:
        'Stok pengeluaran dikembalikan dan dokumen di Gudang → Barang Material (Pengeluaran) kembali bisa disesuaikan, dihapus, atau diposting ulang. Jurnal ini hilang dari daftar Jurnal.',
    };
  }

  if (record?.rawMaterialReceiptId) {
    return {
      title: 'Hapus jurnal Barang Material (Penerimaan)?',
      description:
        'Stok penerimaan dikembalikan dan dokumen di Gudang → Barang Material (Penerimaan) berstatus REVERTED sehingga bisa disesuaikan, dihapus, atau diposting ulang. Jurnal ini hilang dari daftar Jurnal.',
    };
  }

  if (record?.transactionId) {
    const type = record.transaction?.type;
    const currency = record.transaction?.currency === 'DOLLAR' ? 'Dollar' : 'Rp';

    if (type === 'CASH_IN') {
      return {
        title: `Hapus jurnal Uang Masuk Bank (${currency})?`,
        description: `Hanya jurnal yang dihapus. Data transaksi di menu Uang Masuk Bank (${currency}), saldo bank, dan invoice tidak ikut terhapus atau berubah. ${COMMON}`,
      };
    }

    if (type === 'CASH_OUT' && record.transaction?.isMaterial === 'Y') {
      return {
        title: 'Hapus jurnal Kas Keluar Material (Rp)?',
        description: `Hanya jurnal yang dihapus. Data di menu Kas Keluar Material dan saldo bank tidak ikut terhapus. Setelah jurnal dihapus, data Kas Keluar Material tidak bisa diedit lagi karena membutuhkan jurnal. ${COMMON}`,
      };
    }

    if (type === 'CASH_OUT') {
      return {
        title: 'Hapus jurnal Kas Keluar (Rp)?',
        description: `Hanya jurnal yang dihapus. Data transaksi di menu Kas Keluar (Rp) dan saldo bank tidak ikut terhapus atau berubah. ${COMMON}`,
      };
    }
  }

  if (record?.spbId) {
    return {
      title: 'Hapus jurnal SPB?',
      description: `Hanya jurnal yang dihapus. Data SPB di menu Akuntansi tidak ikut terhapus. ${COMMON}`,
    };
  }

  if (record?.sPBTaxId || record?.purchaseOrderTaxId) {
    return {
      title: 'Hapus jurnal Cek Pajak?',
      description: `Hanya jurnal yang dihapus. Data Cek Pajak tidak ikut terhapus. ${COMMON}`,
    };
  }

  return {
    title,
    description: `Jurnal dihapus dan tidak dapat dikembalikan. ${COMMON}`,
  };
};

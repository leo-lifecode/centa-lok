import dayjs, { Dayjs } from 'dayjs';
import { captureError } from '@/api/axiosInstance';

export const findDuplicateObjects = (arr: any) => {
  const seen = new Set();
  const duplicates = new Set();
  return arr.filter(({ accountCode }: any) => {
    if (seen.has(accountCode)) {
      duplicates.add(accountCode);
      return true;
    }
    seen.add(accountCode);
    return false;
  });
};

export const openUrl = (url: string) => {
  window.open(url);
};

// Pesan teknis dari browser/axios/JS diganti kalimat yang mudah dipahami.
const friendlyTechnicalMessage = (msg: unknown, fallback: string): string => {
  const raw = Array.isArray(msg) ? msg.join('; ') : String(msg ?? '');
  if (/^Network Error$/i.test(raw))
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.';
  if (/timeout|ECONNABORTED|waktu tunggu habis|Transaction already closed/i.test(raw))
    return 'Koneksi lambat atau terputus (waktu tunggu habis). Periksa koneksi jaringan Anda lalu coba lagi.';
  if (/timeout/i.test(raw)) return 'Server terlalu lama merespons. Silakan coba lagi.';
  if (/Request failed with status code 5\d\d/i.test(raw))
    return 'Terjadi kesalahan pada server. Silakan coba lagi.';
  if (/Request failed with status code 404/i.test(raw)) return 'Data yang dicari tidak ditemukan.';
  if (/Request failed with status code 40[03]/i.test(raw))
    return `${fallback}. Mohon periksa kembali isian Anda.`;
  if (/Failed to upload file/i.test(raw))
    return 'File gagal diunggah. Pastikan ukuran dan format file sesuai, lalu coba lagi.';
  if (
    /Cannot read properties|undefined|is not a function|is not defined|Unexpected token/i.test(raw)
  )
    return `${fallback}. Terjadi kendala pada halaman, silakan muat ulang atau hubungi admin.`;
  return raw || fallback;
};

export const handleMessageError = (e: any, text: string = 'Gagal Menambahkan Data') => {
  const rawMessage =
    e?.customMessage?.response?.data?.message ||
    e?.response?.data?.message ||
    e?.customMessage ||
    e?.message ||
    text;
  const message = friendlyTechnicalMessage(rawMessage, text);

  void captureError(e, {
    handled: true,
    uiMessage: message,
    fallbackMessage: text,
  });

  return message;
};

export const handleDate = (date: Dayjs) => {
  return dayjs(date).startOf('day').utc(true).toISOString();
};

export function calculateTax(baseAmount: number, taxes: any) {
  let result = baseAmount;

  taxes.forEach((tax: any) => {
    const amount = baseAmount * tax.taxValue;

    if (tax?.taxType?.toLowerCase().includes('ppn')) {
      result += amount; // pajak penambah
    } else {
      result -= amount; // pajak pengurang
    }
  });

  return result;
}

export function extractCode(str: string): string {
  const match = str.match(/^[A-Za-z]+(\d+\/[A-Za-z0-9]+\/\d{4})$/);

  if (match) {
    return match[1];
  }

  const matchShort = str.match(/^[A-Za-z]+\/(\d+)$/);
  if (matchShort) {
    return matchShort[1];
  }

  return str;
}
export function getPrefix(value: string): string {
  const match = value.match(/^[A-Za-z]+/);
  return match ? match[0] : value;
}

export function validateInvoiceFormat(value: string): boolean {
  const regex = /^[A-Za-z0-9]+\/\d+\/([IVXLCDM]+|\d{1,2})\/\d{4}$/;
  return regex.test(value);
}

export function isValidCode(code: string): boolean {
  const regex = /^[A-Z]{3}\d{2}\/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\/\d{4}$/;

  return regex.test(code);
}

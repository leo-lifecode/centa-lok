import { MenuAccessType } from '@/contexts/AccessContext';
import * as OrderEksporRNInterfaces from '@pages/marketing-rn-ekspor/order-rn-ekspor/interface/OrderEksporRNInterfaces';
import { PDFDocument } from 'pdf-lib';

import dayjs, { Dayjs } from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('id'); // Set default locale ke bahasa Indonesia

export const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
export const filterParams = <T extends Record<string, any>>(params: T): Partial<T> => {
  return Object.keys(params).reduce((acc: any, key) => {
    if (params[key]) {
      acc[key] = params[key];
    }
    return acc;
  }, {} as Partial<T>);
};

export const filterAndRemoveKeys = <T extends Record<string, any>>(
  params: T,
  removeKeys: string[]
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) => value && !removeKeys.includes(key))
  ) as Partial<T>;
};

export const toAntdOptions = (data: any[], value: string, label: string) => {
  return data.map((item) => ({
    value: `${item[value]}$${item[label]}`, // Value yang akan dikirim saat dipilih
    label: item[label], // Label yang akan ditampilkan di dropdown
  }));
};

export const toAntdOptionsValue = (data: any[], value: string, label: string) => {
  return data.map((item) => ({
    value: `${item[value]}`, // Value yang akan dikirim saat dipilih
    label: item[label], // Label yang akan ditampilkan di dropdown
  }));
};

export const toAntdOptionsV2 = (
  data: any[],
  value: string,
  label: string,
  labe2: string | null = null
) => {
  return data.map((item) => ({
    value: item[value], // Value yang akan dikirim saat dipilih
    label: labe2 ? `${item[label]} - ${item[labe2]}` : item[label], // Label yang akan ditampilkan di dropdown
  }));
};

export const colors = [
  'magenta',
  'red',
  'volcano',
  'orange',
  'gold',
  'lime',
  'green',
  'cyan',
  'blue',
  'geekblue',
  'purple',
];

export const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

export const formatter = (value?: string | number): string => {
  // if (!value) return '';
  // const stringValue = value.toString();
  // return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ','); // titik sebagai pemisah ribuan

  if (value === null || value === undefined || value === '') return '';

  const num = Number(value);
  if (isNaN(num)) return '';

  // Format dengan maksimal 2 digit di belakang koma
  const parts = num.toFixed(2).split('.');
  // Gunakan titik sebagai pemisah ribuan
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  // Ganti titik desimal dengan koma
  const formatted = parts.join(',');
  // Hilangkan ",00" kalau desimalnya nol semua
  return parts[1] === '00' ? parts[0] : formatted;
};

export const parser = (value?: string): string => {
  // if (!value) return '';
  // return value.replace(/,/g, ''); // hapus semua koma

  if (!value) return '';

  // Hapus titik ribuan dan ubah koma menjadi titik untuk parsing ke angka
  const clean = value.replace(/\./g, '').replace(',', '.');
  const match = clean.match(/^(\d+)(\.\d{0,2})?/);
  return match ? match[0] : '';
};

export const formatNumber2Digits = (value?: string | number): string => {
  if (value === null || value === undefined || value === '') return '';

  const num = Number(value);
  if (isNaN(num)) return '';

  // Format dengan maksimal 2 digit di belakang koma
  const parts = num.toFixed(2).split('.');
  // Gunakan titik sebagai pemisah ribuan
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  // Ganti titik desimal dengan koma
  const formatted = parts.join(',');
  // Hilangkan ",00" kalau desimalnya nol semua
  return parts[1] === '00' ? parts[0] : formatted;
};

export const parseNumber2Digits = (value?: string): string => {
  if (!value) return '';

  // Hapus titik ribuan dan ubah koma menjadi titik untuk parsing ke angka
  const clean = value.replace(/\./g, '').replace(',', '.');
  const match = clean.match(/^(\d+)(\.\d{0,2})?/);
  return match ? match[0] : '';
};

export const currencyFormatter = (c: number) => {
  return c.toLocaleString('id-ID') || 0;
};

export const currencyFormatterUS = (c: number) => {
  return c.toLocaleString('id-ID') || 0;
};

/**
 * Menghitung pengurangan dengan presisi untuk menghindari floating point error
 */
export const preciseSubtract = (a: number, b: number): number => {
  return parseFloat((Number(a) - Number(b)).toFixed(12));
};

/**
 * Menghitung perkalian dengan presisi untuk menghindari floating point error
 */
export const preciseMultiply = (a: number, b: number): number => {
  return parseFloat((Number(a) * Number(b)).toFixed(12));
};

// Tabel item pesanan tidak menyimpan nilaiSatuan; nilainya diturunkan dari beratproduct / quantity.
export function isiNilaiSatuan(items: any[] = []): any[] {
  return items.map((item: any) => {
    const qty = Number(item?.quantity) || 0;
    const berat = Number(item?.beratproduct) || 0;
    const nilaiSatuan = item?.nilaiSatuan ?? (qty > 0 ? berat / qty : berat);
    return { ...item, nilaiSatuan };
  });
}

export function hitungTotalHarga(products: any): number {
  return products.reduce((total: number, product: any) => {
    return total + product.quantity * product.priceProduct;
  }, 0);
}

export function hitungTotalAsuransi(
  asuransi: OrderEksporRNInterfaces.AdditionalServiceType[]
): number {
  return asuransi?.reduce((total, asuransi) => {
    return total + asuransi?.amount || 0;
  }, 0);
}

export function terbilangRupiah(nominal: number): string {
  if (isNaN(nominal)) return '';
  if (nominal === 0) return 'nol rupiah';
  if (!nominal) return 'no; rupiah';

  const angka = [
    '',
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
  ];
  const tingkat = ['', 'ribu', 'juta', 'miliar', 'triliun'];

  const bacaRatusan = (n: number): string => {
    let str = '';
    const ratus = Math.floor(n / 100);
    const puluh = Math.floor((n % 100) / 10);
    const satuan = n % 10;

    if (ratus > 0) {
      str += ratus === 1 ? 'seratus ' : `${angka[ratus]} ratus `;
    }

    if (puluh > 0) {
      if (puluh === 1) {
        if (satuan === 0) str += 'sepuluh ';
        else if (satuan === 1) str += 'sebelas ';
        else str += `${angka[satuan]} belas `;
        return str.trim();
      } else {
        str += `${angka[puluh]} puluh `;
      }
    }

    if (puluh !== 1 && satuan > 0) {
      str += `${angka[satuan]} `;
    }

    return str.trim();
  };

  // Pisahkan bilangan bulat dan desimal
  const [bagianUtamaStr, bagianDesimalStr] = nominal.toString().split('.');

  // Bagian bulat
  let sisa = parseInt(bagianUtamaStr);
  const hasil: string[] = [];
  let i = 0;

  while (sisa > 0) {
    const kelompok = sisa % 1000;
    if (kelompok !== 0) {
      const str = bacaRatusan(kelompok);
      const label = tingkat[i];
      hasil.unshift(`${str} ${label}`.trim());
    }
    sisa = Math.floor(sisa / 1000);
    i++;
  }

  let hasilGabungan = hasil.join(' ').trim();
  hasilGabungan = hasilGabungan.replace(/^satu ribu/, 'seribu');

  // Bagian desimal (sen)
  let hasilDesimal = '';
  if (bagianDesimalStr && parseInt(bagianDesimalStr) > 0) {
    // Ambil maksimal dua digit desimal
    const desimal = parseInt(bagianDesimalStr.substring(0, 2).padEnd(2, '0'));
    hasilDesimal = bacaRatusan(desimal) + ' sen';
  }

  return hasilDesimal ? `${hasilGabungan} rupiah ${hasilDesimal}` : `${hasilGabungan} rupiah`;
}

export function terbilangDollar(nominal: number): string {
  if (nominal === 0) return 'zero dollars';
  if (!nominal) return 'zero dollars';
  const angka = [
    '',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];

  const puluhan = [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
  ];

  const scale = ['', 'thousand', 'million', 'billion', 'trillion'];

  function convertHundreds(num: number): string {
    let result = '';
    const hundred = Math.floor(num / 100);
    const rest = num % 100;

    if (hundred > 0) {
      result += angka[hundred] + ' hundred';
      if (rest > 0) result += ' ';
    }

    if (rest > 0) {
      if (rest < 20) {
        result += angka[rest];
      } else {
        const tens = Math.floor(rest / 10);
        const unit = rest % 10;
        result += puluhan[tens];
        if (unit > 0) result += '-' + angka[unit];
      }
    }

    return result.trim();
  }

  function convertNumberToWords(num: number): string {
    if (num === 0) return 'zero';
    const parts: string[] = [];
    let sisa = num;
    let i = 0;

    while (sisa > 0) {
      const group = sisa % 1000;
      if (group > 0) {
        const text = convertHundreds(group);
        const label = scale[i];
        parts.unshift(`${text} ${label}`.trim());
      }
      sisa = Math.floor(sisa / 1000);
      i++;
    }

    return parts.join(' ').trim();
  }

  const [dollarPart, centPartRaw] = nominal.toString().split('.');
  const dollars = parseInt(dollarPart, 10);
  const cents = centPartRaw ? parseInt(centPartRaw.padEnd(2, '0').slice(0, 2), 10) : 0;

  let result = convertNumberToWords(dollars) + (dollars === 1 ? ' dollar' : ' dollars');

  if (cents > 0) {
    result += ' and ' + convertNumberToWords(cents) + (cents === 1 ? ' cent' : ' cents');
  }

  return result;
}

// Contoh penggunaan:
// const nominal = 1234567;
// const terbilangNominal =   console.log(terbilangRupiah(100455));
// console.log(`Rp ${nominal.toLocaleString('id')} terbilang: ${terbilangNominal}`);

export const dateFormat = (date: Date) => {
  return dayjs.utc(date).tz('Asia/Jakarta');
};

export const loginSuccess = (response: any) => {
  const { access_token } = response.data;

  // Simpan ke cookie (misalnya expired dalam 1 hari)
  Cookies.set('access_token', access_token, { expires: 1 });
};

export const logout = () => {
  Cookies.remove('access_token');
  window.location.href = '/login';
};

// interface JwtPayload {
//   id: string;
//   sub?: string;
//   name?: string;
//   role?: string | string[];
//   exp: number;
//   iat?: number;
//   [key: string]: any; // agar fleksibel
// }

export interface JwtPayload {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  nik: string;
  jabatan: string;
  deletedAt: null;
  roles: string[];
  iat: number;
  exp: number;
  unitId: string;
  isPusat: boolean;
  isRoot: string;
}

function base64UrlDecode(str: string): string {
  // Ganti karakter base64url ke base64 standar
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Tambah padding '=' jika perlu
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }
  // Decode base64 jadi string
  return atob(base64);
}

export function decodeJwt(): JwtPayload | null {
  try {
    const token = Cookies.get('access_token');
    if (!token) throw null;
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT token format');
    const payload = parts[1];
    const decodedPayload = base64UrlDecode(payload);
    return JSON.parse(decodedPayload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

export const isTokenValid = (token: string): boolean => {
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const now = Date.now() / 1000;
    return decoded.exp > now;
  } catch {
    return false;
  }
};

export const titleCase = (str: string) => {
  try {
    if (!str) return '';
    const lower = str.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  } catch (e) {
    return '';
  }
};

export const ThrowError = (e: any) => {
  throw { customMessage: e };
};

export function omitProps<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
}
// penggunaan
// const cleanedValues = omitProps(values, ['namaRekanan']);

export function convertToKebabCase(text: string) {
  // Mengubah huruf besar menjadi kecil dan memisahkan kata dengan strip "-"
  return text.trim().toLowerCase().replace(/\s+/g, '-');
}

export function umurPiutang(invoiceDate: string | Date): string {
  return `${dayjs().diff(dayjs(invoiceDate), 'day')} Hari`;
}

export const disabledDate = (current: Dayjs): boolean => {
  const today = dayjs();
  const currentMonth = today.month() + 1; // month() is 0-indexed
  const currentYear = today.year();
  // Jika bulan sekarang adalah 6,7, atau 12 → semua tanggal aktif
  if ([6, 7, 12].includes(currentMonth)) {
    return false;
  }

  // Selain itu, hanya izinkan tanggal:
  // - di bulan sekarang
  // - di tahun sekarang
  // - dari hari ini sampai akhir bulan
  const isSameMonth = current.month() + 1 === currentMonth;
  const isSameYear = current.year() === currentYear;
  const isAfterToday = current.isSame(today, 'day') || current.isAfter(today, 'day');

  if (isSameMonth && isSameYear && isAfterToday) {
    return false; // aktif
  }

  return true; // selain itu, disable
};

export const hasAccessButton = (
  access: MenuAccessType[],
  path: string,
  action: 'view' | 'add' | 'edit' | 'delete' | 'approve'
): boolean => {
  const findAccess = access.find((items) => items.children.find((child) => child.path === path));
  const findAccessChild = findAccess?.children.find((items) => items.path === path);
  return findAccessChild?.actions?.[action] === true;
};

export const mergePdfBlobs = async (blobs: Blob[]) => {
  const mergedPdf = await PDFDocument.create();

  for (const blob of blobs) {
    const buffer = await blob.arrayBuffer();
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  const mergedBlob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });

  const url = URL.createObjectURL(mergedBlob);
  const a = document.createElement('a');
  a.href = url;
  window.open(url);
};

export const listYears = () => {
  const currentYear = dayjs().year();
  const years = [];

  for (let i = 0; i < 5; i++) {
    years.push(currentYear - i);
  }
  return years;
};

export function getRandomColorV2(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

export function transformDataToOptions(
  dataByYear: Record<string, { month: string; value: number; product: string }[]>
) {
  const productSet = new Set<string>();

  for (const year in dataByYear) {
    dataByYear[year].forEach((item) => {
      if (item.product) {
        productSet.add(item.product);
      }
    });
  }

  return Array.from(productSet).map((product) => ({
    label: product,
    value: product,
  }));
}

export function terbilangKG(nominal: number): string {
  if (isNaN(nominal)) return '';
  if (nominal === 0) return 'nol KG';
  if (!nominal) return 'no; KG';

  const angka = [
    '',
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
  ];
  const tingkat = ['', 'ribu', 'juta', 'miliar', 'triliun'];

  const bacaRatusan = (n: number): string => {
    let str = '';
    const ratus = Math.floor(n / 100);
    const puluh = Math.floor((n % 100) / 10);
    const satuan = n % 10;

    if (ratus > 0) {
      str += ratus === 1 ? 'seratus ' : `${angka[ratus]} ratus `;
    }

    if (puluh > 0) {
      if (puluh === 1) {
        if (satuan === 0) str += 'sepuluh ';
        else if (satuan === 1) str += 'sebelas ';
        else str += `${angka[satuan]} belas `;
        return str.trim();
      } else {
        str += `${angka[puluh]} puluh `;
      }
    }

    if (puluh !== 1 && satuan > 0) {
      str += `${angka[satuan]} `;
    }

    return str.trim();
  };

  // Pisahkan bilangan bulat dan desimal
  const [bagianUtamaStr, bagianDesimalStr] = nominal.toString().split('.');

  // Bagian bulat
  let sisa = parseInt(bagianUtamaStr);
  const hasil: string[] = [];
  let i = 0;

  while (sisa > 0) {
    const kelompok = sisa % 1000;
    if (kelompok !== 0) {
      const str = bacaRatusan(kelompok);
      const label = tingkat[i];
      hasil.unshift(`${str} ${label}`.trim());
    }
    sisa = Math.floor(sisa / 1000);
    i++;
  }

  let hasilGabungan = hasil.join(' ').trim();
  hasilGabungan = hasilGabungan.replace(/^satu ribu/, 'seribu');

  // Bagian desimal (sen)
  let hasilDesimal = '';
  if (bagianDesimalStr && parseInt(bagianDesimalStr) > 0) {
    // Ambil maksimal dua digit desimal
    const desimal = parseInt(bagianDesimalStr.substring(0, 2).padEnd(2, '0'));
    hasilDesimal = bacaRatusan(desimal) + ' sen';
  }

  return hasilDesimal ? `${hasilGabungan} KG ${hasilDesimal}` : `${hasilGabungan} KG`;
}

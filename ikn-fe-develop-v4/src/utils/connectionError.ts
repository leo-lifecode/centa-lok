export const CONNECTION_ERROR_TITLE = 'Koneksi Bermasalah';
export const CONNECTION_ERROR_MESSAGE =
  'Koneksi lambat atau terputus (waktu tunggu habis). Periksa koneksi jaringan Anda lalu coba lagi.';

const WINDOW_MS = 5000;
let lastConnectionErrorAt = 0;

export const isConnectionError = (error: any): boolean => {
  if (!error) return false;
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') return true;
  if (!error.response && /Network Error|timeout/i.test(String(error.message))) return true;
  const msg = error.response?.data?.message;
  const text = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '');
  return /Koneksi lambat atau terputus|Transaction already closed/i.test(text);
};

export const markConnectionError = () => {
  lastConnectionErrorAt = Date.now();
};

export const hasRecentConnectionError = () => Date.now() - lastConnectionErrorAt < WINDOW_MS;
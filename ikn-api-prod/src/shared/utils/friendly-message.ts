// Mengubah pesan validasi teknis (class-validator) menjadi kalimat Indonesia yang jelas.
const FIELD_LABELS: Record<string, string> = {
	nilaiSatuan: 'Nilai Satuan',
	quantity: 'Jumlah (Qty)',
	productId: 'Barang',
	priceProduct: 'Harga Barang',
	stockProduct: 'Stok Barang',
	beratproduct: 'Berat Total',
	unitPrice: 'Harga Satuan',
	unitProduct: 'Unit',
	kodeBarangProduct: 'Kode Barang',
	namabarangProduct: 'Nama Barang',
	namabarangProductInvoice: 'Nama Barang di Invoice',
	spesifikasiProduct: 'Spesifikasi',
	kategoriProduct: 'Kategori',
	satuanProduct: 'Satuan',
	customerId: 'Customer',
	customerName: 'Nama Customer',
	orderNumber: 'Nomor Pesanan',
	date: 'Tanggal',
	description: 'Keterangan',
	subtotalAmount: 'Subtotal',
	items: 'Item Pesanan',
	taxId: 'Pajak',
	taxType: 'Jenis Pajak',
	taxValue: 'Nilai Pajak',
	amount: 'Jumlah',
	accountCode: 'Nomor Akun',
	bankAccountId: 'Rekening Bank',
	voucherNumber: 'Nomor Voucher',
	email: 'Email',
	password: 'Password',
};

const humanize = (key: string) => {
	if (FIELD_LABELS[key]) return FIELD_LABELS[key];
	const words = key
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]/g, ' ')
		.trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
};

// "items.0.nilaiSatuan" -> "Item ke-1: Nilai Satuan"
const labelFromPath = (path: string) => {
	const parts = path.split('.');
	const field = [...parts].reverse().find((p) => !/^\d+$/.test(p)) ?? path;
	const idx = parts.find((p) => /^\d+$/.test(p));
	const label = humanize(field);
	return idx !== undefined ? `Baris ke-${Number(idx) + 1}: ${label}` : label;
};

const RULES: Array<[RegExp, (label: string, m: RegExpMatchArray) => string]> = [
	[/^(\S+) (?:tidak boleh kosong|wajib diisi|harus diisi)\b.*$/i, (l) => `${l} belum diisi`],
	[/^(\S+) should not be empty$/i, (l) => `${l} belum diisi`],
	[/^(\S+) must be a number.*$/i, (l) => `${l} harus berupa angka`],
	[/^(\S+) must be an integer.*$/i, (l) => `${l} harus berupa bilangan bulat`],
	[/^(\S+) must be a string$/i, (l) => `${l} harus berupa teks`],
	[/^(\S+) must be a boolean.*$/i, (l) => `${l} harus berupa pilihan ya/tidak`],
	[/^(\S+) must be an array$/i, (l) => `${l} harus berupa daftar`],
	[/^(\S+) must be a valid ISO 8601 date string$/i, (l) => `${l} bukan tanggal yang valid`],
	[/^(\S+) must be a Date instance$/i, (l) => `${l} bukan tanggal yang valid`],
	[/^(\S+) must be an email$/i, (l) => `${l} bukan alamat email yang valid`],
	[/^(\S+) must be a UUID.*$/i, (l) => `${l} belum dipilih dengan benar`],
	[/^(\S+) must not be less than (.+)$/i, (l, m) => `${l} tidak boleh kurang dari ${m[2]}`],
	[/^(\S+) must not be greater than (.+)$/i, (l, m) => `${l} tidak boleh lebih dari ${m[2]}`],
	[/^(\S+) must be a positive number$/i, (l) => `${l} harus lebih dari 0`],
	[/^(\S+) must contain at least (\d+) elements$/i, (l) => `${l} minimal harus ada 1 data`],
	[/^(\S+) must be longer than or equal to (\d+) characters$/i, (l, m) => `${l} minimal ${m[2]} karakter`],
	[/^(\S+) must be shorter than or equal to (\d+) characters$/i, (l, m) => `${l} maksimal ${m[2]} karakter`],
	[/^property (\S+) should not exist$/i, (l) => `Data "${l}" tidak dikenali oleh sistem`],
];

const translateOne = (raw: string): { key: string; text: string } => {
	const msg = raw.trim();
	for (const [re, fn] of RULES) {
		const m = msg.match(re);
		if (m) {
			const path = m[1];
			return { key: path, text: fn(labelFromPath(path), m) };
		}
	}
	return { key: msg, text: msg };
};

const GENERIC: Record<string, string> = {
	'An unexpected server error occurred': 'Terjadi kesalahan pada server. Silakan coba lagi, atau hubungi admin jika terus berulang.',
	'An unexpected database error occurred': 'Terjadi kesalahan pada database. Silakan coba lagi, atau hubungi admin jika terus berulang.',
	'Bad Request Exception': 'Data yang dikirim belum lengkap atau belum benar. Mohon periksa kembali isian Anda.',
	'Transaction error: API issue with transaction.':
		'Proses penyimpanan terlalu lama sehingga dibatalkan. Data belum tersimpan, silakan coba lagi.',
	Unauthorized: 'Sesi Anda sudah berakhir. Silakan login kembali.',
	Forbidden: 'Anda tidak memiliki akses untuk melakukan tindakan ini.',
	'Forbidden resource': 'Anda tidak memiliki akses untuk melakukan tindakan ini.',
	'Not Found': 'Data yang dicari tidak ditemukan.',
};

/** Menerima string / array pesan, mengembalikan satu kalimat ramah tanpa duplikat per kolom. */
export function toFriendlyMessage(message: unknown): string {
	const list = (Array.isArray(message) ? message : [message]).filter((m) => typeof m === 'string') as string[];
	if (list.length === 0) return GENERIC['An unexpected server error occurred'];

	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of list) {
		if (GENERIC[raw]) {
			out.push(GENERIC[raw]);
			continue;
		}
		const { key, text } = translateOne(raw);
		if (seen.has(key)) continue; // satu kolom cukup satu pesan
		seen.add(key);
		out.push(text);
	}
	return out.join('; ');
}

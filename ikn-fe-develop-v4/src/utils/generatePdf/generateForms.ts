import dayjs, { Dayjs } from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './generateInvoicePDF';
import { currencyFormatter, terbilangRupiah, preciseSubtract } from '../helper';
import * as SalesReportInterfaces from '@pages/marketing/sales-report/interface/SalesReportInterfaces';
import * as TransactionOutInterfaces from '@pages/keuangan/transactionOut/interface/TransactionOutInterfaces';

function openPdfInNewTab(doc: jsPDF, _title: string) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// AU-58

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: { finalY: number };
  }
}

function spacedText(text: string, spacing = 1): string {
  return text.split('').join(' '.repeat(spacing));
}

export function generateAU58LikeOriginal(dataPO: any) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const bigBoxX = 10;
  const bigBoxY = 35;
  const bigBoxWidth = 190;
  const bigBoxHeight = 235;
  const paddingInsideBigBox = 8; // jarak padding kiri, kanan, bawah, atas di dalam kotak besar
  // === Text "AU-58" di kanan atas kotak besar ===
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AU-58', bigBoxX + bigBoxWidth - 5, bigBoxY - 2, { align: 'right' });
  // Outer border for full form body (besar)
  doc.rect(bigBoxX, bigBoxY, bigBoxWidth, bigBoxHeight);

  // Header box settings (dalam kotak besar dengan padding)
  const headerStartX = bigBoxX + paddingInsideBigBox;
  const headerStartY = bigBoxY + paddingInsideBigBox;
  const headerAvailableWidth = bigBoxWidth - 2 * paddingInsideBigBox;
  const boxWidth = headerAvailableWidth / 3;
  const boxHeight = 20;

  // Draw 3 equal-width header boxes (kecil) inside big box with padding
  for (let i = 0; i < 3; i++) {
    const x = headerStartX + i * boxWidth;
    doc.rect(x, headerStartY, boxWidth, boxHeight);
  }

  // === Box 1 - LEFT ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const leftX = headerStartX + 3;
  doc.text('PT. INDUSTRI KARET NUSANTARA', leftX, headerStartY + 8);
  doc.text('Kebun  : ', leftX, headerStartY + 14);
  doc.text('Bagian : PRA', leftX, headerStartY + 18);

  // === Box 2 - CENTER ===
  doc.setFontSize(11);
  const centerX = headerStartX + boxWidth + boxWidth / 2;
  doc.text('BON PERMINTAAN DAN ', centerX, headerStartY + 6, {
    align: 'center',
  });

  doc.setFontSize(11);
  doc.text('PENGELUARAN BARANG', centerX, headerStartY + 12, {
    align: 'center',
  });

  // === Box 3 - RIGHT ===
  doc.setFontSize(5);
  const rightX = headerStartX + 2 * boxWidth + 3;
  doc.text(`No: ${dataPO?.orderNumber || '-'}`, rightX, headerStartY + 5);
  doc.text('Tgl diminta:', rightX, headerStartY + 12);
  doc.text(
    `${dataPO?.date ? dayjs(dataPO.date).format('DD MMM YYYY') : '-'}`,
    rightX + 20,
    headerStartY + 12
  );
  doc.text('Tgl diterima:', rightX, headerStartY + 17);
  doc.text(`-`, rightX + 30, headerStartY + 17);

  // Form Details Section (posisi bergeser turun setelah header + padding)
  const detailsY = headerStartY + boxHeight + paddingInsideBigBox;
  // Table Section
  autoTable(doc, {
    startY: detailsY - 5,
    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },
    head: [
      [
        'Kode',
        'Nama Barang',
        'Satuan',
        'Di-\nminta',
        'Di-\nkeluarkan',
        'Harga\nsatuan',
        'Jumlah',
        'Sisa setelah\n dibukukan',
      ],
    ],
    body: [
      // Isi dari dataPO.items
      ...(dataPO?.items ?? []).map((item: any) => {
        return [
          item.kodeBarangProduct || '-',
          item.namabarangProduct || '-',
          item.satuanProduct || '-',
          item.quantity?.toString?.() ?? '-',
          '',
          formatCurrency(item.priceProduct),
          formatCurrency((item.quantity ?? 0) * (item.priceProduct ?? 0)),
        ];
      }),

      // Tambahan baris keterangan
      [
        {
          content: 'Lihat surat pengantar: .',
          colSpan: 7,
          styles: { halign: 'left' },
        },
      ],
      [
        {
          content: `Barang untuk/ Dikirim kepada: ${dataPO?.customer?.name || '-'}`,
          colSpan: 7,
          styles: { halign: 'left' },
        },
      ],
    ],
    styles: { fontSize: 10 },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0], // warna teks hitam
      lineWidth: 0.1, // ketebalan garis
      lineColor: [0, 0, 0], // warna garis hitam
      fontStyle: 'bold',
    },
    theme: 'grid',
  });

  const afterTableY = doc.lastAutoTable!.finalY;

  autoTable(doc, {
    startY: afterTableY,
    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },
    head: [['Diminta Oleh', 'Disetujui Oleh ', 'Dikeluarakan', 'Diterima Oleh', 'Dibukuan Oleh']],
    body: [['', '', '', '', '', '']],
    styles: {
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: { top: 30, bottom: 1 },
      halign: 'center',
      valign: 'bottom',
    },
    headStyles: {
      fillColor: [255, 255, 255], // warna putih = transparan/tanpa warna
      textColor: [0, 0, 0], // warna teks tetap hitam
      lineWidth: 0.1, // ketebalan garis (optional)
    },
    theme: 'grid',
  });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PTP.III-AU-58:50 X 4 lbr', bigBoxX + 2, bigBoxY + bigBoxHeight + 5);
  // Open in new tab
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function generateAU58Do(dataDO: any) {
  const doc = new jsPDF('p', 'mm', 'a4');

  const bigBoxX = 10;
  const bigBoxY = 35;
  const bigBoxWidth = 190;
  const bigBoxHeight = 235;
  const paddingInsideBigBox = 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AU-58', bigBoxX + bigBoxWidth - 5, bigBoxY - 2, {
    align: 'right',
  });

  doc.rect(bigBoxX, bigBoxY, bigBoxWidth, bigBoxHeight);

  const headerStartX = bigBoxX + paddingInsideBigBox;
  const headerStartY = bigBoxY + paddingInsideBigBox;
  const headerAvailableWidth = bigBoxWidth - 2 * paddingInsideBigBox;
  const boxWidth = headerAvailableWidth / 3;

  const leftX = headerStartX + 3;
  const leftMaxWidth = boxWidth - 6;

  const rightX = headerStartX + 2 * boxWidth + 3;
  const rightMaxWidth = boxWidth - 6;

  const companyName = 'PT. INDUSTRI KARET NUSANTARA';
  const kebunText = `Kebun  : ${dataDO?.kebun || '-'}`;
  const orderNumber = `No: ${dataDO?.orderNumber || '-'}`;

  doc.setFont('helvetica', 'bold');

  doc.setFontSize(9);
  const kebunLines = doc.splitTextToSize(kebunText, leftMaxWidth);

  doc.setFontSize(10);
  const orderLines = doc.splitTextToSize(orderNumber, rightMaxWidth);

  const companyY = headerStartY + 7;
  const kebunY = headerStartY + 14;
  const bagianY = kebunY + (kebunLines.length - 1) * 4 + 4;

  const orderY = headerStartY + 7;
  const tanggalDimintaY = headerStartY + 12 + (orderLines.length - 1) * 4;
  const tanggalDiterimaY = tanggalDimintaY + 5;

  const leftContentBottom = bagianY;
  const rightContentBottom = tanggalDiterimaY;

  const contentBottom = Math.max(leftContentBottom, rightContentBottom);

  const minHeaderHeight = 22;
  const boxHeight = Math.max(minHeaderHeight, contentBottom - headerStartY + 5);

  for (let i = 0; i < 3; i++) {
    const x = headerStartX + i * boxWidth;
    doc.rect(x, headerStartY, boxWidth, boxHeight);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  doc.text(companyName, leftX, companyY);
  doc.text(kebunLines, leftX, kebunY);
  doc.text('Bagian : PRA', leftX, bagianY);

  const centerX = headerStartX + boxWidth + boxWidth / 2;

  doc.setFontSize(11);

  doc.text('BON PERMINTAAN DAN', centerX, headerStartY + 7, {
    align: 'center',
  });

  doc.text('PENGELUARAN BARANG', centerX, headerStartY + 13, {
    align: 'center',
  });

  doc.setFontSize(9);

  doc.text(orderLines, rightX, orderY);

  doc.text('Tanggal diminta: ', rightX, tanggalDimintaY);

  doc.text(
    `${dataDO?.date ? dayjs(dataDO.date).format('DD MMM YYYY') : '-'}`,
    rightX + 28,
    tanggalDimintaY
  );

  doc.text('Tanggal diterima: ', rightX, tanggalDiterimaY);

  doc.text('-', rightX + 30, tanggalDiterimaY);

  const detailsY = headerStartY + boxHeight + paddingInsideBigBox;

  autoTable(doc, {
    startY: detailsY - 5,

    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },

    head: [
      [
        'Kode',
        'Nama Barang',
        'Satuan',
        'Di-\nminta',
        'Di-\nkeluarkan',
        'Harga\nsatuan',
        'Jumlah',
        'Sisa setelah\n dibukukan',
      ],
    ],

    body: [
      ...(dataDO?.items ?? []).map((item: any) => {
        return [
          item.kodeBarangProduct || '-',
          item.namabarangProduct || '-',
          item.satuanProduct || '-',
          item.quantity?.toString?.() ?? '-',
          '',
          formatCurrency(item.priceProduct),
          formatCurrency((item.quantity ?? 0) * (item.priceProduct ?? 0)),
          '',
        ];
      }),

      [
        {
          content: 'Lihat surat pengantar: .',
          colSpan: 8,
          styles: {
            halign: 'left',
          },
        },
      ],

      [
        {
          content: `Barang untuk/ Dikirim kepada: ${dataDO?.customer?.name || '-'}`,
          colSpan: 8,
          styles: {
            halign: 'left',
          },
        },
      ],
    ],

    styles: {
      fontSize: 9,
    },

    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },

    theme: 'grid',
  });

  const afterTableY = doc.lastAutoTable!.finalY;

  autoTable(doc, {
    startY: afterTableY,

    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },

    head: [['Diminta Oleh', 'Disetujui Oleh ', 'Dikeluarakan', 'Diterima Oleh', 'Dibukuan Oleh']],

    body: [['', '', '', '', '', '']],

    styles: {
      fontSize: 9,
    },

    bodyStyles: {
      fontSize: 9,
      cellPadding: {
        top: 30,
        bottom: 1,
      },
      halign: 'center',
      valign: 'bottom',
    },

    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      fontSize: 9,
    },

    theme: 'grid',
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text('PTP.III-AU-58:50 X 4 lbr', bigBoxX + 2, bigBoxY + bigBoxHeight + 5);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  return {
    url,
    blob,
  };
}

export function generateAU58DoRA(dataDO: any) {
  const doc = new jsPDF('p', 'mm', 'a4');

  const bigBoxX = 10;
  const bigBoxY = 35;
  const bigBoxWidth = 190;
  const bigBoxHeight = 235;
  const paddingInsideBigBox = 8;

  const purchaseOrder = dataDO?.purchaseOrder ?? dataDO;
  const deliveryOrderDetails = dataDO?.DeliveryOrderDetail ?? [];

  const items =
    deliveryOrderDetails.length > 0 ? deliveryOrderDetails : (purchaseOrder?.items ?? []);

  const isDeliveryOrderData = deliveryOrderDetails.length > 0;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AU-58', bigBoxX + bigBoxWidth - 5, bigBoxY - 2, {
    align: 'right',
  });

  doc.rect(bigBoxX, bigBoxY, bigBoxWidth, bigBoxHeight);

  const headerStartX = bigBoxX + paddingInsideBigBox;
  const headerStartY = bigBoxY + paddingInsideBigBox;
  const headerAvailableWidth = bigBoxWidth - 2 * paddingInsideBigBox;
  const boxWidth = headerAvailableWidth / 3;

  const leftX = headerStartX + 3;
  const leftMaxWidth = boxWidth - 6;

  const rightX = headerStartX + 2 * boxWidth + 3;
  const rightMaxWidth = boxWidth - 6;

  const companyName = 'PT. INDUSTRI KARET NUSANTARA';
  const kebunText = `Kebun  : ${dataDO?.kebun || '-'}`;
  const orderNumber = `No: ${purchaseOrder?.orderNumber || '-'}`;

  doc.setFont('helvetica', 'bold');

  doc.setFontSize(9);
  const kebunLines = doc.splitTextToSize(kebunText, leftMaxWidth);

  doc.setFontSize(10);
  const orderLines = doc.splitTextToSize(orderNumber, rightMaxWidth);

  const companyY = headerStartY + 7;
  const kebunY = headerStartY + 14;
  const bagianY = kebunY + (kebunLines.length - 1) * 4 + 4;

  const orderY = headerStartY + 7;
  const tanggalDimintaY = headerStartY + 12 + (orderLines.length - 1) * 4;
  const tanggalDiterimaY = tanggalDimintaY + 5;

  const leftContentBottom = bagianY;
  const rightContentBottom = tanggalDiterimaY;

  const contentBottom = Math.max(leftContentBottom, rightContentBottom);

  const minHeaderHeight = 22;
  const boxHeight = Math.max(minHeaderHeight, contentBottom - headerStartY + 5);

  for (let i = 0; i < 3; i++) {
    const x = headerStartX + i * boxWidth;
    doc.rect(x, headerStartY, boxWidth, boxHeight);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  doc.text(companyName, leftX, companyY);
  doc.text(kebunLines, leftX, kebunY);
  doc.text('Bagian : PRA', leftX, bagianY);

  const centerX = headerStartX + boxWidth + boxWidth / 2;

  doc.setFontSize(11);

  doc.text('BON PERMINTAAN DAN', centerX, headerStartY + 7, {
    align: 'center',
  });

  doc.text('PENGELUARAN BARANG', centerX, headerStartY + 13, {
    align: 'center',
  });

  doc.setFontSize(9);

  doc.text(orderLines, rightX, orderY);

  doc.text('Tanggal diminta: ', rightX, tanggalDimintaY);

  doc.text(
    `${purchaseOrder?.date ? dayjs(purchaseOrder.date).format('DD MMM YYYY') : '-'}`,
    rightX + 28,
    tanggalDimintaY
  );

  doc.text('Tanggal diterima: ', rightX, tanggalDiterimaY);

  doc.text('-', rightX + 30, tanggalDiterimaY);

  const detailsY = headerStartY + boxHeight + paddingInsideBigBox;

  autoTable(doc, {
    startY: detailsY - 5,

    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },

    head: [
      [
        'Kode',
        'Nama Barang',
        'Satuan',
        'Di-\nminta',
        'Di-\nkeluarkan',
        'Harga\nsatuan',
        'Jumlah',
        'Sisa setelah\n dibukukan',
      ],
    ],

    body: [
      ...(items ?? []).map((item: any) => {
        const quantity = isDeliveryOrderData
          ? Number(item.qtyKirim ?? 0)
          : Number(item.quantity ?? 0);

        const price = Number(item.priceProduct ?? 0);

        const total = isDeliveryOrderData ? Number(item.total ?? 0) : quantity * price;

        return [
          item.kodeBarangProduct || item.kodeBarang || '-',
          item.namabarangProduct || item.namabarangProductInvoice || '-',
          item.satuanProduct || '-',
          quantity.toString(),
          '',
          formatCurrency(price),
          formatCurrency(total),
          '',
        ];
      }),

      [
        {
          content: 'Lihat surat pengantar: .',
          colSpan: 8,
          styles: {
            halign: 'left',
          },
        },
      ],

      [
        {
          content: `Barang untuk/ Dikirim kepada: ${
            purchaseOrder?.customer?.name || purchaseOrder?.customerName || '-'
          }`,
          colSpan: 8,
          styles: {
            halign: 'left',
          },
        },
      ],
    ],

    styles: {
      fontSize: 9,
    },

    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },

    theme: 'grid',
  });

  const afterTableY = doc.lastAutoTable!.finalY;

  autoTable(doc, {
    startY: afterTableY,

    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },

    head: [['Diminta Oleh', 'Disetujui Oleh ', 'Dikeluarakan', 'Diterima Oleh', 'Dibukuan Oleh']],

    body: [['', '', '', '', '', '']],

    styles: {
      fontSize: 9,
    },

    bodyStyles: {
      fontSize: 9,
      cellPadding: {
        top: 30,
        bottom: 1,
      },
      halign: 'center',
      valign: 'bottom',
    },

    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      fontSize: 9,
    },

    theme: 'grid',
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text('PTP.III-AU-58:50 X 4 lbr', bigBoxX + 2, bigBoxY + bigBoxHeight + 5);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  return {
    url,
    blob,
  };
}

export function generateAU53Produck(data: any) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const bigBoxX = 10;
  const bigBoxY = 35;
  const bigBoxWidth = 190;
  const paddingInsideBigBox = 8; // jarak padding kiri, kanan, bawah, atas di dalam kotak besar

  // Header box settings (dalam kotak besar dengan padding)
  const headerStartX = bigBoxX + paddingInsideBigBox;
  const headerStartY = bigBoxY + paddingInsideBigBox;
  const headerAvailableWidth = bigBoxWidth - 2 * paddingInsideBigBox;
  const boxWidth = headerAvailableWidth / 3;
  const boxHeight = 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AU-53', bigBoxX + bigBoxWidth - 8, bigBoxY + 5, { align: 'right' });
  // Draw 3 equal-width header boxes (kecil) inside big box with padding
  for (let i = 0; i < 3; i++) {
    const x = headerStartX + i * boxWidth;
    doc.rect(x, headerStartY, boxWidth, boxHeight);
  }

  // === Box 1 - LEFT ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const leftX = headerStartX + 3;
  doc.text('PT. INDUSTRI KARET NUSANTARA', leftX, headerStartY + 8);
  doc.text('Kebun  : ', leftX, headerStartY + 14);

  // === Box 2 - CENTER ===
  doc.setFontSize(11);
  const centerX = headerStartX + boxWidth + boxWidth / 2;
  doc.text('BUKTI PENERIMAAN ', centerX, headerStartY + 6, { align: 'center' });

  doc.setFontSize(11);
  doc.text('BARANG', centerX, headerStartY + 12, { align: 'center' });

  // === Box 3 - RIGHT ===
  doc.setFontSize(10);
  const rightX = headerStartX + 2 * boxWidth + 3;
  const labels = ['No', 'Tanggal'];
  const values = [
    data?.documentCode || '-',
    data?.date ? dayjs(data.date).format('DD MMM YYYY') : '-',
  ];

  labels.forEach((label, i) => {
    const y = headerStartY + 7 + i * 5;
    doc.text(`${label}`, rightX, y); // label
    doc.text(':', rightX + 15, y); // titik dua sejajar
    doc.text(`${values[i]}`, rightX + 18, y); // value
  });

  // Form Details Section (posisi bergeser turun setelah header + padding)
  const belowHeaderTextY = headerStartY + boxHeight + 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Posisi X untuk masing-masing teks
  const leftTextX = headerStartX;
  const rightTextX = headerStartX + headerAvailableWidth;

  doc.text('Diterima dari : Hasil produksi/pembelian', leftTextX, belowHeaderTextY); // kiri
  doc.text('Surat pengantar: ', rightTextX - 50, belowHeaderTextY, {
    align: 'right',
  }); // kanan

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Tambahkan spasi antar huruf
  const spaced = spacedText('(Leveransi)', 1); // angka 1 = 1 spasi antar huruf, bisa ditambah

  doc.text(spaced, leftTextX + 30, belowHeaderTextY + 5);

  const detailsY = headerStartY + boxHeight + paddingInsideBigBox;

  // Table Section
  autoTable(doc, {
    startY: detailsY + 5,
    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },
    head: [
      ['Kode', 'Nama Barang', 'Satuan', 'Banyak\nditerima', 'Stok\n', 'Harga\nsatuan', 'Jumlah'],
    ],
    body: data?.items.map((item: any) => {
      return [
        item.finishedGood?.kodeBarang || '-',
        item.finishedGood?.namaBarang || '-',
        item.finishedGood?.satuan || '-',
        item.quantity.toString(),
        item?.stok || '-',
        formatCurrency(item.nilaiSatuan || 0),
        formatCurrency(item.Total || 0),
      ];
    }),
    styles: { fontSize: 10 },
    headStyles: {
      fillColor: [255, 255, 255], // warna putih = transparan/tanpa warna
      textColor: [0, 0, 0], // warna teks tetap hitam
      lineWidth: 0.1, // ketebalan garis (optional)
    },
    theme: 'grid',
  });

  const afterTableY = doc.lastAutoTable!.finalY + 7;

  autoTable(doc, {
    startY: afterTableY,
    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },
    head: [['No Surat Pesanan', 'No Faktur', 'Diterima Oleh ', 'Disetujui Oleh', 'Dibukukan Oleh']],
    body: [['', '', '', '', '', '']],
    styles: {
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: { top: 30, bottom: 1 },
      halign: 'center',
      valign: 'bottom',
    },
    headStyles: {
      fillColor: [255, 255, 255], // warna putih = transparan/tanpa warna
      textColor: [0, 0, 0], // warna teks tetap hitam
      lineWidth: 0.1, // ketebalan garis (optional)
    },
    theme: 'grid',
  });
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function generateAU53Mantah(data: any) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const bigBoxX = 10;
  const bigBoxY = 35;
  const bigBoxWidth = 190;
  const paddingInsideBigBox = 8; // jarak padding kiri, kanan, bawah, atas di dalam kotak besar

  // Header box settings (dalam kotak besar dengan padding)
  const headerStartX = bigBoxX + paddingInsideBigBox;
  const headerStartY = bigBoxY + paddingInsideBigBox;
  const headerAvailableWidth = bigBoxWidth - 2 * paddingInsideBigBox;
  const boxWidth = headerAvailableWidth / 3;
  const boxHeight = 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AU-53', bigBoxX + bigBoxWidth - 8, bigBoxY + 5, { align: 'right' });
  // Draw 3 equal-width header boxes (kecil) inside big box with padding
  for (let i = 0; i < 3; i++) {
    const x = headerStartX + i * boxWidth;
    doc.rect(x, headerStartY, boxWidth, boxHeight);
  }

  // === Box 1 - LEFT ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const leftX = headerStartX + 3;
  doc.text('PT. INDUSTRI KARET NUSANTARA', leftX, headerStartY + 8);
  doc.text('Kebun  : ', leftX, headerStartY + 14);

  // === Box 2 - CENTER ===
  doc.setFontSize(11);
  const centerX = headerStartX + boxWidth + boxWidth / 2;
  doc.text('BUKTI PENERIMAAN ', centerX, headerStartY + 6, { align: 'center' });

  doc.setFontSize(11);
  doc.text('BARANG', centerX, headerStartY + 12, { align: 'center' });

  // === Box 3 - RIGHT ===
  doc.setFontSize(10);
  const rightX = headerStartX + 2 * boxWidth + 3;
  const labels = ['No', 'Tanggal'];
  const values = [
    data?.documentCode || '-',
    data?.date ? dayjs(data.date).format('DD MMM YYYY') : '-',
  ];

  labels.forEach((label, i) => {
    const y = headerStartY + 7 + i * 5;
    doc.text(`${label}`, rightX, y); // label
    doc.text(':', rightX + 15, y); // titik dua sejajar
    doc.text(`${values[i]}`, rightX + 18, y); // value
  });

  // Form Details Section (posisi bergeser turun setelah header + padding)
  const belowHeaderTextY = headerStartY + boxHeight + 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Posisi X untuk masing-masing teks
  const leftTextX = headerStartX;
  const rightTextX = headerStartX + headerAvailableWidth;

  doc.text('Diterima dari : Hasil produksi/pembelian', leftTextX, belowHeaderTextY); // kiri
  doc.text('Surat pengantar: ', rightTextX - 50, belowHeaderTextY, {
    align: 'right',
  }); // kanan

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Tambahkan spasi antar huruf
  const spaced = spacedText('(Leveransi)', 1); // angka 1 = 1 spasi antar huruf, bisa ditambah

  doc.text(spaced, leftTextX + 30, belowHeaderTextY + 5);

  const detailsY = headerStartY + boxHeight + paddingInsideBigBox;

  // Table Section
  autoTable(doc, {
    startY: detailsY + 5,
    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },
    head: [
      ['Kode', 'Nama Barang', 'Satuan', 'Banyak\nditerima', 'Stok\n', 'Harga\nsatuan', 'Jumlah'],
    ],
    body: data?.items.map((item: any) => {
      return [
        item.masterRawMaterial?.itemCode || '-',
        item.masterRawMaterial?.itemName || '-',
        item.masterRawMaterial?.satuan || '-',
        item.quantity.toString(),
        item?.stok || '-',
        formatCurrency(item.nilaiSatuan || 0),
        formatCurrency(item.Total || 0),
      ];
    }),
    styles: { fontSize: 10 },
    headStyles: {
      fillColor: [255, 255, 255], // warna putih = transparan/tanpa warna
      textColor: [0, 0, 0], // warna teks tetap hitam
      lineWidth: 0.1, // ketebalan garis (optional)
    },
    theme: 'grid',
  });

  const afterTableY = doc.lastAutoTable!.finalY + 7;

  autoTable(doc, {
    startY: afterTableY,
    margin: {
      left: bigBoxX + paddingInsideBigBox,
      right: bigBoxX + paddingInsideBigBox,
    },
    head: [['No Surat Pesanan', 'No Faktur', 'Diterima Oleh ', 'Disetujui Oleh', 'Dibukukan Oleh']],
    body: [['', '', '', '', '', '']],
    styles: {
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: { top: 30, bottom: 1 },
      halign: 'center',
      valign: 'bottom',
    },
    headStyles: {
      fillColor: [255, 255, 255], // warna putih = transparan/tanpa warna
      textColor: [0, 0, 0], // warna teks tetap hitam
      lineWidth: 0.1, // ketebalan garis (optional)
    },
    theme: 'grid',
  });
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// BTK
export function generateBTKInBrowser() {
  const doc = new jsPDF();
  const typedDoc = doc as jsPDF & { lastAutoTable: { finalY: number } };

  typedDoc.setFontSize(12);
  typedDoc.text('PT. INDUSTRI KARET NUSANTARA', 15, 15);
  typedDoc.text('PRA UNIT', 15, 22);
  typedDoc.text('BUKTI TERIMA KEMBALI (BTK)', 15, 30);
  typedDoc.text('No. Rekg: AU - 58', 15, 40);
  typedDoc.text('Gol. Brg: 630.13.01.00', 15, 47);
  typedDoc.text('Nama Barang: Bahan Dasar Karet - SBR 1502', 15, 54);
  typedDoc.text('Dikembalikan oleh: Mandor Pengolahan - Supria Dinata', 15, 61);

  autoTable(typedDoc, {
    startY: 70,
    head: [['No', 'Tgl', 'Satuan', 'Banyaknya', 'Harga Satuan', 'Jumlah']],
    body: [['PB-109', '31/01/2025', 'kg', '4,44 / 35', '786,663', '960.500']],
    styles: { fontSize: 10 },
  });
  typedDoc.text('Krani Gudang: Ardiansyah', 15, typedDoc.lastAutoTable.finalY + 10);
  typedDoc.text(
    'Manager Operasional: ____________________',
    15,
    typedDoc.lastAutoTable.finalY + 20
  );

  openPdfInNewTab(typedDoc, 'BTK');
}

export function generateAU54(data: any) {
  const allMonths = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  // Buat map bulan → data
  const dataMap = new Map(data?.result?.map((d: any) => [d.month, d]));

  const body = [];

  // Loop hanya untuk bulan yang memiliki data
  for (let i = 0; i < 6; i++) {
    const leftMonth: any = allMonths[i];
    const rightMonth: any = allMonths[i + 6];

    const leftData: any = dataMap.get(leftMonth);
    const rightData: any = dataMap.get(rightMonth);

    // Hanya push baris jika salah satu sisi punya data
    if (leftData || rightData) {
      body.push([
        leftData ? leftMonth : '',
        '',
        leftData ? 'Persediaan' : '',
        leftData ? leftData.masuk : '',
        leftData ? leftData.keluar : '',
        leftData ? leftData.sisa : '',
        rightData ? rightMonth : '',
        '',
        rightData ? 'Persediaan' : '',
        rightData ? rightData.masuk : '',
        rightData ? rightData.keluar : '',
        rightData ? rightData.sisa : '',
      ]);
    }
  }

  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('KARTU GUDANG', 148.5, 20, { align: 'center' });

  // Header kiri
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const xLabel = 14;
  const xValue = 50;
  doc.text('Nama Barang', xLabel, 30);
  doc.text(':', xValue - 2, 30);
  doc.text(data?.namaBarang || '-', xValue, 30);

  doc.text('No Kode', xLabel, 35);
  doc.text(':', xValue - 2, 35);
  doc.text(data?.kodeBarang || '-', xValue, 35);

  doc.text('Spesifikasi', xLabel, 40);
  doc.text(':', xValue - 2, 40);
  doc.text('-', xValue, 40);

  doc.text('Satuan', xLabel, 45);
  doc.text(':', xValue - 2, 45);
  doc.text(data?.satuan || '-', xValue, 45);

  const xLabelRigh = 230;
  const xColon = 275; // posisi titik dua
  const xValueRight = 280;

  doc.text('Nama Rak', xLabelRigh, 30);
  doc.text(':', xColon, 30);
  doc.text(data?.namaRak || '-', xValueRight, 30);

  doc.text('Nomor Kotak / Laci', xLabelRigh, 35);
  doc.text(':', xColon, 35);
  doc.text(data?.nomorKotak || '-', xValueRight, 35);

  doc.text('Nomor Gambar', xLabelRigh, 40);
  doc.text(':', xColon, 40);
  doc.text(data?.nomorGambar || '-', xValueRight, 40);

  doc.text('Persediaan Minimum', xLabelRigh, 45);
  doc.text(':', xColon, 45);
  doc.text(data?.persediaanMinimum?.toString() || '-', xValueRight, 45);

  // Data tabel
  autoTable(doc, {
    startY: 55,
    head: [
      [
        'Bulan',
        'Nomor Bon',
        'Diterima dari\nDipakai untuk',
        'Masuk',
        'Keluar',
        'Sisa',
        'Bulan',
        'Nomor Bon',
        'Diterima dari\nDipakai untuk',
        'Masuk',
        'Keluar',
        'Sisa',
      ],
    ],
    body,
    styles: {
      fontSize: 9,
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255], // tidak ada warna latar belakang
      textColor: [0, 0, 0], // warna teks hitam
      lineWidth: 0.1, // ketebalan garis
      lineColor: [0, 0, 0], // warna garis hitam
      fontStyle: 'bold',
    },
    theme: 'grid',
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function generateReceiptPDF() {
  const doc = new jsPDF();
  const lineHeight = 7;
  let y = 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PT INDUSTRI KARET NUSANTARA', 10, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Kantor Direksi/Pabrik:', 10, (y += lineHeight));
  doc.text('Kantor Direksi PT. IKN', 50, y);

  doc.setFont('helvetica', 'bold');
  doc.text('BUKTI MASUK', 150, 10);
  doc.setFont('helvetica', 'normal');
  doc.text('No.', 150, (y += lineHeight));
  doc.text('B.01.III.2024', 165, y);
  doc.text('Tgl', 150, (y += lineHeight));
  doc.text('01-03-2024', 165, y);

  y += 10;
  doc.setLineWidth(0.5);
  doc.line(10, y, 200, y);

  y += 5;
  doc.text('Kwitansi', 10, y);
  doc.rect(40, y - 4, 5, 5); // kotak kas kosong
  doc.text('KAS', 47, y);
  doc.rect(70, y - 4, 5, 5); // kotak bank tercentang
  doc.text('BANK', 77, y);
  doc.setLineWidth(0.1);

  y += 10;
  doc.text('Diterima dari :', 10, y);
  doc.text('PT. Socfindo Indonesia', 50, y);

  y += lineHeight;
  doc.text('Jumlah Uang :', 10, y);
  doc.text('Rp 16,317,000.00', 50, y);

  y += lineHeight;
  doc.text('                 Enam Belas Juta Tiga Ratus Tujuh Belas Ribu  Rupiah', 50, y);

  y += lineHeight;
  doc.text('Untuk        :', 10, y);

  y += 10;
  doc.line(10, y, 200, y); // garis atas tabel
  y += 5;

  doc.text('Uraian', 12, y);
  doc.text('No.Rekening', 120, y);
  doc.text('Jumlah', 165, y);
  y += 2;
  doc.line(10, y, 200, y); // garis bawah header

  y += 7;
  doc.setFontSize(9);
  doc.text('Penerimaan atas Penjualan Produksi Rubber Articles', 12, y);
  y += lineHeight;
  doc.text('NO.PMS / X / INV / RA / 08 / I / 2024. Rp. 10.878.000.-', 12, y);
  y += lineHeight;
  doc.text('NO.PMS / X / INV / RA / 09 / I / 2024. Rp. 5.439.000.-', 12, y);
  y += lineHeight;
  doc.text('Total Seluruhnya Rp. 16.317.000.-', 12, y);
  doc.text('Rp 16,317,000.00', 165, y);

  y += 5;
  doc.line(10, y, 200, y); // garis bawah tabel

  y += lineHeight;
  doc.setFontSize(10);
  doc.text('Terbilang : Enam Belas Juta Tiga Ratus Tujuh Belas Ribu  Rupiah', 12, y);

  y += 10;
  doc.setFontSize(10);
  doc.text('Diperiksa/Disetujui Oleh :', 10, y);
  doc.text('Dikerjakan Oleh :', 65, y);
  doc.text('Dibukukan Oleh :', 110, y);
  doc.text('Tanggal Penerimaan :', 145, y);

  y += 30;
  doc.setFontSize(10);
  doc.text('Amalia Nst', 15, y);
  doc.text('Sukarman', 70, y);
  doc.text('Khairil Amri', 115, y);
  doc.text('M.Zulham Rambe', 160, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('SEVP Operation', 15, y);
  doc.text('Staf Kas Bank', 70, y);
  doc.text('Leader Akuntansi', 115, y);
  doc.text('Direktur', 160, y);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function generateBuktiMasukPDF(
  data: any,
  datePrint: Dayjs | null,
  other: TransactionOutInterfaces.CashBankTransactionDetails[]
) {
  const doc = new jsPDF();
  const typedDoc = doc as jsPDF & { lastAutoTable: { finalY: number } };

  // Identifikasi jenis akun dari BankAccount
  const bankName = data?.bank_account?.bankName?.trim().toUpperCase();

  const isKas = bankName === 'KAS';
  const isBank = Boolean(bankName) && bankName !== 'KAS';

  const marginLeft = 10;
  const marginTop = 10;
  let y = marginTop;

  // Lebar total halaman jsPDF A4 adalah 210mm
  const totalWidth = 190; // dengan margin kanan 10
  const boxWidth = totalWidth / 3; // jadi 63.33mm per kotak
  const boxHeight = 26; // tinggi kotak

  // === 1. Kotak Kiri ===
  typedDoc.rect(marginLeft, y, boxWidth, boxHeight); // gambar kotak
  typedDoc.setFontSize(10).setFont('helvetica', 'bold');
  typedDoc.text('PT INDUSTRI KARET NUSANTARA', marginLeft + 2, y + 6);

  typedDoc.setFontSize(10).setFont('helvetica', 'normal');
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text(`Kantor Direksi/Pabrik: PUSAT`, marginLeft + 2, y + 12);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('Kantor Direksi PT. IKN', marginLeft + 2, y + 17);

  // === 2. Kotak Tengah ===
  typedDoc.rect(marginLeft + boxWidth, y, boxWidth, boxHeight);
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('BUKTI MASUK', marginLeft + boxWidth + 20, y + 6);

  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('Kwitansi: ', marginLeft + boxWidth + 2, y + 18);
  typedDoc.rect(marginLeft + boxWidth + 20, y + 15, 5, 5); // KAS
  typedDoc.text('KAS', marginLeft + boxWidth + 27, y + 18);

  // ================= CHECKBOX KAS =================
  const kasCheckboxX = marginLeft + boxWidth + 20;
  typedDoc.rect(kasCheckboxX, y + 15, 5, 5);
  if (isKas) {
    typedDoc.setFont('helvetica', 'bold');
    typedDoc.text('V', kasCheckboxX + 1, y + 19);
  }
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('KAS', marginLeft + boxWidth + 27, y + 18);

  // ================= CHECKBOX BANK =================
  const bankCheckboxX = marginLeft + boxWidth + 37;
  typedDoc.rect(bankCheckboxX, y + 15, 5, 5);
  if (isBank) {
    typedDoc.setFont('helvetica', 'bold');
    typedDoc.text('V', bankCheckboxX + 1, y + 19);
  }
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('BANK', marginLeft + boxWidth + 45, y + 18);

  // === 3. Kotak Kanan ===
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.setFontSize(10);
  typedDoc.text('AU-9', marginLeft + 2 * boxWidth + 55, y - 2); // sedikit di atas kotak

  typedDoc.rect(marginLeft + 2 * boxWidth, y, boxWidth, boxHeight);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('No.', marginLeft + 2 * boxWidth + 2, y + 6);
  typedDoc.text(`${data?.transactionNumber || '-'}`, marginLeft + 2 * boxWidth + 17, y + 6);
  typedDoc.text('Tgl', marginLeft + 2 * boxWidth + 2, y + 12);
  typedDoc.text(
    `${dayjs(datePrint).format('DD-MMM-YYYY')}`,
    marginLeft + 2 * boxWidth + 17,
    y + 12
  );
  y += 33;

  // Detail Penerimaan
  const labelX = marginLeft;
  const valueX = marginLeft + 25;
  const dotLine = '.'.repeat(160); // Sesuaikan panjangnya
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(dotLine, valueX, y + 2); // +2 agar tidak menimpa teks

  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Diterima dari', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(`: ${data?.receivedFrom || '-'}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Jumlah Uang', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(`: Rp ${currencyFormatter(data?.amountInIDR || 0)}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.text(`${terbilangRupiah(data?.amountInIDR || 0)}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Untuk', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(`: ${data?.purpose || '-'}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 5;

  const biayaLainnya = other.map((item) => {
    const debit = Number(item.debit) || 0;
    const credit = Number(item.credit) || 0;

    const nominal = debit > 0 ? -debit : credit > 0 ? credit : 0;

    return [item.keterangan, item.accountCode, `Rp ${currencyFormatter(Number(nominal) || 0)}`];
  });

  // Tabel Rincian
  autoTable(typedDoc, {
    startY: y + 5,
    margin: { left: marginLeft - 3 },
    head: [['Uraian', 'No. Rekening', 'Jumlah']],
    body: [
      [`Harga Barang`, `-`, `Rp ${currencyFormatter(Number(data?.grossAmount) || 0)}`],
      [
        `PPN`,
        `${data?.invoice?.invoiceTaxes[0]?.tax?.accountCode || '-'}`,
        `Rp ${currencyFormatter(Number(data?.invoice?.invoiceTaxes[0]?.taxAmount) || 0)}`,
      ],
      ...biayaLainnya,
      [
        {
          content: 'Total Seluruhnya',
          colSpan: 2,
          styles: { halign: 'left', fontStyle: 'bold' },
        },
        `Rp ${currencyFormatter(data?.amountInIDR || 0)}`,
      ],

      [
        {
          content: `${terbilangRupiah(data?.amountInIDR || 0)}`,
          colSpan: 3,
          styles: { halign: 'left', fontStyle: 'bold' },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0], // warna garis hitam
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [0, 0, 0], // warna garis hitam
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 44 },
      2: { cellWidth: 53, halign: 'right' },
    },
  });

  const finalY = typedDoc.lastAutoTable.finalY || y + 35;

  // Tabel Tanda Tangan
  autoTable(typedDoc, {
    startY: finalY,
    margin: { left: marginLeft - 3 },
    head: [
      [
        'Diperikasa/Disetujui Oleh',
        'Dikerjakan Oleh',
        'Dibukukan Oleh',
        'Tgl Penerimaan',
        'Tangga tangan penerima Oleh',
      ],
    ],
    body: [
      [
        '',
        '',
        '',
        '',
        // `${data?.date ? dayjs(data?.date).format('dddd, DD MMM YYYY') : '-'}`,
        '',
      ],
    ],
    styles: {
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: { top: 35 },
      halign: 'center',
      valign: 'bottom',
      lineColor: [0, 0, 0], // warna garis hitam
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0], // warna garis hitam
      halign: 'center',
    },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 39 },
      1: { cellWidth: 39 },
      2: { cellWidth: 39 },
      3: { cellWidth: 40, halign: 'center' },
      4: { cellWidth: 40 },
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.halign = 'center';
        data.cell.styles.valign = 'middle'; // opsional kalau udah cukup pakai padding
        data.cell.styles.cellPadding = { top: 17, bottom: 18 }; // hanya kolom 3
      }
    },
  });

  // Gambar kotak pembungkus (setelah semua konten digambar)
  const contentBottom = typedDoc.lastAutoTable.finalY;
  const padding = 3;

  typedDoc.setLineWidth(0.1);
  typedDoc.rect(
    marginLeft - padding, // x
    marginTop - padding - 3, // y
    201 - (marginLeft - padding * 2), // width (A4 width 210 - margin)
    contentBottom - marginTop + padding * 2 // height
  );

  const blob = typedDoc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function generateBuktiMasukDollarPDF(
  data: any,
  datePrint: Dayjs | null,
  other: TransactionOutInterfaces.CashBankTransactionDetails[]
) {
  const doc = new jsPDF();
  const typedDoc = doc as jsPDF & { lastAutoTable: { finalY: number } };
  const bankName = data?.bank_account?.bankName?.trim().toUpperCase();

  const isKas = bankName === 'KAS';
  const isBank = Boolean(bankName) && bankName !== 'KAS';

  const sumClean =
    Number(other.find((item) => item.accountCode === data.bank_account?.accountCode)?.debit || 0) *
    data.exchangeRate;

  const marginLeft = 10;
  const marginTop = 10;
  let y = marginTop;

  // Lebar total halaman jsPDF A4 adalah 210mm
  const totalWidth = 190; // dengan margin kanan 10
  const boxWidth = totalWidth / 3; // jadi 63.33mm per kotak
  const boxHeight = 26; // tinggi kotak

  // === 1. Kotak Kiri ===
  typedDoc.rect(marginLeft, y, boxWidth, boxHeight); // gambar kotak
  typedDoc.setFontSize(10).setFont('helvetica', 'bold');
  typedDoc.text('PT INDUSTRI KARET NUSANTARA', marginLeft + 2, y + 6);

  typedDoc.setFontSize(10).setFont('helvetica', 'normal');
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text(`Kantor Direksi/Pabrik: PUSAT`, marginLeft + 2, y + 12);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('Kantor Direksi PT. IKN', marginLeft + 2, y + 17);

  // === 2. Kotak Tengah ===
  typedDoc.rect(marginLeft + boxWidth, y, boxWidth, boxHeight);
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('BUKTI MASUK', marginLeft + boxWidth + 20, y + 6);

  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('Kwitansi: ', marginLeft + boxWidth + 2, y + 18);
  typedDoc.rect(marginLeft + boxWidth + 20, y + 15, 5, 5); // KAS
  typedDoc.text('KAS', marginLeft + boxWidth + 27, y + 18);

  // Checkbox KAS
  const kasCheckboxX = marginLeft + boxWidth + 20;
  typedDoc.rect(kasCheckboxX, y + 15, 5, 5);
  if (isKas) {
    typedDoc.setFont('helvetica', 'bold');
    typedDoc.text('V', kasCheckboxX + 1, y + 19);
  }
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('KAS', marginLeft + boxWidth + 27, y + 18);

  // Checkbox BANK
  const bankCheckboxX = marginLeft + boxWidth + 37;
  typedDoc.rect(bankCheckboxX, y + 15, 5, 5);
  if (isBank) {
    typedDoc.setFont('helvetica', 'bold');
    typedDoc.text('V', bankCheckboxX + 1, y + 19);
  }
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('BANK', marginLeft + boxWidth + 45, y + 18);

  // === 3. Kotak Kanan ===
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.setFontSize(10);
  typedDoc.text('AU-9', marginLeft + 2 * boxWidth + 55, y - 2); // sedikit di atas kotak

  typedDoc.rect(marginLeft + 2 * boxWidth, y, boxWidth, boxHeight);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('No.', marginLeft + 2 * boxWidth + 2, y + 6);
  typedDoc.text(`${data?.transactionNumber || '-'}`, marginLeft + 2 * boxWidth + 17, y + 6);
  typedDoc.text('Tgl', marginLeft + 2 * boxWidth + 2, y + 12);
  typedDoc.text(
    `${dayjs(datePrint).format('DD-MMM-YYYY')}`,
    marginLeft + 2 * boxWidth + 17,
    y + 12
  );
  y += 33;

  // Detail Penerimaan
  const labelX = marginLeft;
  const valueX = marginLeft + 25;
  const dotLine = '.'.repeat(160); // Sesuaikan panjangnya
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(dotLine, valueX, y + 2); // +2 agar tidak menimpa teks

  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Diterima dari', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(`: ${data?.receivedFrom || '-'}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Jumlah Uang', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(`: Rp ${currencyFormatter(Number(sumClean))}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.text(`${terbilangRupiah(Number(sumClean))}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Untuk', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(`: ${data?.purpose || '-'}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 5;

  const biayaLainnya = other
    .filter((item) => Number(item.debit) > 0)
    .map((item) => [
      item.keterangan,
      item.accountCode,
      `Rp ${currencyFormatter(Number(item.debit) * Number(data?.exchangeRate || 0))}`,
    ]);

  // Tabel Rincian
  autoTable(typedDoc, {
    startY: y + 5,
    margin: { left: marginLeft - 3 },
    head: [['Uraian', 'No. Rekening', 'Jumlah']],
    body: [
      ...biayaLainnya,
      [
        {
          content: 'Total Seluruhnya',
          colSpan: 2,
          styles: { halign: 'left', fontStyle: 'bold' },
        },
        `Rp ${currencyFormatter(data?.amountInIDR || 0)}`,
      ],

      [
        {
          content: `${terbilangRupiah(data?.amountInIDR || 0)}`,
          colSpan: 3,
          styles: { halign: 'left', fontStyle: 'bold' },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 2,
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.1,
      halign: 'center',
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 44 },
      2: { cellWidth: 53, halign: 'right' },
    },
  });

  const finalY = typedDoc.lastAutoTable.finalY || y + 35;

  // Tabel Tanda Tangan
  autoTable(typedDoc, {
    startY: finalY,
    margin: { left: marginLeft - 3 },
    head: [
      [
        'Diperikasa/Disetujui Oleh',
        'Dikerjakan Oleh',
        'Dibukukan Oleh',
        'Tgl Penerimaan',
        'Tangga tangan penerima Oleh',
      ],
    ],
    body: [
      [
        '',
        '',
        '',
        '',
        // `${data?.date ? dayjs(data?.date).format('dddd, DD MMM YYYY') : '-'}`,
        '',
      ],
    ],
    styles: {
      fontSize: 10,
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: { top: 35 },
      halign: 'center',
      valign: 'bottom',
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      halign: 'center',

      lineColor: [0, 0, 0],
    },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 39 },
      1: { cellWidth: 39 },
      2: { cellWidth: 39 },
      3: { cellWidth: 40, halign: 'center' },
      4: { cellWidth: 40 },
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.halign = 'center';
        data.cell.styles.valign = 'middle'; // opsional kalau udah cukup pakai padding
        data.cell.styles.cellPadding = { top: 17, bottom: 18 }; // hanya kolom 3
      }
    },
  });

  // Gambar kotak pembungkus (setelah semua konten digambar)
  const contentBottom = typedDoc.lastAutoTable.finalY;
  const padding = 3;

  typedDoc.setLineWidth(0.1);
  typedDoc.rect(
    marginLeft - padding, // x
    marginTop - padding - 3, // y
    201 - (marginLeft - padding * 2), // width (A4 width 210 - margin)
    contentBottom - marginTop + padding * 2 // height
  );

  const blob = typedDoc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function generateBuktiKeluarPDF(
  data: any,
  datePrint: Dayjs | null,
  other: TransactionOutInterfaces.CashBankTransactionDetails[]
) {
  const doc = new jsPDF();
  const typedDoc = doc as jsPDF & { lastAutoTable: { finalY: number } };
  const bankName = data?.bank_account?.bankName?.trim().toUpperCase();

  const isKas = bankName === 'KAS';
  const isBank = Boolean(bankName) && bankName !== 'KAS';

  const marginLeft = 10;
  const marginTop = 10;
  let y = marginTop;

  // Lebar total halaman jsPDF A4 adalah 210mm
  const totalWidth = 190; // dengan margin kanan 10
  const boxWidth = totalWidth / 3; // jadi 63.33mm per kotak
  const boxHeight = 26; // tinggi kotak

  // === 1. Kotak Kiri ===
  typedDoc.rect(marginLeft, y, boxWidth, boxHeight); // gambar kotak
  typedDoc.setFontSize(10).setFont('helvetica', 'bold');
  typedDoc.text('PT INDUSTRI KARET NUSANTARA', marginLeft + 2, y + 6);

  typedDoc.setFontSize(10).setFont('helvetica', 'normal');
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text(
    `Kantor Direksi/Pabrik: ${data?.unit?.nama && data?.unit.nama.toUpperCase()}`,
    marginLeft + 2,
    y + 12
  );
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('Kantor Direksi PT. IKN', marginLeft + 2, y + 17);

  // === 2. Kotak Tengah ===
  typedDoc.rect(marginLeft + boxWidth, y, boxWidth, boxHeight);
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('BUKTI KELUAR', marginLeft + boxWidth + 20, y + 6);

  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('Kwitansi: ', marginLeft + boxWidth + 2, y + 18);
  typedDoc.rect(marginLeft + boxWidth + 20, y + 15, 5, 5); // KAS
  typedDoc.text('KAS', marginLeft + boxWidth + 27, y + 18);

  // Checkbox KAS
  const kasCheckboxX = marginLeft + boxWidth + 20;
  typedDoc.rect(kasCheckboxX, y + 15, 5, 5);
  if (isKas) {
    typedDoc.setFont('helvetica', 'bold');
    typedDoc.text('V', kasCheckboxX + 1, y + 19);
  }
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('KAS', marginLeft + boxWidth + 27, y + 18);

  // Checkbox BANK
  const bankCheckboxX = marginLeft + boxWidth + 37;
  typedDoc.rect(bankCheckboxX, y + 15, 5, 5);
  if (isBank) {
    typedDoc.setFont('helvetica', 'bold');
    typedDoc.text('V', bankCheckboxX + 1, y + 19);
  }
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('BANK', marginLeft + boxWidth + 45, y + 18);

  // === 3. Kotak Kanan ===
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.setFontSize(10);
  typedDoc.text('AU-9', marginLeft + 2 * boxWidth + 55, y - 2); // sedikit di atas kotak

  typedDoc.rect(marginLeft + 2 * boxWidth, y, boxWidth, boxHeight);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text('No.', marginLeft + 2 * boxWidth + 2, y + 6);
  typedDoc.text(`${data?.transactionNumber || '-'}`, marginLeft + 2 * boxWidth + 17, y + 6);
  typedDoc.text('Tgl', marginLeft + 2 * boxWidth + 2, y + 12);
  typedDoc.text(
    `${dayjs(datePrint).format('DD-MMM-YYYY')}`,
    marginLeft + 2 * boxWidth + 17,
    y + 12
  );
  y += 33;

  // Detail Penerimaan
  const labelX = marginLeft;
  const valueX = marginLeft + 25;
  const dotLine = '.'.repeat(160); // Sesuaikan panjangnya
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(dotLine, valueX, y + 2); // +2 agar tidak menimpa teks

  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Penerima', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(`: ${data?.to || '-'}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Jumlah Uang', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  typedDoc.text(`: Rp ${currencyFormatter(data?.amountInIDR || 0)}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.text(`${terbilangRupiah(data?.amountInIDR || 0)}`, valueX, y);
  typedDoc.text('.'.repeat(160), valueX, y + 2); // garis bawah titik-titik

  y += 7;
  typedDoc.setFont('helvetica', 'bold');
  typedDoc.text('Alamat', labelX, y);
  typedDoc.setFont('helvetica', 'normal');
  // wrap panjang alamat ke beberapa baris agar tidak keluar kotak
  const rightBound = marginLeft + totalWidth - 2;
  const maxWidth = rightBound - valueX;
  const addressText = data?.address || '-';
  const addressLines = typedDoc.splitTextToSize(`: ${addressText}`, maxWidth);
  const lineHeight = 7;
  addressLines.forEach((line: any, i: number) => {
    const lineY = y + i * lineHeight;
    typedDoc.text(line, valueX, lineY);
    typedDoc.setLineWidth(0.1);
    typedDoc.line(valueX, lineY + 2, rightBound, lineY + 2); // garis bawah per baris
  });
  y += addressLines.length * lineHeight;

  y += 5;

  const biayaLainnya = other.map((item) => {
    const debit = Number(item.debit) || 0;
    const credit = Number(item.credit) || 0;

    const nominal = debit > 0 ? debit : credit > 0 ? -credit : 0;

    return [item.keterangan, item.accountCode, `Rp ${currencyFormatter(Number(nominal) || 0)}`];
  });

  // Tabel Rincian
  autoTable(typedDoc, {
    startY: y + 5,
    margin: { left: marginLeft - 3 },
    head: [['Uraian', 'No. Rekening', 'Jumlah']],
    body: [
      ...biayaLainnya,
      [
        {
          content: 'Total Seluruhnya',
          colSpan: 2,
          styles: { halign: 'left', fontStyle: 'bold' },
        },
        `Rp ${currencyFormatter(data?.amountInIDR || 0)}`,
      ],

      [
        {
          content: `${terbilangRupiah(data?.amountInIDR || 0)}`,
          colSpan: 3,
          styles: { halign: 'left', fontStyle: 'bold' },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 2,
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.1,
      halign: 'center',
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 44 },
      2: { cellWidth: 53, halign: 'right' },
    },
  });

  const finalY = typedDoc.lastAutoTable.finalY || y + 35;

  // Tabel Tanda Tangan
  autoTable(typedDoc, {
    startY: finalY,
    margin: { left: marginLeft - 3 },
    head: [
      [
        'Diperikasa/Disetujui Oleh',
        'Dikerjakan Oleh',
        'Dibukukan Oleh',
        'Tgl Penerimaan',
        'Tangga tangan penerima Oleh',
      ],
    ],
    body: [
      [
        '',
        '',
        '',
        '',
        // `${data?.date ? dayjs(data?.date).format('dddd, DD MMM YYYY') : '-'}`,
        '',
      ],
    ],
    styles: {
      fontSize: 10,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: { top: 35 },
      halign: 'center',
      valign: 'bottom',
      lineColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      halign: 'center',
      lineColor: [0, 0, 0],
    },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 39 },
      1: { cellWidth: 39 },
      2: { cellWidth: 39 },
      3: { cellWidth: 40, halign: 'center' },
      4: { cellWidth: 40 },
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.halign = 'center';
        data.cell.styles.valign = 'middle'; // opsional kalau udah cukup pakai padding
        data.cell.styles.cellPadding = { top: 17, bottom: 18 }; // hanya kolom 3
      }
    },
  });

  // Gambar kotak pembungkus (setelah semua konten digambar)
  const contentBottom = typedDoc.lastAutoTable.finalY;
  const padding = 3;

  typedDoc.setLineWidth(0.1);
  typedDoc.rect(
    marginLeft - padding, // x
    marginTop - padding - 3, // y
    201 - (marginLeft - padding * 2), // width (A4 width 210 - margin)
    contentBottom - marginTop + padding * 2 // height
  );

  const blob = typedDoc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export const generateSalesReport = (
  data: SalesReportInterfaces.SalesReportInterfaces[],
  title: string = 'Laporan Penjualan RA',
  periode?: any
) => {
  const startDate = periode?.[0]?.format('DD MMM YYYY') || '-';
  const endDate = periode?.[1]?.format('DD MMM YYYY') || '-';
  const doc = new jsPDF('l', 'mm', 'a4'); // Gunakan landscape agar lebih rapih

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.getWidth() - titleWidth) / 2, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateRange = `Periode: ${startDate} - ${endDate}`;
  const dateRangeWidth = doc.getTextWidth(dateRange);
  doc.text(dateRange, (doc.internal.pageSize.getWidth() - dateRangeWidth) / 2, 22);

  const dataNew = data.map((items: any, index: number) => {
    const number = index + 1;
    const tanggal = items.date ? dayjs(items.date).format('DD MMM YYYY') : '-';
    const priceProduct = items.priceProduct || 0;
    const subtotal = items.priceProduct * items.quantity;
    const hargaProduk = items.priceProduct * items.quantity;
    const subtotalSpb = items?.spb?.subtotalAmount || 0;
    const taxAmountSpb = Number(items?.spb?.taxAmount) || 0;
    const ppnSpb = preciseSubtract(taxAmountSpb, subtotalSpb); // total PPN di SPB ini

    // Hitung proporsi PPN untuk produk ini
    const ppnProduk = subtotalSpb > 0 ? (hargaProduk / subtotalSpb) * ppnSpb : 0;

    return [
      number,
      items.orderNumber || '-',
      tanggal,
      items.customerName || '-',
      items.namabarangProduct || '-',
      items.quantity.toString(),
      `Rp${currencyFormatter(priceProduct)}`,
      `Rp${currencyFormatter(subtotal)}`,
      `Rp${currencyFormatter(ppnProduk || 0)}`,
      `Rp${currencyFormatter(Math.round(hargaProduk + ppnProduk))}`,
    ];
  });

  autoTable(doc, {
    startY: 30,
    head: [
      [
        'No',
        'No Pesanan',
        'Tanggal Pesanan',
        'Pelanggan',
        'Produk',
        'Jumlah',
        'Harga',
        'Subtotal',
        'PPN',
        'Total Akhir',
      ],
    ],
    body: dataNew,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 35 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'left' },
      4: { halign: 'left' },
      5: { halign: 'center', cellWidth: 15 },
      6: { halign: 'right', cellWidth: 28 },
      7: { halign: 'right', cellWidth: 28 },
      8: { halign: 'right', cellWidth: 28 },
      9: { halign: 'right', cellWidth: 35 },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

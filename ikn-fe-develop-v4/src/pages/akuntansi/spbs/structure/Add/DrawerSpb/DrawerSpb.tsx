import { useState } from 'react';
import { Button, Drawer, InputNumber, Space, Table } from 'antd';
import { showNotification } from '@/contexts/services/notificationService';
import * as globalHelpers from '@/utils/helper';
import type { FormInstance, TableColumnsType, TableProps } from 'antd';

interface DataType {
  key: React.Key;
  name: string;
  age: number;
  address: string;
}

export default function DrawerSpb({
  openDrawer,
  seOpenDrawer,
  dataSourceItems,
  setDataSourceItemsSpb,
  dataLogs,
  form,
  typeSalesSPb,
}: Readonly<{
  openDrawer: any;
  seOpenDrawer: Function;
  dataSourceItems: any;
  setDataSourceItemsSpb: Function;
  dataLogs: any;
  form: FormInstance;
  typeSalesSPb: string;
}>) {
  const [selected, setSelected] = useState<any[]>([]);

  const getSisaQty = (record: any) => {
    const qtyDO = Number(record.quantity ?? record.qtyKirim ?? 0);

    const totalQtyKirimSPB = (dataLogs ?? [])
      .filter((itemLog: any) => itemLog.deliveryOrderDetailId === record.id)
      .reduce((total: number, itemLog: any) => {
        return total + (Number(itemLog.qtyKirim) || 0);
      }, 0);

    return Math.max(qtyDO - totalQtyKirimSPB, 0);
  };

  const columns: TableColumnsType<DataType> = [
    {
      title: 'Nama Barang',
      dataIndex: 'namabarangProduct',
    },
    {
      title: 'Kode Barang',
      dataIndex: 'kodeBarangProduct',
    },
    {
      title: 'Kategori Brang',
      dataIndex: 'kategoriProduct',
    },
    {
      title: 'Jumlah Brang',
      dataIndex: 'quantity',
    },
    ...(typeSalesSPb === 'RA'
      ? [
          {
            title: 'Sisa Qty',
            key: 'sisaQty',
            render: (_: any, record: any) => getSisaQty(record),
          },
          {
            title: 'Qty Kirim',
            dataIndex: 'qtyKirim',
            render: (_: any, record: any) => {
              const isSelected = selected.some((item: any) =>
                typeSalesSPb === 'RA' ? item.id === record.id : item.productId === record.productId
              );

              if (!isSelected) {
                return null;
              }

              const item = selected.find((item: any) =>
                typeSalesSPb === 'RA' ? item.id === record.id : item.productId === record.productId
              );

              const sisaQty = getSisaQty(record);

              return (
                <InputNumber
                  min="0"
                  max={String(sisaQty)}
                  controls={false}
                  stringMode
                  decimalSeparator=","
                  formatter={(value) =>
                    value === undefined || value === null ? '' : String(value).replace('.', ',')
                  }
                  parser={(value) => (value ?? '').replace(',', '.') as any}
                  value={String(item?.qtyKirim ?? 0)}
                  disabled={sisaQty <= 0}
                  style={{ width: 130 }}
                  onChange={(value) => {
                    const qtyInput = Number(String(value ?? 0).replace(',', '.'));

                    const qtyKirim = Math.min(
                      Math.max(Number.isFinite(qtyInput) ? qtyInput : 0, 0),
                      sisaQty
                    );

                    if (qtyInput > sisaQty) {
                      showNotification(
                        'warning',
                        'Qty Kirim melebihi sisa',
                        `Sisa qty ${record.namabarangProduct} tinggal ${sisaQty} (sisanya sudah dikirim di SPB sebelumnya). Qty Kirim disesuaikan menjadi ${sisaQty}.`
                      );
                    }

                    setSelected((prev: any[]) =>
                      prev.map((selectedItem: any) =>
                        (
                          typeSalesSPb === 'RA'
                            ? selectedItem.id === record.id
                            : selectedItem.productId === record.productId
                        )
                          ? { ...selectedItem, qtyKirim }
                          : selectedItem
                      )
                    );
                  }}
                />
              );
            },
          },
        ]
      : []),
    {
      title: 'Satuan Brang',
      dataIndex: 'satuanProduct',
    },
    {
      title: 'Spesifikasi Brang',
      dataIndex: 'spesifikasiProduct',
    },
    {
      title: 'Harga Brang',
      dataIndex: 'priceProduct',
      render: (priceProduct) => {
        const franco = form?.getFieldValue('franco');

        return (
          <span>
            {franco?.toUpperCase() === 'BELAWAN' ? '$' : 'Rp'}
            {globalHelpers.currencyFormatter(priceProduct || 0)}
          </span>
        );
      },
    },
  ];

  const getRowKey = (record: any) => (typeSalesSPb === 'RA' ? record.id : record.productId);

  // Pilihan dikontrol agar centang selalu sama dengan data `selected`
  // dan Qty Kirim yang sudah diisi tidak hilang saat memilih baris lain.
  const rowSelection: TableProps<DataType>['rowSelection'] = {
    selectedRowKeys: selected.map((item: any) => getRowKey(item)),
    preserveSelectedRowKeys: true,
    onChange: (_keys, selectedRows) => {
      setSelected((prev: any[]) =>
        (selectedRows as any[]).map(
          (row: any) => prev.find((item: any) => getRowKey(item) === getRowKey(row)) ?? row
        )
      );
    },
  };

  const onClose = () => {
    seOpenDrawer((prev: any) => ({
      ...prev,
      open: false,
    }));
  };

  const onCancel = () => {
    setSelected([]);
    onClose();
  };

  const dataSource =
    typeSalesSPb === 'RA'
      ? dataSourceItems.filter((item: any) => getSisaQty(item) > 0)
      : dataSourceItems.filter(
          (item: any) => !dataLogs.some((itemLog: any) => itemLog.productId === item.productId)
        );

  return (
    <Drawer
      title="Pilih Barang"
      placement={'right'}
      width={500}
      onClose={onClose}
      open={openDrawer.open}
      extra={
        <Space>
          <Button onClick={onCancel}>Cancel</Button>

          <Button
            type="primary"
            onClick={() => {
              if (selected.length === 0) {
                showNotification('warning', 'Belum ada barang dipilih', 'Centang minimal satu barang terlebih dahulu.');
                return;
              }

              const qtyKosong =
                typeSalesSPb === 'RA'
                  ? selected.filter((item: any) => !(Number(item.qtyKirim) > 0))
                  : [];
              if (qtyKosong.length > 0) {
                showNotification(
                  'warning',
                  'Qty Kirim masih 0',
                  `Masukkan Qty Kirim (lebih dari 0) untuk: ${qtyKosong
                    .map((item: any) => item.namabarangProduct)
                    .join(', ')}.`
                );
                return;
              }

              setDataSourceItemsSpb(selected);
              setSelected([]);
              onClose();
            }}
          >
            OK
          </Button>
        </Space>
      }
    >
      <Table<DataType>
        rowKey={getRowKey}
        scroll={{ x: 'max-content' }}
        rowSelection={{
          type: 'checkbox',
          ...rowSelection,
        }}
        columns={columns}
        dataSource={dataSource}
      />
    </Drawer>
  );
}

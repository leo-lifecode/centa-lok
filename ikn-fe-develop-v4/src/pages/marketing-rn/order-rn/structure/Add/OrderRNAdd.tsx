import { Calendar, Note, Plus, TagChevron, Truck } from '@phosphor-icons/react';
import { Form, Row, Col, Flex, Space, Popconfirm, Tooltip, Upload } from 'antd';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import type { TableColumnsType } from 'antd';
import DrawerOrderPra from './DrawerOrderRN/DrawerOrderRN';
import { DeleteOutlined, HistoryOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import * as OrderRNInterfaces from '@/pages/marketing-rn/order-rn/interface/OrderRNInterfaces';
import { decodeToken } from '@/api/authService';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import * as OrderRNAxios from '@pages/marketing-rn/order-rn/service/OrderRNAxios';
import { showNotification } from '@/contexts/services/notificationService';
import { ButtonEditGroup } from '@/components/atoms/button/buttonTableGroups';
import ModalCustomer from '@/components/ModalCustomer/ModalCustomer';
import * as globalInterfaces from '@/utils/interfaces/interfacesGlobal';
import { handleDate, handleMessageError } from '@/utils/func/func';
import dayjs from 'dayjs';
import { useAppNavigate } from '@/hooks/React/useAppNavigate';
import { useState } from 'react';
import { useEffect } from '@/hooks/React/useEffect';
import { Button, Card, DatePicker, Input, InputNumber, Table } from '@/components/ui';
import ModalHistoriOrder from '../Components/ModalHistoriOrder/ModalHistoriOrder';
import DrawerPajakOrderPra from '@/pages/marketing/order-pra/structure/Components/DrawerOrderPra/DrawerPajakOrderPra';
import { OrderRNInterfacesHistory } from '../../interface/OrderRNInterfacesHistory';

export default function OrderRNAdd() {
  const navigate = useAppNavigate();
  const [form] = Form.useForm();
  const [formItems] = Form.useForm();
  const [openDrawer, seOpenDrawer] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [openHistori, setOpenHistori] = useState<boolean>(false);
  const [customer, setCustomer] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    name: '',
  });

  const [dataSourceItems, setDataSourceItems] = useState<OrderRNInterfaces.ProductType[]>([]);
  const [dataSourcePajak, setDataSourcePajak] = useState<any[]>([]);
  const [openDrawerPajak, setOpenDrawerPajak] = useState({
    open: false,
    totalAmount: 0,
    subtotalAmount: 0,
  });
  const subtotalAmount = Form.useWatch('subtotalAmount', form) || 0;
  const totalPajak = dataSourcePajak.reduce(
    (total, tax) => total + Number(subtotalAmount) * Number(tax.taxValue || 0),
    0
  );
  const totalSetelahPajak = Number(subtotalAmount) + totalPajak;
  const dataSourcePajakDisplay = dataSourcePajak.map((tax) => ({
    ...tax,
    taxAmount: Number(subtotalAmount) * Number(tax.taxValue || 0),
  }));

  const handleSetDataSourcePajak = (updater: any) => {
    setDataSourcePajak((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      const ppnOnly = next.filter((tax: any) =>
        String(tax.taxType || '').toUpperCase().includes('PPN')
      );
      if (ppnOnly.length !== next.length) {
        showNotification('warning', 'Pajak tidak ditambahkan', 'Pesanan RN hanya mendukung PPN.');
      }
      return ppnOnly;
    });
  };

  useEffect(() => {
    const hargaTotal = globalHelpers.hitungTotalHarga(dataSourceItems);
    form.setFieldValue('subtotalAmount', hargaTotal);
  }, [dataSourceItems]);

  const onFinish = async (values: OrderRNInterfaces.PayloadOrderRNType) => {
    try {
      setLoading(true);
      const picked = dataSourceItems.map(
        ({
          productId,
          quantity,
          kategoriProduct,
          kodeBarangProduct,
          namabarangProduct,
          satuanProduct,
          spesifikasiProduct,
          unitProduct,
          priceProduct,
          beratproduct,
          stockProduct,
          namabarangProductInvoice,
          nilaiSatuan,
        }: OrderRNInterfaces.ProductType) => ({
          productId,
          kategoriProduct,
          kodeBarangProduct,
          namabarangProduct,
          satuanProduct,
          spesifikasiProduct,
          unitProduct,
          priceProduct,
          beratproduct,
          stockProduct,
          quantity,
          unitPrice: 0,
          namabarangProductInvoice,
          nilaiSatuan,
        })
      );

      try {
        if (decodeToken()?.id) {
          const formData = new FormData();
          const formDataKontrak = new FormData();
          const originalFile = values.file.originFileObj;
          // Ganti nama file
          const renamedFile = new File(
            [originalFile],
            `${Date.now()}-${originalFile.name}`, // nama file baru
            { type: originalFile.type }
          );

          const originalFileKontrak = values.fileKontrak.originFileObj;
          const renamedFileKontrak = new File(
            [originalFileKontrak],
            `${Date.now()}-${originalFileKontrak.name}-kontrak`, // nama file baru
            { type: originalFileKontrak.type }
          );

          values = {
            ...values,
            description: values.description,
            customerId: values.customerId,
            customerName: values.customerName,
            typePo: 'RN',
            date: handleDate(values.date as any) as any,
            subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
            items: picked,
            totalAmount: totalSetelahPajak,
            taxes: dataSourcePajakDisplay.map((tax) => ({
              taxId: tax.taxId || tax.id,
              taxType: tax.taxType,
              taxValue: Number(tax.taxValue),
              taxAmount: Number(tax.taxAmount),
            })),
            file: renamedFile.name as any,
            fileKontrak: renamedFileKontrak.name as any,
          };

          formData.append('file', renamedFile);
          await OrderRNAxios.uploadFileOrderPra(formData);

          formDataKontrak.append('file', renamedFileKontrak);
          await OrderRNAxios.uploadFileOrderPra(formDataKontrak);
        } else {
          throw new Error('Silahkan Login Kembali');
        }
      } catch (e) {
        throw new Error('Failed to upload file');
      }
      await OrderRNAxios.posOrderRN(values);
      showNotification('success', 'Berhasil', 'Berhasil Menambahkan Data');
      setTimeout(() => {
        navigate('/po-order-prn');
      }, 2000);
      setLoading(false);
      form.resetFields();
    } catch (e: any) {
      setLoading(false);
      const message = handleMessageError(e);
      showNotification('error', 'Gagal', message);
    }
  };

  globalHooks.useFetchOptionsSearch(customer, setCustomer, OrderRNAxios.fetchDataCustomer, []);

  const columns: TableColumnsType<OrderRNInterfaces.ProductType> = [
    {
      title: 'Kode Barang',
      dataIndex: 'kodeBarangProduct',
      key: 'kodeBarangProduct',
      align: 'center',
    },
    {
      title: 'Nama Barang',
      dataIndex: 'namabarangProduct',
      key: 'namabarangProduct',
      align: 'center',
    },
    {
      title: 'Harga',
      dataIndex: 'priceProduct',
      key: 'priceProduct',
      align: 'center',
      render: (priceProduct: number) => {
        return <span>Rp{globalHelpers.currencyFormatter(priceProduct)}</span>;
      },
    },

    {
      title: 'Spesifikasi',
      dataIndex: 'spesifikasiProduct',
      key: 'spesifikasiProduct',
      align: 'center',
    },
    {
      title: 'Stok',
      dataIndex: 'stockProduct',
      key: 'stockProduct',
      align: 'center',
      render: (stockProduct: number) => {
        return <span>{globalHelpers.currencyFormatter(stockProduct)}</span>;
      },
    },
    {
      title: 'Unit',
      dataIndex: 'unitProduct',
      key: 'unitProduct',
      align: 'center',
    },
    {
      title: 'Berat Barang',
      dataIndex: 'beratproduct',
      key: 'beratproduct',
      align: 'center',
      render: (beratproduct: number) => {
        return <span>{globalHelpers.currencyFormatter(beratproduct)}</span>;
      },
    },
    {
      title: 'Satuan',
      dataIndex: 'satuanProduct',
      key: 'satuanProduct',
      align: 'center',
    },
    {
      title: 'Jumlah Barang',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      render: (quantity: number) => {
        return <span>{globalHelpers.currencyFormatter(quantity)}</span>;
      },
    },
    {
      title: 'Aksi',
      dataIndex: 'action',
      width: 200,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: OrderRNInterfaces.ProductType) => (
        <Space>
          <ButtonEditGroup onClick={() => handleEdit(record.productId)} />
          <Popconfirm
            title="Apakah Anda yakin ingin menghapus data ini?"
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleDelete(record.productId)} // Fungsi delete
          >
            <Button type="primary" danger icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleDelete = (id: string) => {
    const filterData = dataSourceItems.filter((item) => item.productId != id);
    setDataSourceItems(filterData);
  };

  const handleEdit = (id: string) => {
    const findOne = dataSourceItems.find((items) => items.productId === id);
    formItems.setFieldsValue({
      productId: findOne?.productId,
      kodeBarangProduct: findOne?.kodeBarangProduct,
      namabarangProduct: findOne?.namabarangProduct,
      spesifikasiProduct: findOne?.spesifikasiProduct,
      stockProduct: findOne?.stockProduct,
      kategoriProduct: findOne?.kategoriProduct,
      satuanProduct: findOne?.satuanProduct,
      unitProduct: findOne?.unitProduct,
      nilaiSatuan: findOne?.nilaiSatuan,
      namabarangProductInvoice: findOne?.namabarangProductInvoice,
      quantity: findOne?.quantity,
      priceProduct: findOne?.priceProduct,
    });
    seOpenDrawer(true);
  };

  const handleRowDoubleClick = (record: globalInterfaces.DataTypeCustomer) => {
    form.setFieldsValue({
      customerId: record.id || null,
      customerName: record.name,
    });
    setOpen(false);
  };

  const handleRowDoubleClickHistori = (record: OrderRNInterfacesHistory) => {
    const convertItems = record?.items.map((item) => ({
      ...item,
      beratproduct: item.total,
      nilaiSatuan: item.beratproduct,
    }));
    setDataSourceItems(convertItems as any);
    form.setFieldsValue({
      orderNumber: record.orderNumber,
      customerId: record.customerId,
      customerName: record.customerName,
      date: dayjs(record.date, 'YYYY-MM-DD'),
      description: record.description,
      franco: record.franco,
    });
    setOpenHistori(false);
  };

  return (
    <Card
      title={<TitleCardAdd title="Tambah Pesanan (PRN)" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      extra={
        <HistoryOutlined
          onClick={() => setOpenHistori(true)}
          style={{
            fontSize: 20,
            cursor: 'pointer',
          }}
        />
      }
    >
      <ModalHistoriOrder
        open={openHistori}
        setOpen={setOpenHistori}
        handleRowDoubleClick={handleRowDoubleClickHistori}
      />
      <ModalCustomer open={open} setOpen={setOpen} handleRowDoubleClick={handleRowDoubleClick} />
      <DrawerPajakOrderPra
        openDrawer={openDrawerPajak}
        seOpenDrawer={setOpenDrawerPajak}
        setDataSourcePajak={handleSetDataSourcePajak}
        taxTypeFilter="PPN"
      />
      <DrawerOrderPra
        openDrawer={openDrawer}
        formItems={formItems}
        seOpenDrawer={seOpenDrawer}
        setDataSourceItems={setDataSourceItems}
      />

      <Form
        layout="vertical"
        form={form}
        name="login"
        initialValues={{ remember: true }}
        style={{
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
        onFinish={onFinish}
      >
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Nomor Pesanan"
              name="orderNumber"
              rules={[{ required: true, message: 'Masukan nilai nomor pesanan!' }]}
            >
              <Input
                style={{ width: '100%' }}
                prefix={<TagChevron size={16} />}
                placeholder="Nilai nomor pesanan"
              />
            </Form.Item>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Form.Item
                label="customerId"
                name="customerId"
                style={{ width: '100%', display: 'none' }}
                rules={[{ required: true, message: 'Masukan customerName Id!' }]}
              >
                <Input disabled prefix={<TagChevron size={16} />} placeholder="customerId" />
              </Form.Item>

              <Form.Item
                label="Pelanggan"
                name="customerName"
                style={{ width: '100%' }}
                rules={[{ required: true, message: 'Masukan Nama Pelanggan!' }]}
              >
                <Input disabled prefix={<TagChevron size={16} />} placeholder="Nama Pelanggan" />
              </Form.Item>

              <Tooltip title="search">
                <Button
                  type="primary"
                  onClick={() => setOpen(true)}
                  shape="circle"
                  icon={<SearchOutlined />}
                />
              </Tooltip>
            </div>

            <Form.Item
              label="Tanggal Pesanan"
              name="date"
              rules={[{ required: true, message: 'Masukan Tanggal Order!' }]}
              getValueFromEvent={(date) => {
                // simpan ke form dalam format string tanpa timezone
                return date ? date.format('YYYY-MM-DD') : null;
              }}
              getValueProps={(value) => {
                // ubah dari string ke dayjs agar tampil di DatePicker
                return {
                  value: value ? dayjs(value, 'YYYY-MM-DD') : undefined,
                };
              }}
            >
              <DatePicker
                prefix={<Calendar />}
                style={{ width: '100%' }}
                placeholder="Tanggal Order"
                format={'YYYY-MM-DD'}
              />
            </Form.Item>

            <Flex gap={'large'}>
              <Form.Item
                label="Upload File Pesanan"
                name="file"
                valuePropName="file"
                extra={
                  <span
                    style={{
                      color: 'green',
                    }}
                  >
                    File harus berupa PDF
                  </span>
                }
                getValueFromEvent={(e) => {
                  if (Array.isArray(e)) return e;
                  return e?.fileList?.[0]; // Ambil file pertama saja
                }}
                rules={[{ required: true, message: 'Masukan file!' }]}
              >
                <Upload beforeUpload={() => false} maxCount={1}>
                  <Button icon={<UploadOutlined />}>Pilih File</Button>
                </Upload>
              </Form.Item>

              <Form.Item
                label="Upload File Kontrak"
                name="fileKontrak"
                valuePropName="file"
                extra={
                  <span
                    style={{
                      color: 'green',
                    }}
                  >
                    File harus berupa PDF
                  </span>
                }
                getValueFromEvent={(e) => {
                  if (Array.isArray(e)) return e;
                  return e?.fileList?.[0]; // Ambil file pertama saja
                }}
                rules={[{ required: true, message: 'Masukan file kontrak!' }]}
              >
                <Upload beforeUpload={() => false} maxCount={1}>
                  <Button icon={<UploadOutlined />}>Pilih File</Button>
                </Upload>
              </Form.Item>
            </Flex>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              label="Keterangan"
              name="description"
              rules={[{ required: true, message: 'Masuka Keterangan!' }]}
            >
              <Input
                style={{ width: '100%' }}
                prefix={<Note size={16} />}
                placeholder="Keterangan"
              />
            </Form.Item>

            <Form.Item
              label="Franco"
              name="franco"
              rules={[{ required: true, message: 'Masuka Franco!' }]}
            >
              <Input style={{ width: '100%' }} prefix={<Truck size={16} />} placeholder="Franco" />
            </Form.Item>

            <Form.Item
              label="Harga Total"
              name="subtotalAmount"
              rules={[{ required: true, message: 'Harga total!' }]}
              extra={<TextTerbilang properti="subtotalAmount" form={form} />}
            >
              <InputNumber
                prefix={<span>Rp</span>}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                disabled
                controls={false}
                style={{ width: '100%' }}
                placeholder={'Harga total'}
              />
            </Form.Item>
            <Form.Item label="Total setelah PPN">
              <InputNumber
                value={totalSetelahPajak}
                prefix={<span>Rp</span>}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                disabled
                controls={false}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Card
          title={<TitleCardItems title="Item Pesanan" />}
          style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 10,
            }}
          >
            <Button
              type="primary"
              htmlType="button"
              icon={<Plus />}
              onClick={() => {
                seOpenDrawer(true);
                formItems.resetFields();
              }}
              style={{ width: 150 }}
            >
              Tambah Items
            </Button>
          </div>
          <Table<OrderRNInterfaces.ProductType>
            columns={columns}
            dataSource={dataSourceItems as any}
            scroll={{ x: 'max-content' }}
          />{' '}
        </Card>

        <Card title={<TitleCardItems title="Daftar Pajak" />}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button
              type="primary"
              htmlType="button"
              icon={<Plus />}
              onClick={() =>
                setOpenDrawerPajak((previous) => ({
                  ...previous,
                  open: true,
                  subtotalAmount: Number(form.getFieldValue('subtotalAmount') || 0),
                  totalAmount: totalSetelahPajak,
                }))
              }
            >
              Tambah PPN
            </Button>
          </div>
          <Table
            rowKey={(record: any) => record.taxId || record.id}
            columns={[
              { title: 'Tipe Pajak', dataIndex: 'taxType', key: 'taxType', align: 'center' },
              {
                title: 'Nilai Pajak',
                dataIndex: 'taxValue',
                key: 'taxValue',
                align: 'center',
                render: (value: number) => `${Number(value || 0) * 100}%`,
              },
              {
                title: 'Jumlah Pajak',
                dataIndex: 'taxAmount',
                key: 'taxAmount',
                align: 'center',
                render: (value: number) => `Rp${globalHelpers.currencyFormatter(value || 0)}`,
              },
            ]}
            dataSource={dataSourcePajakDisplay}
            pagination={false}
          />
        </Card>
        <Flex gap="small">
          <Buttonback loading={loading} />
          <ButtonAdd loading={loading} />
        </Flex>
      </Form>
    </Card>
  );
}

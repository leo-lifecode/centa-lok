import { Calendar, FilePdf, Note, Plus, TagChevron, Truck, User } from '@phosphor-icons/react';
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Flex,
  Select,
  DatePicker,
  Input,
  Table,
  Tooltip,
  InputNumber,
  message,
  Popconfirm,
} from 'antd';
import { useEffect, useState } from 'react';
import * as SpbsAxios from '@pages/akuntansi/spbs/service/SpbsAxios';
import * as DeliveryOrderPraAxios from '@pages/marketing/delivery-order-pra/service/DeliveryOrderPraAxios';
import { useNavigate } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import * as SpbsInterfaces from '@pages/akuntansi/spbs/interface/SpbsInterfaces';
import type { TableColumnsType } from 'antd';
import { DollarCircleOutlined, SearchOutlined } from '@ant-design/icons';
import ModalSpbsPo from './ModalSbsPo/ModalSbsPo';
import dayjs from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import TitleCardItemsList from '@/components/atoms/Cards/Items/titleCardItemsList';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import DrawerSpb from './DrawerSpb/DrawerSpb';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import { showNotification } from '@/contexts/services/notificationService';
import { handleDate } from '@/utils/func/func';

export default function SpbsAdd() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
  });

  const [customer, setCustomer] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    name: '',
  });

  const [dataSourceItems, setDataSourceItems] = useState<SpbsInterfaces.ItemsSPBType[]>([]);
  const [dataSourceItemsSpb, setDataSourceItemsSpb] = useState<SpbsInterfaces.ItemsSPBType[]>([]);

  const [open, setOpen] = useState(false);
  const [openDrawer, setOpenDrawer] = useState({
    open: false,
  });
  const [dataLog, setDataLogs] = useState([]);

  const [typeSalesSPb, setTypeSalesSPb] = useState<string>('');

  // Fungsi untuk mengelompokkan data berdasarkan orderNumber dan noSpb TABEL
  const groupedDataLog = [...dataLog].sort((a: any, b: any) => {
    const orderCompare = String(a.orderNumber ?? '').localeCompare(String(b.orderNumber ?? ''));
    if (orderCompare !== 0) return orderCompare;
    return String(a.spb?.noSpb ?? '').localeCompare(String(b.spb?.noSpb ?? ''));
  });
  const getSpbGroupKey = (record: any) => `${record.orderNumber}-${record.spb?.id}`;

  const getSpbRowSpan = (record: any, index: number | undefined) => {
    if (index === undefined) return 1;
    const key = getSpbGroupKey(record);
    const firstIndex = groupedDataLog.findIndex((item: any) => getSpbGroupKey(item) === key);
    if (index !== firstIndex) return 0;
    return groupedDataLog.filter((item: any) => getSpbGroupKey(item) === key).length;
  };

  const onFinish = async (values: SpbsInterfaces.PayloadSpbPosType) => {
    try {
      const valueSend = {
        purchaseOrderId: values.purchaseOrderId,
        orderNumber: values.orderNumber,
        date: values.date,
        description: values.description,
        franco: values.franco,
        namaAtasan: values.namaAtasan,
        jabatanAtasan: values.jabatanAtasan,
        dikirimDengan: values.dikirimDengan,
        customerName: values.customerName,
        subtotalAmount: values.totalAmount,
        deliveryOrderId: values.deliveryOrderId,
        noSpb: values.noSpb,
        typeSalesSPb: values.typeSalesSPb,
        tanggalPengiriman: handleDate(values.tanggalPengiriman as any),
        stockLogs: dataSourceItemsSpb.map((items: any) => ({
          productId: items.productId,

          ...(values.typeSalesSPb === 'RA'
            ? {
                deliveryOrderDetailId: items.id,
              }
            : {}),

          quantity: items.quantity,
          qtyKirim:
            values.typeSalesSPb === 'RA'
              ? Number(String(items.qtyKirim ?? 0).replace(',', '.'))
              : items.qtyKirim,
          stockProduct:
            values.typeSalesSPb === 'RA'
              ? items.stockProduct - items.qtyKirim
              : items.stockProduct - items.quantity,
          priceProduct: items.priceProduct,
          kodeBarangProduct: items.kodeBarangProduct,
          namabarangProduct: items.namabarangProduct,
          spesifikasiProduct: items.spesifikasiProduct,
          beratproduct: items.beratproduct,
          total: items.total,
          kategoriProduct: items.kategoriProduct,
          satuanProduct: items.satuanProduct,
          unitProduct: items.unitProduct,
          nilaiSatuan: items?.product?.nilaiSatuan,
          namabarangProductInvoice: items?.namabarangProductInvoice,
          typeSalesSPb: values.typeSalesSPb,
          type: 'OUT',
        })),
      };
      setLoading(true);

      if (values?.typeSalesSPb === 'RA') {
        await SpbsAxios.posSpbs(valueSend);
      } else if (values?.typeSalesSPb === 'RN_EKSPOR') {
        await SpbsAxios.posSpbsRNEkspor(valueSend);
      } else {
        await SpbsAxios.posSpbsRN(valueSend);
      }
      showNotification('success', 'Berhasil', 'Berhasil Menambahkan Dat');
      setTimeout(() => {
        navigate('/spbs');
      }, 2000);
      setLoading(false);
      form.resetFields();
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Menambahkan Data');
    }
  };

  globalHooks.useFetchOptions(unit, setUnit, SpbsAxios.fetchDataUnit, [unit.nama]);

  globalHooks.useFetchOptions(customer, setCustomer, SpbsAxios.fetchDataCustomer, [customer.name]);

  useEffect(() => {
    const totalAmount = dataSourceItemsSpb.reduce((acc: any, item: any) => {
      const result =
        typeSalesSPb === 'RA'
          ? item.priceProduct * item.qtyKirim
          : item.priceProduct * item.quantity;
      return acc + result;
    }, 0);
    form.setFieldValue('totalAmount', totalAmount);
  }, [dataSourceItemsSpb, typeSalesSPb]);

  const onSearcCustomer = globalHooks.useDebounce((searchText: string) => {
    setCustomer((prev) => ({ ...prev, name: searchText }));
  }, 1000);

  const columns: TableColumnsType<SpbsInterfaces.ItemsSPBType> = [
    {
      title: 'Kode Barang',
      dataIndex: 'kodeBarangProduct',
      key: 'kodeBarangProduct',
      align: 'center',
    },
    {
      title: 'Nama Barang',
      dataIndex: 'namabarangProductInvoice',
      key: 'namabarangProductInvoice',
      align: 'center',
    },
    {
      title: 'Satuan',
      dataIndex: 'satuanProduct',
      key: 'satuanProduct',
      align: 'center',
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
    },
    {
      title: 'Unit',
      dataIndex: 'unitProduct',
      key: 'unitProduct',
      align: 'center',
    },
    {
      title: 'Jumlah Barang',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
    },
    ...(typeSalesSPb === 'RA'
      ? [
          {
            title: 'Qty Kirim',
            dataIndex: 'qtyKirim',
            key: 'qtyKirim',
            align: 'center' as const,
          },
        ]
      : []),
  ];

  const handleRowDoubleClick = async (record: SpbsInterfaces.DeliverySpbType) => {
    try {
      console.log('DATA RECORD SPB:', record);
      const data = await SpbsAxios.fetchDataStokLogByOrderNumber(record.purchaseOrder.orderNumber);

      setDataLogs(data);

      const deliveryType = record.typeSalesDelivery;

      const deliveryOrder = await DeliveryOrderPraAxios.fetchDataDeliveryOrderPraById(record.id);

      const deliveryAu58Number = deliveryOrder?.au58?.documentNumber;
      const deliveryAu58Date = deliveryOrder?.au58?.au58Date;

      setTypeSalesSPb(deliveryType || '');

      form.setFieldsValue({
        orderNumber: record.purchaseOrder.orderNumber,
        customerId: record.purchaseOrder.customerId,
        date: dayjs(record.purchaseOrder.date),
        description: record.purchaseOrder.description,
        franco: record.purchaseOrder.franco,
        status: record.purchaseOrder.status,
        // totalAmount: record.purchaseOrder.subtotalAmount,
        typeSalesSPb: record.typeSalesDelivery,
        purchaseOrderId: record.purchaseOrderId,
        customerName: record.purchaseOrder.customerName,
        deliveryOrderId: record.id,

        au58Id: deliveryAu58Number || '',
        au58Date: deliveryAu58Date ? dayjs(deliveryAu58Date) : null,
      });

      if (deliveryType === 'RA') {
        const deliveryOrderItems = Array.isArray(deliveryOrder?.DeliveryOrderDetail)
          ? deliveryOrder.DeliveryOrderDetail.map((item: any) => ({
              ...item,
              quantity: Number(item.qtyKirim ?? 0),
              qtyKirim: 0,
              product: item.MasterBarangJadi ?? item.product,
            }))
          : [];

        setDataSourceItems(deliveryOrderItems as any);
      } else {
        setDataSourceItems(record.purchaseOrder.items as any);
      }
      setOpen((open) => !open);
    } catch (e) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
    }
  };

  useEffect(() => {
    getGenerateCodeSpb();
  }, []);

  const getGenerateCodeSpb = async () => {
    const data = await SpbsAxios.fetchGenCodeSpbs();
    form.setFieldValue('noSpb', data.code);
  };
  return (
    <Card
      title={<TitleCardAdd title="Edit SPBS" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
    >
      <DrawerSpb
        dataSourceItems={dataSourceItems}
        openDrawer={openDrawer}
        seOpenDrawer={setOpenDrawer}
        dataLogs={dataLog}
        setDataSourceItemsSpb={setDataSourceItemsSpb}
        form={form}
        typeSalesSPb={typeSalesSPb}
      />
      <ModalSpbsPo open={open} setOpen={setOpen} handleRowDoubleClick={handleRowDoubleClick} />

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
            {/* hide */}
            <Form.Item
              label="purchaseOrderId"
              style={{ flex: 1, width: '100%', display: 'none' }}
              name="purchaseOrderId"
              rules={[{ required: true, message: 'Masukan nilai purchaseOrderId!' }]}
            >
              <Input
                disabled
                style={{ width: '100%' }}
                prefix={<FilePdf size={16} />}
                placeholder="Nilai purchaseOrderId"
              />
            </Form.Item>

            <Form.Item
              label="typeSalesSPb"
              style={{ flex: 1, width: '100%', display: 'none' }}
              name="typeSalesSPb"
              rules={[{ required: true, message: 'Masukan nilai typeSalesSPb!' }]}
            >
              <Input
                disabled
                style={{ width: '100%' }}
                prefix={<FilePdf size={16} />}
                placeholder="Nilai typeSalesSPb"
              />
            </Form.Item>

            <Form.Item
              label="deliveryOrderId"
              style={{ flex: 1, width: '100%', display: 'none' }}
              name="deliveryOrderId"
              rules={[{ required: true, message: 'Masukan nilai deliveryOrderId!' }]}
            >
              <Input
                disabled
                style={{ width: '100%' }}
                prefix={<FilePdf size={16} />}
                placeholder="Nilai deliveryOrderId"
              />
            </Form.Item>
            {/* hide */}

            <Form.Item
              label="Nomor SPB"
              style={{ flex: 1, width: '100%' }}
              name="noSpb"
              rules={[{ required: true, message: 'Masukan nilai nomor SPB!' }]}
            >
              <Input
                style={{ width: '100%' }}
                prefix={<TagChevron size={16} />}
                placeholder="Nomor SSPB"
              />
            </Form.Item>
            {/* hide form */}
            <Form.Item style={{ flex: 1, width: '100%', display: 'none' }} name="customerId">
              <Input />
            </Form.Item>
            {/* end hide form */}
            <Form.Item
              label="Pelanggan"
              name="customerName"
              rules={[{ required: true, message: 'Masukan nama customer!' }]}
            >
              <Select
                prefix={<User />}
                showSearch
                disabled
                loading={unit.loading}
                placeholder="Pilih customer"
                optionFilterProp="label"
                onChange={() => setCustomer((prev) => ({ ...prev, name: '' }))}
                onSearch={onSearcCustomer}
                options={globalHelpers.toAntdOptions(customer.data || [], 'id', 'name')}
              />
            </Form.Item>

            {typeSalesSPb === 'RA' && (
              <>
                <Form.Item
                  label="AU58 ID"
                  name="au58Id"
                  getValueProps={(value) => ({
                    value: value || '-',
                  })}
                >
                  <Input disabled />
                </Form.Item>
              </>
            )}
            <Form.Item
              label="Tanggal Pesanan"
              name="date"
              rules={[{ required: true, message: 'Masukan Tanggal Pesanan!' }]}
              getValueFromEvent={(date) => {
                // pastikan disimpan dalam format YYYY-MM-DD (string)
                return date ? date.format('YYYY-MM-DD') : null;
              }}
              getValueProps={(value) => {
                // saat form memuat ulang data, ubah string ke dayjs
                return {
                  value: value ? dayjs(value, 'YYYY-MM-DD') : undefined,
                };
              }}
            >
              <DatePicker
                prefix={<Calendar />}
                disabled
                style={{ width: '100%' }}
                placeholder="Tanggal Pesanan"
              />
            </Form.Item>

            <Form.Item
              label="Tanggal Pengiriman"
              name="tanggalPengiriman"
              rules={[{ required: true, message: 'Masukan Tanggal Pengiriman!' }]}
              getValueFromEvent={(date) => {
                // pastikan disimpan dalam format YYYY-MM-DD (string)
                return date ? date.format('YYYY-MM-DD') : null;
              }}
              getValueProps={(value) => {
                // saat form memuat ulang data, ubah string ke dayjs
                return {
                  value: value ? dayjs(value, 'YYYY-MM-DD') : undefined,
                };
              }}
            >
              <DatePicker
                prefix={<Calendar />}
                style={{ width: '100%' }}
                placeholder="Tanggal Pengiriman"
              />
            </Form.Item>

            <Form.Item label="Nama Atasan" name="namaAtasan" style={{ width: '100%' }}>
              <Input placeholder="Nama Atasan" />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Form.Item
                label="Nomor Pesanan"
                style={{ flex: 1, width: '100%' }}
                name="orderNumber"
                rules={[{ required: true, message: 'Masukan nilai nomor pesanan!' }]}
              >
                <Input
                  disabled
                  style={{ width: '100%' }}
                  prefix={<TagChevron size={16} />}
                  placeholder="Nomor Pesanan"
                />
              </Form.Item>
              <Tooltip title="search">
                <Button
                  type="primary"
                  onClick={() => {
                    setOpen(true);
                    setDataSourceItemsSpb([]);
                  }}
                  shape="circle"
                  icon={<SearchOutlined />}
                />
              </Tooltip>
            </div>

            <Form.Item
              label="Keterangan"
              name="description"
              rules={[{ required: true, message: 'Masuka Keterangan!' }]}
            >
              <Input
                disabled
                style={{ width: '100%' }}
                prefix={<Note size={16} />}
                placeholder="Keterangan"
              />
            </Form.Item>

            {typeSalesSPb === 'RA' && (
              <>
                <Form.Item
                  label="AU58 Date"
                  name="au58Date"
                  getValueProps={(value) => ({
                    value: value ? dayjs(value).format('DD/MM/YYYY') : '-',
                  })}
                >
                  <Input disabled />
                </Form.Item>
              </>
            )}

            <Form.Item
              label="Franco"
              name="franco"
              rules={[{ required: true, message: 'Masuka Franco!' }]}
            >
              <Input
                disabled
                style={{ width: '100%' }}
                prefix={<Truck size={16} />}
                placeholder="Franco"
              />
            </Form.Item>

            <Form.Item
              label="Harga"
              name="totalAmount"
              style={{ display: 'none' }}
              rules={[{ required: true, message: 'Masuka Total Amount!' }]}
              extra={<TextTerbilang properti="totalAmount" form={form} />}
            >
              <InputNumber
                prefix={<DollarCircleOutlined />}
                disabled
                controls={false}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                style={{ width: '100%' }}
                placeholder="Total Amount"
              />
            </Form.Item>

            <Form.Item label="Dikirim Dengan" name="dikirimDengan" style={{ width: '100%' }}>
              <Input placeholder="Dikirim Dengan" />
            </Form.Item>

            <Form.Item label="Jabatan Atasan" name="jabatanAtasan" style={{ width: '100%' }}>
              <Input placeholder="Jabatan Atasan" />
            </Form.Item>
          </Col>
        </Row>
        <Card
          title={<TitleCardItems title="Pesanan Item" />}
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
              onClick={() =>
                setOpenDrawer((prev) => ({
                  ...prev,
                  open: true,
                }))
              }
              style={{ width: 150 }}
            >
              Pilih Barang
            </Button>
          </div>
          <Table<SpbsInterfaces.ItemsSPBType>
            columns={columns}
            dataSource={dataSourceItemsSpb}
            scroll={{ x: 'max-content' }}
          />{' '}
        </Card>

        {typeSalesSPb === 'RA' && (
          <Card
            title={<TitleCardItemsList title="History Pesanan" />}
            style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
          >
            <Table
              bordered
              tableLayout="fixed"
              rowKey={(record: any) => record.id}
              dataSource={groupedDataLog}
              pagination={false}
              scroll={{ x: 880 }}
              columns={[
                {
                  title: 'Nomor Pesanan',
                  dataIndex: 'orderNumber',
                  key: 'orderNumber',
                  width: 220,
                  onCell: (record: any, index?: number) => ({
                    rowSpan: getSpbRowSpan(record, index),
                  }),
                },
                {
                  title: 'Nama Barang',
                  dataIndex: 'namabarangProductInvoice',
                  key: 'namabarangProductInvoice',
                  width: 250,
                },
                {
                  title: 'Qty Kirim',
                  dataIndex: 'qtyKirim',
                  key: 'qtyKirim',
                  width: 120,
                  align: 'center' as const,
                },
                {
                  title: 'Nomor SPB',
                  dataIndex: ['spb', 'noSpb'],
                  key: 'noSpb',
                  width: 190,
                  onCell: (record: any, index?: number) => ({
                    rowSpan: getSpbRowSpan(record, index ?? 0),
                  }),
                },
                {
                  title: 'Aksi',
                  key: 'aksi',
                  width: 110,
                  align: 'center' as const,
                  onCell: (record: any, index?: number) => ({
                    rowSpan: getSpbRowSpan(record, index ?? 0),
                  }),
                  render: (_: any, record: any) => {
                    if (!record.spb?.id) return '-';

                    return (
                      <Popconfirm
                        title="Hapus SPB?"
                        description="Data SPB dan transaksi inventory terkait akan dihapus."
                        okText="Ya, Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true }}
                        onConfirm={async () => {
                          try {
                            await SpbsAxios.delSpbs(record.spb.id);
                            message.success('SPB berhasil dihapus');

                            const data = await SpbsAxios.fetchDataStokLogByOrderNumber(
                              record.orderNumber
                            );

                            setDataLogs(data);
                          } catch {
                            message.error('Gagal menghapus SPB');
                          }
                        }}
                      >
                        <Button type="link" danger>
                          Hapus
                        </Button>
                      </Popconfirm>
                    );
                  },
                },
              ]}
            />
          </Card>
        )}

        <Flex gap="small">
          <Buttonback loading={loading} />
          <ButtonAdd loading={loading} />
        </Flex>
      </Form>
    </Card>
  );
}

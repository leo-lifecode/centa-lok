import {
  Calendar,
  CheckCircle,
  FilePdf,
  Note,
  Plus,
  TagChevron,
  Truck,
  User,
} from '@phosphor-icons/react';
import { Form, Row, Col, Flex, Popconfirm } from 'antd';
import * as CrossChekPajakAxios from '@/pages/keuangan/cross-chek-pajak/service/CrossChekPajakAxios';
import { useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import type { TableColumnsType } from 'antd';
import DrawerOrderPra from './DrawerCrossChekPajak/DrawerCrossChekPajak';
import dayjs from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import TitleCardItemsList from '@/components/atoms/Cards/Items/titleCardItemsList';
import { masterColors } from '@/utils/matser-color';
import * as OrderRNAxios from '@pages/marketing-rn/order-rn/service/OrderRNAxios';
import { showNotification } from '@/contexts/services/notificationService';
import { handleMessageError } from '@/utils/func/func';
import { useAppNavigate } from '@/hooks/React/useAppNavigate';
import { useState } from '@/hooks/React/useState';
import { useEffect } from '@/hooks/React/useEffect';
import { Button, Card, DatePicker, Input, InputNumber, Select, Table } from '@/components/ui';
import { DeleteOutlined } from '@ant-design/icons';

interface DataType {
  key: string;
  name: string;
  age: number;
  address: string;
  kodeBarangProduct: string;
  namabarangProduct: string;
  priceProduct: number;
  satuanProduct: string;
  spesifikasiProduct: string;
  stockProduct: number;
  unitProduct: string;
}

export default function CrossChekPajakRNUpdate() {
  const navigate = useAppNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [openDrawer, seOpenDrawer] = useState<{
    open: boolean;
    totalAmount: number;
  }>({
    open: false,
    totalAmount: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
  });

  const [dataSourceItems, setDataSourceItems] = useState<any>([]);
  const [dataSourcePajak, setDataSourcePajak] = useState<any>([]);

  const onFinish = async (values: any) => {
    try {
      const dataSourcePajakNew = dataSourcePajak.map((item: any) => ({
        taxAmount: item.taxAmount,
        taxId: item.taxId,
        taxType: item.taxType,
        taxValue: item.taxValue,
        purchaseOrderId: values.purchaseOrderId,
      }));

      const payload = {
        totalAmounTax: values.totalAmounTax,
        totalAmount: values.totalAmount,
        purchaseOrderId: values.purchaseOrderId,
        orderNumber: values.orderNumber,
        taxes: dataSourcePajakNew,
        item: dataSourceItems.map((item: any) => ({ productId: item.productId })),
      };

      setLoading(true);
      await CrossChekPajakAxios.updateCrossChekPajakRN(payload);
      showNotification('success', 'Berhasil', 'Berhasil Menambahkan Data');
      setTimeout(() => {
        navigate('/cross-chek-pajak');
      }, 2000);
      setLoading(false);
      form.resetFields();
    } catch (e) {
      setLoading(false);
      const message = handleMessageError(e);
      showNotification('error', 'Gagal', message);
    }
  };

  globalHooks.useFetchOptions(unit, setUnit, CrossChekPajakAxios.fetchDataUnit, [unit.nama]);

  const columnsPajak: TableColumnsType<DataType> = [
    {
      title: 'Tipe Pajak',
      dataIndex: 'taxType',
      key: 'taxType',
      align: 'center',
    },
    {
      title: 'Nilai Pajak',
      dataIndex: 'taxValue',
      key: 'taxValue',
      align: 'center',
    },
    {
      title: 'Jumlah Pajak',
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      align: 'center',
      render: (taxAmount: number) => {
        return <p>{globalHelpers.currencyFormatter(taxAmount || 0)}</p>;
      },
    },

    {
      title: 'Action',
      dataIndex: 'id',
      key: 'id',
      align: 'center',
      render: (_id: string, record: any) => {
        return (
          <Popconfirm
            title="Apakah Anda yakin ingin menghapus data ini?"
            okText="Ya"
            onConfirm={() => handleDeletePajak(record)}
            cancelText="Batal"
          >
            <Button type="primary" danger icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  const columns: TableColumnsType<DataType> = [
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
  ];

  useEffect(() => {
    getDataById();
  }, []);

  const getDataById = async () => {
    try {
      if (id) {
        setLoading(true);
        const data = await OrderRNAxios.fetchDataOrderPraById(id);
        setDataSourceItems(data?.items || []);
        setDataSourcePajak(data?.PurchaseOrderTax || []);

        let totalPPh22 = 0;
        let totalPPh23 = 0;
        data?.PurchaseOrderTax?.forEach((tax: any) => {
          if (tax.taxType === 'PPh 22') {
            totalPPh22 = tax.taxAmount;
          }

          if (tax.taxType === 'PPh 23') {
            totalPPh23 = tax.taxAmount;
          }
        });

        form.setFieldsValue({
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          date: dayjs(data.date),
          description: data.description,
          franco: data.franco,
          status: data.status,
          subtotalAmount: data.subtotalAmount,
          // spbId: data.id,
          purchaseOrderId: data.id,
          totalAmount: Number(data.totalAmount) + totalPPh22 + totalPPh23,
          totalAmounTax: Number(data.totalAmount) + totalPPh22 + totalPPh23,
        });
      }
      setLoading(false);
    } catch (e) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
      setLoading(false);
    }
  };

  const handleDeletePajak = (record: any) => {
    const pajak = dataSourcePajak.find((item: any) => item.taxId === record.taxId);
    let totalAmounTax = 0;
    if (record.taxType.toLowerCase().includes('ppn')) {
      totalAmounTax = Number(form.getFieldValue('totalAmounTax')) - pajak.taxAmount;
    } else {
      totalAmounTax = Number(form.getFieldValue('totalAmounTax')) + pajak.taxAmount;
    }
    form.setFieldsValue({
      totalAmounTax: totalAmounTax,
      totalAmount: totalAmounTax,
    });
    const result = dataSourcePajak.filter((item: any) => item.taxId != record.taxId);
    setDataSourcePajak(result);
  };

  return (
    <Card
      title={<TitleCardAdd title="Cross Chek Pajak (RN)" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
    >
      <DrawerOrderPra
        dataSourcePajak={dataSourcePajak}
        form={form}
        openDrawer={openDrawer}
        seOpenDrawer={seOpenDrawer}
        setDataSourcePajak={setDataSourcePajak}
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

            <Form.Item
              label="Pelanggan"
              name="customerName"
              rules={[{ required: true, message: 'Masukan kustomer!' }]}
            >
              <Select
                prefix={<User />}
                showSearch
                disabled
                loading={unit.loading}
                placeholder="Pilih customer"
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              label="Tanggal Pesanan"
              name="date"
              rules={[{ required: true, message: 'Masukan Tanggal pesanana!' }]}
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
                disabled
                style={{ width: '100%' }}
                placeholder="Tanggal pesanan"
                format={'YYYY-MM-DD'}
              />
            </Form.Item>

            <Form.Item
              label={
                <i
                  style={{
                    color: masterColors.green,
                  }}
                >
                  Harga Dasar (tidak termasuk pajak)
                </i>
              }
              name="subtotalAmount"
              rules={[{ required: true, message: 'Masuka Total Amount!' }]}
            >
              <InputNumber
                prefix={<span>Rp</span>}
                disabled
                controls={false}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                style={{ width: '100%' }}
                placeholder="Total Amount"
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
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
              label="Status"
              name="status"
              rules={[{ required: true, message: 'Masuka Status!' }]}
            >
              <Input
                disabled
                style={{ width: '100%' }}
                prefix={<CheckCircle size={16} />}
                placeholder="status"
              />
            </Form.Item>

            <Form.Item
              label={
                <i
                  style={{
                    color: 'red',
                  }}
                >
                  Total Tagihan
                </i>
              }
              name="totalAmount"
              rules={[{ required: true, message: 'Masuka Total Amount!' }]}
            >
              <InputNumber
                prefix={<span>Rp</span>}
                // disabled
                controls={false}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                style={{ width: '100%' }}
                placeholder="Total Amount"
              />
            </Form.Item>

            <Form.Item
              label={
                <i
                  style={{
                    color: 'red',
                  }}
                >
                  Total Pembayaran oleh Pelanggan
                </i>
              }
              name="totalAmounTax"
              rules={[{ required: true, message: 'Masuka Total Amount!' }]}
            >
              <InputNumber
                prefix={<span>Rp</span>}
                // disabled
                controls={false}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                style={{ width: '100%' }}
                placeholder="Total Amount"
              />
            </Form.Item>
          </Col>
        </Row>

        <Card
          title={<TitleCardItems title="Pesanan Item" />}
          style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
        >
          <Table<DataType>
            columns={columns}
            dataSource={dataSourceItems}
            scroll={{ x: 'max-content' }}
          />{' '}
        </Card>

        <Card
          title={<TitleCardItemsList title="Daftar Pajak" />}
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
                seOpenDrawer((prev) => ({
                  ...prev,
                  open: true,
                  subtotalAmount: form.getFieldValue('subtotalAmount'),
                }))
              }
              style={{ width: 150 }}
            >
              Tambah Pajak
            </Button>
          </div>
          <Table<DataType>
            columns={columnsPajak}
            dataSource={dataSourcePajak}
            scroll={{ x: 'max-content' }}
          />{' '}
        </Card>

        <Flex gap="small">
          <Buttonback loading={loading} />
          <ButtonAdd loading={loading} />
        </Flex>
      </Form>
    </Card>
  );
}

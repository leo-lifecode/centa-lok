import {
  CalendarBlank,
  CheckCircle,
  FilePdf,
  Note,
  TagChevron,
  Truck,
  User,
} from '@phosphor-icons/react';
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
} from 'antd';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as DeliveryOrderRNAxios from '@pages/marketing-rn/delivery-order-rn/service/DeliveryOrderRNAxios';
import { useNavigate } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import * as DeliveryOrderRNInterfaces from '@pages/marketing-rn/delivery-order-rn/interface/DeliveryOrderRNInterfaces';

import type { TableColumnsType } from 'antd';
import DrawerOrderPra from './DrawerDeliveryOrderRN/DrawerDeliveryOrderRN';
import { DollarCircleFilled, SearchOutlined } from '@ant-design/icons';
import ModalDeliveryPoPra from './ModalDeliveryOrderRN/ModalDeliveryPoRN';
import dayjs from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import { showNotification } from '@/contexts/services/notificationService';

export default function DeliveryOrderRNAdd() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [openDrawer, seOpenDrawer] = useState<boolean>(false);
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

  const [dataSourceItems, setDataSourceItems] = useState<any>([]);
  const [open, setOpen] = useState(false);

  const onFinish = async (values: DeliveryOrderRNInterfaces.PayloadDORN) => {
    try {
      setLoading(true);
      await DeliveryOrderRNAxios.posDeliveryOrderRN({
        purchaseOrderId: values.purchaseOrderId,
        typeSalesDelivery: 'RN',
      });
      await queryClient.invalidateQueries({ queryKey: ['delivery-order-rn'] });
      showNotification('success', 'Berhasil', 'Berhasil Menambahkan Data');
      setTimeout(() => {
        navigate('/delivery-order-prn');
      }, 2000);
      setLoading(false);
      form.resetFields();
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Menambahkan Data');
    }
  };

  globalHooks.useFetchOptions(unit, setUnit, DeliveryOrderRNAxios.fetchDataUnit, [unit.nama]);

  globalHooks.useFetchOptions(customer, setCustomer, DeliveryOrderRNAxios.fetchDataCustomer, [
    customer.name,
  ]);

  const onSearcCustomer = globalHooks.useDebounce((searchText: string) => {
    setCustomer((prev) => ({ ...prev, name: searchText }));
  }, 1000);

  const columns: TableColumnsType<DeliveryOrderRNInterfaces.DatumType> = [
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
        return <span>Rp{globalHelpers.currencyFormatter(priceProduct || 0)}</span>;
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

  const handleRowDoubleClick = (record: DeliveryOrderRNInterfaces.DatumType) => {
    console.log(record);
    form.setFieldsValue({
      orderNumber: record.orderNumber,
      customerId: record.customerId,
      date: dayjs(record.date),
      description: record.description,
      franco: record.franco,
      customerName: record.customerName,
      status: record.status,
      totalAmount: record.subtotalAmount,
      purchaseOrderId: record.id,
    });
    setDataSourceItems(record.items);
    setOpen((open) => !open);
  };
  return (
    <Card
      title={<TitleCardAdd title="Tambah Pengiriman Pesanan (PRN)" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
    >
      <DrawerOrderPra
        openDrawer={openDrawer}
        seOpenDrawer={seOpenDrawer}
        setDataSourceItems={setDataSourceItems}
      />

      <ModalDeliveryPoPra
        open={open}
        setOpen={setOpen}
        handleRowDoubleClick={handleRowDoubleClick}
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                  placeholder="Nomor pesanan"
                />
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
              label="Pelanggan"
              name="customerName"
              rules={[{ required: true, message: 'Masukan nama cutsomer!' }]}
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

            <Form.Item
              label="Tanggal Order"
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
                prefix={<CalendarBlank />}
                disabled
                style={{ width: '100%' }}
                placeholder="Tanggal Order"
                format={'YYYY-MM-DD'}
              />
            </Form.Item>

            <Form.Item
              label="Harga"
              name="totalAmount"
              rules={[{ required: true, message: 'Masuka Total Amount!' }]}
              extra={<TextTerbilang properti="totalAmount" form={form} />}
            >
              <InputNumber
                prefix={<DollarCircleFilled />}
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
          </Col>
        </Row>
        <Card
          title={<TitleCardItems title="Pesanan Item" />}
          style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
        >
          <Table<DeliveryOrderRNInterfaces.DatumType>
            columns={columns}
            dataSource={dataSourceItems}
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

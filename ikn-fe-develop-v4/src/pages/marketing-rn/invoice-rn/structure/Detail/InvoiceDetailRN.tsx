import { Calendar, TagChevron } from '@phosphor-icons/react';
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Flex,
  Input,
  Table,
  Tooltip,
  Divider,
  Descriptions,
  DatePicker,
} from 'antd';
import { useEffect, useState } from 'react';
import * as InvoiceAxios from '@pages/marketing/invoice/service/InvoiceAxios';
import { useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import type { TableColumnsType } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { generateInvoicePDF } from '@/utils/generatePdf/generateInvoicePDF';
import TitleCardDetail from '@/components/atoms/Cards/titleCardDetail';
import { ButtonFile } from '@/components/atoms/button/buttonCardGroups';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import TitleCardItemsList from '@/components/atoms/Cards/Items/titleCardItemsList';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import ModalNumberAccount from './ModalNumberAccount/ModalNumberAccount';
import * as MasterAkunBankInterfaces from '@pages/master/master-akun-bank/interface/MasterAkunBankInterfaces';
import * as InvoiceInterfaces from '@pages/marketing-rn/invoice-rn/interface/InvoiceInterfaces';
import * as InvoiceDetailInterfaces from '@pages/marketing-rn/invoice-rn/interface/InvoiceDetailInterfaces';

import * as OrderPraAxios from '@pages/marketing/order-pra/service/OrderPraAxios';
import { showNotification } from '@/contexts/services/notificationService';
import { handleMessageError } from '@/utils/func/func';

export default function InvoiceDetailRN() {
  const { id } = useParams();
  const [form] = Form.useForm();
  const [formInv] = Form.useForm();
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [dataInvoice, setDataInvoice] = useState({});
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

  const [dataSourceItems, setDataSourceItems] = useState<InvoiceDetailInterfaces.Item[]>([]);
  const [dataSourcePajak, setDataSourcePajak] = useState<InvoiceDetailInterfaces.InvoiceTax[]>([]);
  globalHooks.useFetchOptions(unit, setUnit, InvoiceAxios.fetchDataUnit, [unit.nama]);
  globalHooks.useFetchOptions(customer, setCustomer, InvoiceAxios.fetchDataCustomer, [
    customer.name,
  ]);

  useEffect(() => {
    fetchDataInvoiceById();
  }, []);

  const fetchDataInvoiceById = async () => {
    try {
      setLoading(true);
      if (id) {
        const data = await InvoiceAxios.fetchDataInvoiceById(id);
        setDataInvoice(data || []);
        form.setFieldsValue({
          orderNumber: data?.spb?.purchaseOrder?.orderNumber,
          customerName: data?.spb.purchaseOrder.customerName,
          date: dayjs(data?.spb?.purchaseOrder?.date),
          description: data?.spb?.purchaseOrder?.description,
          franco: data?.spb?.purchaseOrder?.franco,
          status: data?.spb?.purchaseOrder?.status,
          totalAmount: data?.totalAmount,
          purchaseOrderId: data?.spb?.purchaseOrder?.id,
          invoiceNumber: data?.invoiceNumber,
          invoiceDate: dayjs(data?.spb.purchaseOrder.date),
          subtotalAmount: data?.spb?.purchaseOrder?.subtotalAmount,
          address: data?.spb.purchaseOrder.customer.address,
        });
        setDataSourceItems(data?.spb?.purchaseOrder.items || []);
        setDataSourcePajak(data?.invoiceTaxes || []);
      }
      setLoading(false);
    } catch (e) {
      setLoading(false);
      const message = handleMessageError(e);
      showNotification('error', 'Gagal', message);
    }
  };

  const columnsPajak: TableColumnsType<InvoiceDetailInterfaces.InvoiceTax> = [
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
        return <span>{globalHelpers.currencyFormatter(taxAmount)}</span>;
      },
    },
  ];

  const columns: TableColumnsType<InvoiceInterfaces.Item> = [
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
      render: (quantity: number) => {
        return <span>{globalHelpers.currencyFormatter(quantity)}</span>;
      },
    },
  ];
  const onDownloadInvoice = () => {
    if (dataInvoice) {
      const dataTTD: InvoiceInterfaces.DataTTDType = formInv.getFieldsValue();
      generateInvoicePDF({
        ...dataInvoice,
        dataTTD,
        invoiceDate: form.getFieldValue('invoiceDate'),
      } as any);
    }
  };

  const handleRowDoubleClick = (record: MasterAkunBankInterfaces.DataBankAccountType) => {
    formInv.setFieldsValue({
      bankAccountNumber: record.bankAccountNumber,
      bankName: record.bankName,
    });
    setOpen(false);
  };

  const handleOpenFile = async () => {
    try {
      const dataInvoiceTmp: any = dataInvoice;
      const data = await OrderPraAxios.getFileOrderPra(dataInvoiceTmp?.spb?.purchaseOrder.fileUrl);
      if (data) {
        const link = document.createElement('a');
        link.href = data;
        link.target = '_blank';
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
    }
  };
  const handleOpenFileKontrak = async () => {
    try {
      const dataInvoiceTmp: any = dataInvoice;
      const data = await OrderPraAxios.getFileOrderPra(
        dataInvoiceTmp?.spb?.purchaseOrder?.fileUrlKontrak
      );
      if (data) {
        const link = document.createElement('a');
        link.href = data;
        link.target = '_blank';
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
    }
  };
  const hargaTotal = Number((dataInvoice as any)?.totalAmount || 0);
  const hargaTotalSetelahPajak = Number((dataInvoice as any)?.amountWithTax || 0);

  const watchInvoiceDateManual = Form.useWatch('invoiceDateManual', formInv);

  return (
    <Card
      title={<TitleCardDetail title="Detail Invoice" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      extra={
        <div
          style={{
            display: 'flex',
            gap: 5,
          }}
        >
          <ButtonFile color="danger" text="Cetak Bukti Pesanan" onClick={handleOpenFile} />
          <ButtonFile color="gold" text="Cetak Kontrak" onClick={handleOpenFileKontrak} />
          <ButtonFile text="Cetak Invoice" onClick={onDownloadInvoice} />
        </div>
      }
    >
      <ModalNumberAccount
        open={open}
        setOpen={setOpen}
        handleRowDoubleClick={handleRowDoubleClick}
      />
      <Card
        title={<TitleCardItems title="Detail Invoice" />}
        style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      >
        <Form
          layout="vertical"
          form={formInv}
          name="login"
          initialValues={{ remember: true }}
          style={{
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Form.Item
                  label="Pilih Bank"
                  style={{ flex: 1, width: '100%' }}
                  name="bankName"
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
                    shape="circle"
                    type="primary"
                    onClick={() => setOpen(true)}
                    icon={<SearchOutlined />}
                  />
                </Tooltip>
              </div>

              <Form.Item
                label="No. Rekening"
                style={{ flex: 1, width: '100%' }}
                name="bankAccountNumber"
                rules={[{ required: true, message: 'Masukan Rekening!' }]}
              >
                <Input
                  disabled
                  style={{ width: '100%' }}
                  prefix={<TagChevron size={16} />}
                  placeholder="Nomor Rekening"
                />
              </Form.Item>

              <Form.Item
                label="Tanggal Invoice"
                style={{ flex: 1, width: '100%' }}
                name="invoiceDateManual"
                rules={[{ required: true, message: 'Masukan Tanggal Invoice!' }]}
              >
                <DatePicker
                  prefix={<Calendar />}
                  style={{ width: '100%' }}
                  placeholder="Tanggal Invoice"
                  format={'YYYY-MM-DD'}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label="Nama TTD"
                style={{ flex: 1, width: '100%' }}
                name="ttdName"
                rules={[{ required: true, message: 'Masukan Nama TTD!' }]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<TagChevron size={16} />}
                  placeholder="Nama TTD"
                />
              </Form.Item>

              <Form.Item
                label="Jabatan"
                style={{ flex: 1, width: '100%' }}
                name="jabatan"
                rules={[{ required: true, message: 'Masukan Jabatan!' }]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<TagChevron size={16} />}
                  placeholder="Jabatan"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Divider />
      <Card
        title={<TitleCardItems title="Detail Invoice" />}
        style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      >
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Nomor Pesanan">
            {form.getFieldValue('orderNumber')}
          </Descriptions.Item>
          <Descriptions.Item label="Keterangan">
            {form.getFieldValue('description')}
          </Descriptions.Item>
          <Descriptions.Item label="Customer">
            {form.getFieldValue('customerName')}
          </Descriptions.Item>
          <Descriptions.Item label="Franco">{form.getFieldValue('franco')}</Descriptions.Item>
          <Descriptions.Item label="Alamat Customer" style={{ maxWidth: 200 }}>
            {form.getFieldValue('address')}
          </Descriptions.Item>
          <Descriptions.Item label="Harga Total">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              <p>Rp. {globalHelpers.currencyFormatter(hargaTotal)}</p>
              <p
                style={{
                  color: 'green',
                }}
              >
                {globalHelpers.terbilangRupiah(hargaTotal)}
              </p>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="Harga Total Setelah Pajak">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              <p>Rp. {globalHelpers.currencyFormatter(hargaTotalSetelahPajak)}</p>
              <p
                style={{
                  color: 'green',
                }}
              >
                {globalHelpers.terbilangRupiah(hargaTotalSetelahPajak)}
              </p>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="Tanggal Invoice">
            {dayjs(watchInvoiceDateManual).format('DD/MMMM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Tanggal Pesanan">
            {dayjs(form.getFieldValue('date')).format('DD/MMMM/YYYY')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />
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
      >
        <Card
          title={<TitleCardItems title="Pesanan Item" />}
          style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
        >
          <Table<InvoiceInterfaces.Item>
            columns={columns}
            dataSource={dataSourceItems}
            scroll={{ x: 'max-content' }}
          />{' '}
        </Card>

        <Card
          title={<TitleCardItemsList title="Daftar Pajak" />}
          style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
        >
          <Table<InvoiceDetailInterfaces.InvoiceTax>
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

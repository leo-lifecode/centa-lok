import { FilePdf } from '@phosphor-icons/react';
import { Card, Button, Form, Flex, Table, Descriptions } from 'antd';
import { useEffect, useState } from 'react';
import * as OrderPraAxios from '@pages/marketing/order-pra/service/OrderPraAxios';
import { useNavigate, useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { FileExcelOutlined } from '@ant-design/icons';
import * as OrderPraInterfaces from '@/pages/marketing/order-pra/interface/OrderPraInterfaces';
import { generatePurchaseOrderPDF } from '@/utils/generatePdf/generatePurchaseOrderPDF';
import TitleCardDetail from '@/components/atoms/Cards/titleCardDetail';
import Buttonback from '@/components/atoms/button/buttonBack';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import { ButtonFile } from '@/components/atoms/button/buttonCardGroups';
import * as generateExcel from '@/utils/generateExcel/RN/generateExcelPO_RN';
import { showNotification } from '@/contexts/services/notificationService';
import { openUrl } from '@/utils/func/func';
interface DataType {
  key: string;
  name: string;
  age: number;
  address: string;
}

export default function OrderPRNDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [dataPO, setDataPO] = useState<OrderPraInterfaces.PurchaseOrderData | null>(null);
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

  // Gunakan total tagihan tersimpan. Jika data lama belum memiliki totalAmount,
  // hitung dari harga dasar + seluruh nominal PPN yang tersimpan.
  const totalTagihan =
    Number(dataPO?.totalAmount || 0) > 0
      ? Number(dataPO?.totalAmount)
      : Number(dataPO?.subtotalAmount || 0) +
        (dataPO?.PurchaseOrderTax || [])
          .filter((tax: any) => String(tax.taxType || '').toUpperCase() === 'PPN')
          .reduce((total: number, tax: any) => total + Number(tax.taxAmount || 0), 0);

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      type Product = {
        productId: string;
        quantity: number;
        unitPrice: number;
        price: number;
      };

      function hitungTotalHarga(products: Product[]): number {
        return products.reduce((total, product) => {
          return total + product.quantity * (product.unitPrice || product.price);
        }, 0);
      }
      const picked = dataSourceItems
        .filter((item: any) => item.productId)
        .map(({ productId, quantity, unitPrice }: any) => ({
          productId,
          quantity,
          unitPrice,
        }));
      values = {
        ...values,
        description: '-',
        subtotalAmount: hitungTotalHarga(dataSourceItems),
        items: picked,
      };
      if (id) {
        await OrderPraAxios.updateOrderPra(id, values);
        showNotification('success', 'Berhasil', 'Berhasil Ubah Data');
        setTimeout(() => {
          navigate('/po-order-prn');
        }, 2000);
        setLoading(false);
        form.resetFields();
      }
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Ubah Data');
    }
  };

  globalHooks.useFetchOptions(unit, setUnit, OrderPraAxios.fetchDataUnit, [unit.nama]);

  globalHooks.useFetchOptions(customer, setCustomer, OrderPraAxios.fetchDataCustomer, [
    customer.name,
  ]);
  useEffect(() => {
    getDataCode();
    getDataPurchaseOrderPradId();
  }, []);

  const getDataCode = async () => {
    setLoading(true);
    const data = await OrderPraAxios.fetchGenCodePo();
    form.setFieldsValue({
      orderNumber: data.code,
    });
    setLoading(false);
  };

  const getDataPurchaseOrderPradId = async () => {
    try {
      if (id) {
        setLoading(true);
        const data = await OrderPraAxios.fetchDataOrderPraById(id);
        setDataPO(data);
        setDataSourceItems(data?.items || []);
        form.setFieldsValue({
          orderNumber: data.orderNumber,
          customerId: `${data.customerId}$${data.customerName}`,
          date: globalHelpers.dateFormat(data.date),
          description: data.description,
          franco: data.franco,
          subtotalAmount: data.subtotalAmount,
          totalAmount: Number(data.totalAmount || 0),
          address: data?.customer?.address,
          customerName: data?.customerName,
        });
      }
      setLoading(false);
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
    }
  };

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

  const onDownloadPdfPO = () => {
    // return
    if (dataPO) {
      const resutl = generatePurchaseOrderPDF(dataPO, 'PURCHASE ORDER');
      openUrl(resutl.url);
    }
  };

  const handleOpenFile = async () => {
    try {
      const data = await OrderPraAxios.getFileOrderPra(dataPO?.fileUrl);
      if (data) {
        // Creating a temporary anchor element to trigger download
        const link = document.createElement('a');
        link.href = data; // Assuming data is a valid URL to the file
        link.target = '_blank'; // Opens the file in a new tab/window
        link.setAttribute('download', ''); // Adds the download attribute for compatibility

        // Triggering click event to initiate download
        document.body.appendChild(link);
        link.click();

        // Removing the temporary anchor element
        document.body.removeChild(link);
      }
    } catch (error) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
      // Handle error state, e.g., show a message to the user
    }
  };

  const handleOpenFileKontrak = async () => {
    try {
      const data = await OrderPraAxios.getFileOrderPra(dataPO?.fileUrlKontrak);
      if (data) {
        // Creating a temporary anchor element to trigger download
        const link = document.createElement('a');
        link.href = data; // Assuming data is a valid URL to the file
        link.target = '_blank'; // Opens the file in a new tab/window
        link.setAttribute('download', ''); // Adds the download attribute for compatibility

        // Triggering click event to initiate download
        document.body.appendChild(link);
        link.click();

        // Removing the temporary anchor element
        document.body.removeChild(link);
      }
    } catch (error) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
      // Handle error state, e.g., show a message to the user
    }
  };

  return (
    <Card
      title={<TitleCardDetail title="Detail Pesanan (PRN)" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      extra={
        <div style={{ display: 'flex', gap: 5 }}>
          <ButtonFile
            text="Cetak Bukti Pesanan"
            color="danger"
            icon={<FilePdf />}
            onClick={() => handleOpenFile()}
          />
          <ButtonFile
            text="Cetak Kontrak"
            color="gold"
            icon={<FilePdf />}
            onClick={() => handleOpenFileKontrak()}
          />
          <ButtonFile color="blue" text="Cetak Pesanan" onClick={onDownloadPdfPO} />
          <ButtonFile
            text="Download Excel"
            icon={<FileExcelOutlined />}
            onClick={() => generateExcel.handleExportPO_RN(dataPO as any)}
          />
        </div>
      }
    >
      <Card
        title={<TitleCardItems title="Detail Pesanan" />}
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
          <Descriptions.Item label="Harga Dasar (tidak termasuk pajak)">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              <p>
                Rp. {globalHelpers.currencyFormatter(form.getFieldValue('subtotalAmount') || 0)}
              </p>
              <p
                style={{
                  color: 'green',
                }}
              >
                {globalHelpers.terbilangRupiah(form.getFieldValue('subtotalAmount') || 0)}
              </p>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="Tanggal Pesanan">
            {dayjs(form.getFieldValue('date')).format('DD/MMMM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Total Tagihan (termasuk pajak)">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              <p>Rp. {globalHelpers.currencyFormatter(totalTagihan)}</p>
              <p
                style={{
                  color: 'green',
                }}
              >
                {globalHelpers.terbilangRupiah(totalTagihan)}
              </p>
            </div>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={<TitleCardItems title="Rincian Pajak" />}
        style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)', marginTop: 10 }}
      >
        <Table
          rowKey={(record: any) => record.id || record.taxId}
          pagination={false}
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
          dataSource={dataPO?.PurchaseOrderTax || []}
        />
      </Card>

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
          marginTop: 10,
        }}
        onFinish={onFinish}
      >
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
            <Button type="primary" htmlType="button" disabled style={{ width: 150 }}>
              Tambah Items
            </Button>
          </div>
          <Table<DataType>
            columns={columns}
            dataSource={dataSourceItems}
            scroll={{ x: 'max-content' }}
          />{' '}
        </Card>
        <Flex gap="small">
          <Buttonback loading={loading} />
        </Flex>
      </Form>
    </Card>
  );
}

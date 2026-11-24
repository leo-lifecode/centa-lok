import { ArrowLeft } from '@phosphor-icons/react';
import { Card, Button, Form, Flex, Table, Descriptions } from 'antd';
import { useEffect, useState } from 'react';
import * as DeliveryOrderPraAxios from '@pages/marketing/delivery-order-pra/service/DeliveryOrderPraAxios';
import { useNavigate, useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import type { TableColumnsType } from 'antd';
import * as OrderPraInterfaces from '@/pages/marketing/order-pra/interface/OrderPraInterfaces';
import { generatePurchaseOrderPDF } from '@/utils/generatePdf/generatePurchaseOrderPDF';
import TitleCardDetail from '@/components/atoms/Cards/titleCardDetail';
import { ButtonFile } from '@/components/atoms/button/buttonCardGroups';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import * as generateForms from '@/utils/generatePdf/generateForms';
import { handleExportDO_RN } from '@/utils/generateExcel/RN/generateExcelDO_RN';
import dayjs from 'dayjs';
import { showNotification } from '@/contexts/services/notificationService';
import { openUrl } from '@/utils/func/func';
interface DataType {
  key: string;
  name: string;
  age: number;
  address: string;
}

export default function DeliveryOrderDetailRN() {
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
        await DeliveryOrderPraAxios.updateDeliveryOrderPra(id, values);
        showNotification('success', 'Berhasil', 'Berhasil Ubah Data');
        setTimeout(() => {
          navigate('/delivery-order-prn');
        }, 2000);
        setLoading(false);
        form.resetFields();
      }
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Ubah Data');
    }
  };

  globalHooks.useFetchOptions(unit, setUnit, DeliveryOrderPraAxios.fetchDataUnit, [unit.nama]);

  globalHooks.useFetchOptions(customer, setCustomer, DeliveryOrderPraAxios.fetchDataCustomer, [
    customer.name,
  ]);

  useEffect(() => {
    getDataCode();
    getDataSalesOrderPradId();
  }, []);

  const getDataCode = async () => {
    setLoading(true);
    const data = await DeliveryOrderPraAxios.fetchGenCodePo();
    form.setFieldsValue({
      orderNumber: data.code,
    });
    setLoading(false);
  };

  const getDataSalesOrderPradId = async () => {
    try {
      if (id) {
        setLoading(true);
        const data = await DeliveryOrderPraAxios.fetchDataDeliveryOrderPraById(id);
        setDataPO(data.purchaseOrder);
        const dataNew = data?.purchaseOrder?.items?.map((item: any) => ({
          ...item,
          ...item.product,
        }));
        setDataSourceItems(dataNew);
        form.setFieldsValue({
          orderNumber: data?.purchaseOrder?.orderNumber,
          customerId: data?.purchaseOrder?.customerId,
          customerName: data?.purchaseOrder?.customerName,
          date: globalHelpers.dateFormat(data?.purchaseOrder?.date),
          description: data?.purchaseOrder?.description,
          franco: data?.purchaseOrder?.franco,
          status: data?.status,
          totalAmount: data?.purchaseOrder?.totalAmount,
          address: data?.purchaseOrder?.customer?.address,
        });
      }
      setLoading(false);
    } catch (e) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
      setLoading(false);
    }
  };

  const columns: TableColumnsType<DataType> = [
    {
      title: 'Kode Barang',
      dataIndex: 'kodeBarang',
      key: 'kodeBarang',
      align: 'center',
    },
    {
      title: 'Nama Barang',
      dataIndex: 'namaBarang',
      key: 'namaBarang',
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
        return <span>{globalHelpers.currencyFormatter(stockProduct || 0)}</span>;
      },
    },
    {
      title: 'Unit',
      dataIndex: 'unitProduct',
      key: 'unit',
      align: 'center',
    },
    {
      title: 'Berat Satuan',
      dataIndex: 'nilaiSatuan',
      key: 'nilaiSatuan',
      align: 'center',
      render: (nilaiSatuan: number) => {
        return <span>{globalHelpers.currencyFormatter(nilaiSatuan || 0)}</span>;
      },
    },
    {
      title: 'Jumlah Barang',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      render: (quantity: number) => {
        return <span>{globalHelpers.currencyFormatter(quantity || 0)}</span>;
      },
    },
    {
      title: 'Total Berat',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      render: (quantity: number, record: any) => {
        return <span>{globalHelpers.currencyFormatter(quantity * record.nilaiSatuan || 0)}</span>;
      },
    },
    {
      title: 'Satuan',
      dataIndex: 'satuanProduct',
      key: 'satuanProduct',
      align: 'center',
    },
  ];

  const onDownloadPdfPO = () => {
    if (dataPO) {
      const resutl = generatePurchaseOrderPDF(dataPO, 'DELIVERY ORDER');
      openUrl(resutl.url);
    }
  };

  return (
    <Card
      title={<TitleCardDetail title="Detail Pengiriman Pesanan (PRN)" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      extra={
        <div style={{ display: 'flex', gap: 5 }}>
          <ButtonFile color="blue" text="Cetak DO" onClick={onDownloadPdfPO} />
          <ButtonFile
            color="danger"
            text="Cetak AU-58"
            onClick={() => {
              const result = generateForms.generateAU58Do(dataPO);
              openUrl(result.url);
            }}
          />
          <ButtonFile text="Download Excel" onClick={() => handleExportDO_RN(dataPO as any)} />
        </div>
      }
    >
      <Card
        title={<TitleCardItems title="Detail Pengiriman" />}
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
              <p>
                Rp.{' '}
                {globalHelpers.currencyFormatter(Number(form.getFieldValue('totalAmount') || 0))}
              </p>
              <p
                style={{
                  color: 'green',
                }}
              >
                {globalHelpers.terbilangRupiah(Number(form.getFieldValue('totalAmount') || 0))}
              </p>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="Tanggal Pesanan">
            {dayjs(form.getFieldValue('date')).format('DD/MMMM/YYYY')}
          </Descriptions.Item>
        </Descriptions>
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
          title={<TitleCardItems title="Pesanan Item" />}
          style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
        >
          <Table<DataType>
            columns={columns}
            dataSource={dataSourceItems}
            scroll={{ x: 'max-content' }}
          />{' '}
        </Card>
        <Flex gap="small">
          <Button
            loading={loading}
            onClick={() => navigate(-1)}
            color="green"
            htmlType="button"
            icon={<ArrowLeft />}
            style={{ width: '150px' }}
          >
            Back
          </Button>
        </Flex>
      </Form>
    </Card>
  );
}

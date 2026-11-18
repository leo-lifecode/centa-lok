import { Plus } from '@phosphor-icons/react';
import { Card, Button, Form, Flex, Table, Descriptions } from 'antd';
import { useEffect, useState } from 'react';
import * as CrossChekPajakAxios from '@/pages/keuangan/cross-chek-pajak/service/CrossChekPajakAxios';
import { useNavigate, useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import Buttonback from '@/components/atoms/button/buttonBack';
import TitleCardItemsList from '@/components/atoms/Cards/Items/titleCardItemsList';
import { showNotification } from '@/contexts/services/notificationService';
import TitleCardDetail from '@/components/atoms/Cards/titleCardDetail';
import * as OrderRNAxios from '@pages/marketing-rn/order-rn/service/OrderRNAxios';

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

export default function CrossChekPajakRnDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [dataSourceItems, setDataSourceItems] = useState<any>([]);
  const [dataSourcePajak, setDataSourcePajak] = useState<any>([]);

  const onFinish = async (values: any) => {
    try {
      const dataSourcePajakNew = dataSourcePajak
        .filter((data: any) => data?.add)
        .map((item: any) => ({
          taxAmount: item.taxAmount,
          taxId: item.taxId,
          taxType: item.taxType,
          taxValue: item.taxValue,
          spbId: values.spbId,
        }));

      const payload = {
        totalAmounTax: values.totalAmounTax,
        spbId: values.spbId,
        totalAmount: values.totalAmount,
        purchaseOrderId: values.purchaseOrderId,
        orderNumber: values.orderNumber,
        taxes: dataSourcePajakNew,
        item: dataSourceItems.map((item: any) => ({ productId: item.productId })),
      };
      setLoading(true);
      await CrossChekPajakAxios.posCrossChekPajak(payload);
      showNotification('success', 'Berhasil', 'Data Berhasil di Tambahkan');
      setTimeout(() => {
        navigate('/cross-chek-pajak');
      }, 2000);
      setLoading(false);
      form.resetFields();
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Menambahkan Data');
    }
  };
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
          totalAmounTax: data.totalAmount + totalPPh22 + totalPPh23,
        });
      }
      setLoading(false);
    } catch (e) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
      setLoading(false);
    }
  };
  return (
    <Card
      title={<TitleCardDetail title="Cross Chek Pajak Detail" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
    >
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="Nomor Pesanan">
          {form.getFieldValue('orderNumber')}
        </Descriptions.Item>
        <Descriptions.Item label="Customer">{form.getFieldValue('customerName')}</Descriptions.Item>
        <Descriptions.Item label="Tanggal Pesanan">
          {dayjs(form.getFieldValue('date')).format('DD/MM/YYYY')}
        </Descriptions.Item>
        <Descriptions.Item label="Harga Dasar (tidak termasuk pajak)">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            <p>Rp. {globalHelpers.currencyFormatter(form.getFieldValue('subtotalAmount') || 0)}</p>
            <p
              style={{
                color: 'green',
              }}
            >
              {globalHelpers.terbilangRupiah(form.getFieldValue('subtotalAmount') || 0)}
            </p>
          </div>
        </Descriptions.Item>
        <Descriptions.Item label="Keterangan">
          {form.getFieldValue('description')}
        </Descriptions.Item>
        <Descriptions.Item label="Total Tagihan" span={2}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            <p>
              Rp. {globalHelpers.currencyFormatter(Number(form.getFieldValue('totalAmount')) || 0)}
            </p>
            <p
              style={{
                color: 'green',
              }}
            >
              {globalHelpers.terbilangRupiah(form.getFieldValue('totalAmount') || 0)}
            </p>
          </div>
        </Descriptions.Item>
      </Descriptions>

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
              disabled
              icon={<Plus />}
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
        </Flex>
      </Form>
    </Card>
  );
}

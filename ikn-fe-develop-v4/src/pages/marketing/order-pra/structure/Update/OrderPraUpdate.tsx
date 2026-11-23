import { Calendar, Eye, FilePdf, Note, Plus, TagChevron, Truck } from '@phosphor-icons/react';
import { Form, Row, Col, Flex, Upload, Space, Popconfirm, Tooltip } from 'antd';
import { useMemo } from 'react';
import * as OrderPraAxios from '@pages/marketing/order-pra/service/OrderPraAxios';
import { useNavigate, useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonEdit from '@/components/atoms/button/buttonEdit';
import TitleCardEdit from '@/components/atoms/Cards/titleCardEdit';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import TitleCardItemsList from '@/components/atoms/Cards/Items/titleCardItemsList';
import * as OrderPraInterfaces from '@/pages/marketing/order-pra/interface/OrderPraInterfaces';
import {
  DeleteOutlined,
  SearchOutlined,
  SisternodeOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import DrawerOrderPra from '../Components/DrawerOrderPra/DrawerOrderPra';
import DrawerPajakOrderPra from '../Components/DrawerOrderPra/DrawerPajakOrderPra';
import { ButtonEditGroup } from '@/components/atoms/button/buttonTableGroups';
import { showNotification } from '@/contexts/services/notificationService';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import ModalCustomer from '@/components/ModalCustomer/ModalCustomer';
import * as globalInterfaces from '@/utils/interfaces/interfacesGlobal';
import { handleMessageError } from '@/utils/func/func';
import { useState } from '@/hooks/React/useState';
import { useEffect } from '@/hooks/React/useEffect';
import { Button, Card, DatePicker, Input, InputNumber, Table } from '@/components/ui';

export default function OrderPraUpdate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [openDrawer, seOpenDrawer] = useState<boolean>(false);
  const [dataPO, setDataPO] = useState<OrderPraInterfaces.PurchaseOrderData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [formItems] = Form.useForm();
  const [open, setOpen] = useState<boolean>(false);
  const [customer, setCustomer] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    name: '',
  });

  const [dataSourceItems, setDataSourceItems] = useState<OrderPraInterfaces.ProductType[]>([]);
  const [dataSourcePajak, setDataSourcePajak] = useState<any[]>([]);
  const [openDrawerPajak, setOpenDrawerPajak] = useState<{
    open: boolean;
    totalAmount: number;
    subtotalAmount: number;
  }>({
    open: false,
    totalAmount: 0,
    subtotalAmount: 0,
  });

  useEffect(() => {
    const hargaTotal = globalHelpers.hitungTotalHarga(dataSourceItems);
    form.setFieldValue('subtotalAmount', hargaTotal);
  }, [dataSourceItems]);

  const totalHargaDenganPajak = useMemo(() => {
    const subtotal = globalHelpers.hitungTotalHarga(dataSourceItems);

    const totalPajak = dataSourcePajak.reduce((total: number, pajak: any) => {
      const taxType = String(pajak.taxType || '').toUpperCase();
      const taxValue = Number(pajak.taxValue || 0);

      if (taxType.includes('PPN')) {
        return total + subtotal * taxValue;
      }

      return total;
    }, 0);

    return subtotal + totalPajak;
  }, [dataSourceItems, dataSourcePajak]);

  const dataSourcePajakDisplay = useMemo(() => {
    const subtotal = globalHelpers.hitungTotalHarga(dataSourceItems);

    return dataSourcePajak.map((pajak: any) => {
      const taxType = String(pajak.taxType || '').toUpperCase();
      const taxValue = Number(pajak.taxValue || 0);

      if (taxType.includes('PPN')) {
        return {
          ...pajak,
          taxAmount: subtotal * taxValue,
        };
      }

      return {
        ...pajak,
        taxAmount: 0,
      };
    });
  }, [dataSourceItems, dataSourcePajak]);

  const onFinish = async (values: any) => {
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
        }: any) => ({
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
          quantity: Number(String(quantity ?? 0).replace(',', '.')),
          unitPrice: 0,
          namabarangProductInvoice,
          nilaiSatuan,
        })
      );

      if (id) {
        if (values.file) {
          try {
            const formData = new FormData();
            const originalFile = values.file.originFileObj;

            const renamedFile = new File([originalFile], `${Date.now()}-${originalFile.name}`, {
              type: originalFile.type,
            });
            values = {
              ...values,
              description: values.description,
              customerId: values.customerId,
              customerName: values.customerName,
              subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
              totalAmount: totalHargaDenganPajak,
              items: picked,
              taxes: dataSourcePajakDisplay.map((item: any) => ({
                taxId: item.taxId || item.id,
                taxType: item.taxType,
                taxValue: Number(item.taxValue),
                taxAmount: Number(item.taxAmount),
              })),
              file: renamedFile.name,
            };
            formData.append('file', renamedFile);
            await OrderPraAxios.uploadFileOrderPra(formData);
          } catch (e) {
            throw new Error('Failed to upload file');
          }
        } else {
          values = {
            ...values,
            description: values.description,
            customerId: values.customerId,
            customerName: values.customerName,
            subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
            totalAmount: totalHargaDenganPajak,
            items: picked,
            taxes: dataSourcePajakDisplay.map((item: any) => ({
              taxId: item.taxId || item.id,
              taxType: item.taxType,
              taxValue: Number(item.taxValue),
              taxAmount: Number(item.taxAmount),
            })),
          };
        }
        const { status, ...payload } = values;
        await OrderPraAxios.updateOrderPra(id, payload);
        showNotification('success', 'Berhasil', 'Berhasil Ubah Data');
        setTimeout(() => {
          navigate('/po-order-pra');
        }, 2000);
        setLoading(false);
        form.resetFields();
      }
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Ubah Data');
    }
  };

  globalHooks.useFetchOptionsSearch(customer, setCustomer, OrderPraAxios.fetchDataCustomer, []);

  useEffect(() => {
    getDataCode();
    getDataSalesOrderPradId();
  }, []);

  const getDataCode = async () => {
    setLoading(true);
    const data = await OrderPraAxios.fetchGenCodePo();
    form.setFieldsValue({
      orderNumber: data.code,
    });
    setLoading(false);
  };

  const getDataSalesOrderPradId = async () => {
    try {
      if (id) {
        setLoading(true);
        const data = await OrderPraAxios.fetchDataOrderPraById(id);
        setDataPO(data);

        const dataItems = globalHelpers.isiNilaiSatuan(data?.items || []);

        setDataSourceItems(dataItems || []);

        const subtotal = globalHelpers.hitungTotalHarga(dataItems || []);
        form.setFieldValue('subtotalAmount', subtotal);

        setDataSourcePajak(data?.PurchaseOrderTax || []);

        form.setFieldsValue({
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          customerName: data.customerName,
          date: dayjs(data.date, 'YYYY-MM-DD'),
          description: data.description,
          franco: data.franco,
          status: data.status,
          kebun: data.kebun,
        });
      }
      setLoading(false);
    } catch (e) {
      setLoading(false);
      const message = handleMessageError(e);
      showNotification('error', 'Gagal', message);
    }
  };

  const columnsPajak: TableColumnsType<any> = [
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
      render: (taxValue: number) => {
        return <span>{Number(taxValue || 0) * 100}%</span>;
      },
    },
    {
      title: 'Jumlah Pajak',
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      align: 'center',
      render: (taxAmount: number) => {
        return <span>Rp{globalHelpers.currencyFormatter(taxAmount || 0)}</span>;
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      align: 'center',
      render: (_: any, record: any) => (
        <Popconfirm
          title="Apakah Anda yakin ingin menghapus pajak ini?"
          okText="Ya"
          cancelText="Batal"
          disabled={IsStatus}
          onConfirm={() => handleDeletePajak(record.taxId || record.id)}
        >
          <Button disabled={IsStatus} type="primary" danger icon={<DeleteOutlined />}>
            Hapus
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const columns: TableColumnsType<OrderPraInterfaces.ProductType> = [
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
      key: 'unitProduct',
      align: 'center',
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
      title: 'Aksi',
      dataIndex: 'action',
      width: 200,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: OrderPraInterfaces.ProductType) => (
        <Space>
          <ButtonEditGroup disabled={IsStatus} onClick={() => handleEdit(record.productId)} />
          <Popconfirm
            title="Apakah Anda yakin ingin menghapus data ini?"
            okText="Ya"
            cancelText="Batal"
            disabled={IsStatus}
            onConfirm={() => handleDelete(record.productId)}
          >
            <Button
              disabled={form.getFieldValue('status') !== 'WAITING'}
              type="primary"
              danger
              icon={<DeleteOutlined />}
            >
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleDeletePajak = (taxId: string) => {
    setDataSourcePajak((prev) => prev.filter((item: any) => (item.taxId || item.id) !== taxId));
  };

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
      beratproduct: findOne?.total,
    });
    seOpenDrawer(true);
  };

  const handleOpenFile = async () => {
    try {
      const data = await OrderPraAxios.getFileOrderPra(dataPO?.fileUrl);
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

  const handleRowDoubleClick = (record: globalInterfaces.DataTypeCustomer) => {
    form.setFieldsValue({
      customerId: record.id || null,
      customerName: record.name,
    });
    setOpen(false);
  };

  const IsStatus = useMemo(
    () => form.getFieldValue('status') !== 'WAITING',
    form.getFieldValue('status')
  );

  return (
    <Card
      title={<TitleCardEdit title="Edit Pesanan (PRA)" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
    >
      <ModalCustomer open={open} setOpen={setOpen} handleRowDoubleClick={handleRowDoubleClick} />

      <DrawerOrderPra
        openDrawer={openDrawer}
        seOpenDrawer={seOpenDrawer}
        setDataSourceItems={setDataSourceItems}
        formItems={formItems}
      />

      <DrawerPajakOrderPra
        openDrawer={openDrawerPajak}
        seOpenDrawer={setOpenDrawerPajak}
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
              label="Status"
              name="status"
              style={{
                display: 'none',
              }}
              rules={[{ required: true, message: 'status' }]}
            >
              <Input
                disabled
                style={{ width: '100%' }}
                prefix={<TagChevron size={16} />}
                placeholder="status"
              />
            </Form.Item>

            <Form.Item
              label="Nomor Pesanan"
              name="orderNumber"
              rules={[{ required: true, message: 'Masukan nilai nomor pesanan!' }]}
            >
              <Input
                style={{ width: '100%' }}
                prefix={<TagChevron size={16} />}
                placeholder="Nomor pesanan"
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
              label="Kebun"
              name="kebun"
              style={{ width: '100%' }}
              rules={[{ required: true, message: 'Masukan Nama Kebun!' }]}
            >
              <Input prefix={<SisternodeOutlined size={16} />} placeholder="Nama Kebun" />
            </Form.Item>

            <Form.Item
              label="Tanggal Pesanan"
              name="date"
              rules={[{ required: true, message: 'Masukan Tanggal Pesnanan!' }]}
              getValueFromEvent={(date) => {
                return date ? date.format('YYYY-MM-DD') : null;
              }}
              getValueProps={(value) => {
                return {
                  value: value ? dayjs(value, 'YYYY-MM-DD') : undefined,
                };
              }}
            >
              <DatePicker
                prefix={<Calendar />}
                style={{ width: '100%' }}
                placeholder="Tanggal Pesanan"
                format={'YYYY-MM-DD'}
              />
            </Form.Item>

            <Form.Item
              label="Upload File Pesanan"
              name="file"
              valuePropName="file"
              extra={
                <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                  <li
                    style={{
                      color: '#52c41a',
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: 4,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                    onClick={handleOpenFile}
                  >
                    <Eye style={{ marginRight: 8 }} /> Lihat PDF
                  </li>
                  <li style={{ color: '#52c41a', display: 'flex', alignItems: 'center' }}>
                    <FilePdf style={{ marginRight: 8 }} /> File harus PDF
                  </li>
                </ul>
              }
              getValueFromEvent={(e) => {
                if (Array.isArray(e)) return e;
                return e?.fileList?.[0];
              }}
              rules={[{ required: false, message: 'Masukan file!' }]}
            >
              <Upload beforeUpload={() => false} maxCount={1}>
                <Button icon={<UploadOutlined />}>Pilih File</Button>
              </Upload>
            </Form.Item>
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
              label="Harga Dasar (tidak termasuk pajak)"
              name="subtotalAmount"
              rules={[{ required: true, message: 'Harga total!' }]}
              extra={<TextTerbilang form={form} properti="subtotalAmount" />}
            >
              <InputNumber
                prefix={<span>Rp</span>}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                disabled
                controls={false}
                style={{ width: '100%' }}
                placeholder={'Harga Dasar (tidak termasuk pajak)'}
              />
            </Form.Item>

            <Form.Item
              label="Harga Total (termasuk pajak)"
              extra={
                <div
                  style={{
                    color: '#5D8736',
                    fontStyle: 'italic',
                    textTransform: 'capitalize',
                    textDecoration: 'underline',
                  }}
                >
                  <span>Terbilang: </span>
                  {globalHelpers.terbilangRupiah(totalHargaDenganPajak)}
                </div>
              }
            >
              <InputNumber
                prefix={<span>Rp</span>}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                value={totalHargaDenganPajak}
                disabled
                controls={false}
                style={{ width: '100%' }}
                placeholder={'Harga Total (termasuk pajak)'}
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
            <Tooltip title={IsStatus && 'SPB Telah dikonfirmasi tidak dapat edit data ini'}>
              <Button
                type="primary"
                htmlType="button"
                disabled={IsStatus}
                icon={<Plus />}
                onClick={() => {
                  seOpenDrawer(true);
                  formItems.resetFields();
                }}
                style={{ width: 150 }}
              >
                Tambah Item
              </Button>
            </Tooltip>
          </div>

          <Table<OrderPraInterfaces.ProductType>
            columns={columns}
            dataSource={dataSourceItems}
            scroll={{ x: 'max-content' }}
          />
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
            <Tooltip title={IsStatus && 'SPB Telah dikonfirmasi tidak dapat edit data ini'}>
              <Button
                type="primary"
                htmlType="button"
                disabled={IsStatus}
                icon={<Plus />}
                onClick={() =>
                  setOpenDrawerPajak((prev) => ({
                    ...prev,
                    open: true,
                    subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
                    totalAmount: totalHargaDenganPajak,
                  }))
                }
                style={{ width: 150 }}
              >
                Tambah Pajak
              </Button>
            </Tooltip>
          </div>

          <Table
            columns={columnsPajak}
            dataSource={dataSourcePajakDisplay}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </Card>

        <Flex gap="small">
          <Buttonback loading={loading} />
          <ButtonEdit loading={loading} />
        </Flex>
      </Form>
    </Card>
  );
}

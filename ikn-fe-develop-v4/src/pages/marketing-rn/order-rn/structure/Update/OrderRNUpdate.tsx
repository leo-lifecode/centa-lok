import { Calendar, Eye, FilePdf, Note, Plus, TagChevron, Truck } from '@phosphor-icons/react';
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Flex,
  DatePicker,
  Input,
  Table,
  InputNumber,
  Upload,
  Space,
  Popconfirm,
  Tooltip,
} from 'antd';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as OrderPraAxios from '@pages/marketing/order-pra/service/OrderPraAxios';
import { useNavigate, useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import type { TableColumnsType } from 'antd';
import DrawerOrderPra from './DrawerOrderRN/DrawerOrderRN';
import DrawerPajakOrderRN from '../Components/DrawerPajakOrderRN/DrawerPajakOrderRN';
import dayjs from 'dayjs';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonEdit from '@/components/atoms/button/buttonEdit';
import TitleCardEdit from '@/components/atoms/Cards/titleCardEdit';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import * as OrderPraInterfaces from '@/pages/marketing/order-pra/interface/OrderPraInterfaces';
import { DeleteOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { showNotification } from '@/contexts/services/notificationService';
import * as OrderRNInterfaces from '@/pages/marketing-rn/order-rn/interface/OrderRNInterfaces';
import { ButtonEditGroup } from '@/components/atoms/button/buttonTableGroups';
import ModalCustomer from '@/components/ModalCustomer/ModalCustomer';
import * as globalInterfaces from '@/utils/interfaces/interfacesGlobal';
import { handleDate, handleMessageError } from '@/utils/func/func';

export default function OrderRNUpdate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [formItems] = Form.useForm();
  const [openDrawer, seOpenDrawer] = useState<boolean>(false);
  const [dataPO, setDataPO] = useState<OrderPraInterfaces.PurchaseOrderData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
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
  const totalPajak = dataSourcePajak.reduce((total, tax) => {
    const taxType = String(tax.taxType || '').toUpperCase();
    return taxType.includes('PPN')
      ? total + Number(subtotalAmount) * Number(tax.taxValue || 0)
      : total;
  }, 0);
  const totalSetelahPajak = Number(subtotalAmount) + totalPajak;
  const dataSourcePajakDisplay = dataSourcePajak.map((tax) => ({
    ...tax,
    // Nominal pajak mengikuti tarif master; hanya PPN menambah total tagihan seperti RA.
    taxAmount: Number(subtotalAmount) * Number(tax.taxValue || 0),
  }));

  const handleSetDataSourcePajak = (updater: any) => {
    setDataSourcePajak((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      // Satu master pajak hanya boleh dipilih sekali dalam satu Purchase Order.
      return next.filter(
        (tax: any, index: number, taxes: any[]) =>
          taxes.findIndex((item) => (item.taxId || item.id) === (tax.taxId || tax.id)) === index
      );
    });
  };

  useEffect(() => {
    const hargaTotal = globalHelpers.hitungTotalHarga(dataSourceItems);
    form.setFieldValue('subtotalAmount', hargaTotal);
  }, [dataSourceItems]);

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
          quantity,
          unitPrice: 0,
          namabarangProductInvoice,
          nilaiSatuan,
        })
      );
      if (id) {
        if (values?.file && values?.fileKontrak) {
          try {
            const formData = new FormData();
            const originalFile = values.file.originFileObj;

            // Ganti nama file
            const renamedFile = new File(
              [originalFile],
              `${Date.now()}-${originalFile.name}`, // nama file baru
              { type: originalFile.type }
            );

            const formDataKontrak = new FormData();
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
              date: handleDate(values.date as any) as any,
              subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
              items: picked,
              file: renamedFile.name,
              fileKontrak: renamedFileKontrak.name,
            };
            formData.append('file', renamedFile);
            formDataKontrak.append('file', renamedFileKontrak);
            await OrderPraAxios.uploadFileOrderPra(formDataKontrak);
            await OrderPraAxios.uploadFileOrderPra(formData);
          } catch (e) {
            throw new Error('Failed to upload file');
          }
          // saat file ada
        } else if (values.file) {
          try {
            const formData = new FormData();
            const originalFile = values.file.originFileObj;

            // Ganti nama file
            const renamedFile = new File(
              [originalFile],
              `${Date.now()}-${originalFile.name}`, // nama file baru
              { type: originalFile.type }
            );

            values = {
              ...values,
              description: values.description,
              customerId: values.customerId,
              customerName: values.customerName,
              subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
              items: picked,
              file: renamedFile.name,
            };
            formData.append('file', renamedFile);
            await OrderPraAxios.uploadFileOrderPra(formData);
          } catch (e) {
            throw new Error('Failed to upload file');
          }
        } else if (values?.fileKontrak) {
          const formDataKontrak = new FormData();
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
            subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
            items: picked,
            fileKontrak: renamedFileKontrak.name,
          };
          formDataKontrak.append('file', renamedFileKontrak);
          await OrderPraAxios.uploadFileOrderPra(formDataKontrak);
        }
        //saat file tidak ada
        else {
          values = {
            ...values,
            description: values.description,
            customerId: values.customerId,
            customerName: values.customerName,
            subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
            items: picked,
          };
        }
        values = {
          ...values,
          totalAmount: totalSetelahPajak,
          taxes: dataSourcePajakDisplay.map((tax) => ({
            taxId: tax.taxId || tax.id,
            taxType: tax.taxType,
            taxValue: Number(tax.taxValue),
            taxAmount: Number(tax.taxAmount),
          })),
        };
        await OrderPraAxios.updateOrderPra(id, values);
        // Sinkronkan cache daftar PRN agar data terbaru tampil setelah kembali dari form edit.
        await queryClient.invalidateQueries({ queryKey: ['order-rn'] });
        showNotification('success', 'Berhasil', 'Berhasil Ubah Data');
        setTimeout(() => {
          navigate('/po-order-prn');
        }, 2000);
        setLoading(false);
        form.resetFields();
      }
    } catch (e) {
      setLoading(false);
      const message = handleMessageError(e);
      showNotification('error', 'Gagal', message);
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
        setDataSourceItems(data?.items || []);
        setDataSourcePajak(data?.PurchaseOrderTax || []);
        form.setFieldsValue({
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          customerName: data.customerName,
          date: dayjs(data.date, 'YYYY-MM-DD'),
          description: data.description,
          franco: data.franco,
        });
      }
      setLoading(false);
    } catch (e) {
      const message = handleMessageError(e);
      showNotification('error', 'Gagal', message);
      setLoading(false);
    }
  };

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
      nilaiSatuan: findOne?.beratproduct,
      namabarangProductInvoice: findOne?.namabarangProductInvoice,
      quantity: findOne?.quantity,
      priceProduct: findOne?.priceProduct,
      beratproduct: findOne?.beratproduct,
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

  const handleOpenFileKontrak = async () => {
    try {
      const data = await OrderPraAxios.getFileOrderPra(dataPO?.fileUrlKontrak);
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

  return (
    <Card
      title={<TitleCardEdit title="Edit Pesanan (PRN)" />}
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
    >
      <ModalCustomer open={open} setOpen={setOpen} handleRowDoubleClick={handleRowDoubleClick} />
      <DrawerPajakOrderRN
        openDrawer={openDrawerPajak}
        seOpenDrawer={setOpenDrawerPajak}
        setDataSourcePajak={handleSetDataSourcePajak}
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
                disabled
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
              label="Tanggal Pesanan"
              name="date"
              rules={[{ required: true, message: 'Masukan Tanggal Pesnanan!' }]}
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
                placeholder="Tanggal Pesanan"
                format={'YYYY-MM-DD'}
              />
            </Form.Item>

            <Flex>
              <Form.Item
                label="Upload File Pesanan"
                name="file"
                valuePropName="file"
                getValueFromEvent={(e) => {
                  if (Array.isArray(e)) return e;
                  return e?.fileList?.[0]; // Ambil file pertama saja
                }}
                rules={[{ required: false, message: 'Masukan file!' }]}
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
                      onClick={handleOpenFileKontrak}
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
                  return e?.fileList?.[0]; // Ambil file pertama saja
                }}
                rules={[{ required: false, message: 'Masukan file kontrak!' }]}
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
            >
              <InputNumber
                prefix={<span>RP</span>}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                disabled
                controls={false}
                style={{ width: '100%' }}
                placeholder={'Harga total'}
              />
            </Form.Item>
            <Form.Item label="Total setelah Pajak">
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
              Tambah Item
            </Button>
          </div>
          <Table<OrderRNInterfaces.ProductType>
            columns={columns}
            dataSource={dataSourceItems}
            scroll={{ x: 'max-content' }}
          />{' '}
        </Card>

        <Card title="Daftar Pajak">
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
              Tambah Pajak
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
              {
                title: 'Aksi',
                key: 'action',
                align: 'center',
                render: (_: any, record: any) => (
                  <Button
                    danger
                    onClick={() => setDataSourcePajak((previous) => previous.filter((tax) => (tax.taxId || tax.id) !== (record.taxId || record.id)))}
                  >
                    Hapus
                  </Button>
                ),
              },
            ]}
            dataSource={dataSourcePajakDisplay}
            pagination={false}
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

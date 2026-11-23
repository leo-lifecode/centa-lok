import { Eye, FilePdf, Note, Plus, TagChevron, Truck } from '@phosphor-icons/react';
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
  Upload,
  InputNumber,
  Space,
  Popconfirm,
  Tooltip,
} from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import type { TableColumnsType } from 'antd';
import {
  DeleteOutlined,
  DollarCircleOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import { decodeToken } from '@/api/authService';
import * as OrderPraInterfaces from '@/pages/marketing/order-pra/interface/OrderPraInterfaces';

import * as OrderEksporRNInterfaces from '@pages/marketing-rn-ekspor/order-rn-ekspor/interface/OrderEksporRNInterfaces';
import TextTerbilangDollar from '@/components/atoms/Text/TextTerbilangDollar';
import * as OrderEksporRNAxios from '@pages/marketing-rn-ekspor/order-rn-ekspor/service/OrderEksporRNAxios';
import DrawerOrderPra from './DrawerOrderEksporRN/DrawerOrderEksporRN';
import { showNotification } from '@/contexts/services/notificationService';
import AdditionalChargesForm from '@pages/marketing-rn-ekspor/order-rn-ekspor/structure/Components/AdditionalChargesForm';
import * as OrderPraAxios from '@pages/marketing/order-pra/service/OrderPraAxios';
import { incotermsOptions, paymentOptions } from '@/utils/conts';
import { ButtonEditGroup } from '@/components/atoms/button/buttonTableGroups';
import * as globalInterfaces from '@/utils/interfaces/interfacesGlobal';
import ModalCustomer from '@/components/ModalCustomer/ModalCustomer';
import dayjs from 'dayjs';
import { handleDate } from '@/utils/func/func';

export default function OrderEksporRNUpdate() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [formItems] = Form.useForm();
  const [formAsuransi] = Form.useForm();
  const { id } = useParams();
  const [dataPO, setDataPO] = useState<OrderPraInterfaces.PurchaseOrderData | null>(null);

  const [openDrawer, seOpenDrawer] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [customer, setCustomer] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    name: '',
  });

  const [dataSourceItems, setDataSourceItems] = useState<OrderEksporRNInterfaces.ProductType[]>([]);
  useEffect(() => {
    const hargaTotal = globalHelpers.hitungTotalHarga(dataSourceItems);
    form.setFieldValue('subtotalAmount', hargaTotal);
  }, [dataSourceItems]);

  const onFinish = async (values: OrderEksporRNInterfaces.PayloadOrderRNType) => {
    const additionalCharges = formAsuransi.getFieldsValue();

    try {
      // setLoading(true);
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
        }: OrderEksporRNInterfaces.ProductType) => ({
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

      const additionalService = additionalCharges.additionalCharges?.map(
        (item: OrderEksporRNInterfaces.AdditionalServiceType) => {
          return {
            amount: item.amount,
            description: item.description,
            type: item.type,
          };
        }
      );

      try {
        if (decodeToken()?.id && id) {
          const formData = new FormData();
          const formDataKontrak = new FormData();
          const formDataKonEkspor = new FormData();
          const formDataProduksi = new FormData();

          const originalFile = values?.file && values.file.originFileObj;
          // Ganti nama file
          const renamedFile = new File(
            [originalFile],
            `${Date.now()}-${originalFile?.name}`, // nama file baru
            { type: originalFile?.type }
          );

          const originalFileKontrak = values?.fileKontrak && values.fileKontrak.originFileObj;
          const renamedFileKontrak = new File(
            [originalFileKontrak],
            `${Date.now()}-${originalFileKontrak?.name}-kontrak`, // nama file baru
            { type: originalFileKontrak?.type }
          );

          const originalFileEkspor = values?.fileUrlEkspor && values.fileUrlEkspor.originFileObj;
          const renamedFileEkspor = new File(
            [originalFileEkspor],
            `${Date.now()}-${originalFileEkspor?.name}-ekspor`, // nama file baru
            { type: originalFileEkspor?.type }
          );

          const originalFileProduksi =
            values?.fileUrlProduksi && values.fileUrlProduksi.originFileObj;
          const renamedFileProduksi = new File(
            [originalFileProduksi],
            `${Date.now()}-${originalFileProduksi?.name}-produksi`, // nama file baru
            { type: originalFileProduksi?.type }
          );

          if (values?.file) {
            values = {
              ...values,
              file: renamedFile.name as any,
            };
          }

          if (values?.fileKontrak) {
            values = {
              ...values,
              fileKontrak: renamedFileKontrak.name as any,
            };
          }

          if (values?.fileUrlEkspor) {
            values = {
              ...values,
              fileUrlEkspor: renamedFileEkspor.name as any,
            };
          }

          if (values?.fileUrlProduksi) {
            values = {
              ...values,
              fileUrlProduksi: renamedFileProduksi.name as any,
            };
          }

          values = {
            ...values,
            description: values.description,
            customerId: values.customerId,
            customerName: values.customerName,
            currency: 'DOLLAR',
            subtotalAmount: globalHelpers.hitungTotalHarga(dataSourceItems),
            items: picked,
            additionalService,
            date: handleDate(values.date as any) as any,
          };

          if (values?.file) {
            formData.append('file', renamedFile);
            await OrderEksporRNAxios.uploadFileOrderPra(formData);
          }

          if (values?.fileKontrak) {
            formDataKontrak.append('file', renamedFileKontrak);
            await OrderEksporRNAxios.uploadFileOrderPra(formDataKontrak);
          }

          if (values?.fileUrlEkspor) {
            formDataKonEkspor.append('file', renamedFileEkspor);
            await OrderEksporRNAxios.uploadFileOrderPra(formDataKonEkspor);
          }

          if (values?.fileUrlProduksi) {
            formDataProduksi.append('file', renamedFileProduksi);
            await OrderEksporRNAxios.uploadFileOrderPra(formDataProduksi);
          }
        } else {
          throw new Error('Silahkan Login Kembali');
        }
      } catch (e) {
        throw new Error('Failed to upload file');
      }
      await OrderEksporRNAxios.updateOrderPra(id, values);
      showNotification('success', 'Berhasil', 'Berhasil Ubah Data');
      setTimeout(() => {
        navigate('/po-order-prn-ekspor');
      }, 2000);
      setLoading(false);
      form.resetFields();
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Ubah Data');
    }
  };

  globalHooks.useFetchOptionsSearch(
    customer,
    setCustomer,
    OrderEksporRNAxios.fetchDataCustomer,
    []
  );

  useEffect(() => {
    getDataCode();
    getDataPurchaseOrderPradId();
  }, []);

  const getDataPurchaseOrderPradId = async () => {
    try {
      if (id) {
        setLoading(true);
        const data = await OrderPraAxios.fetchDataOrderPraById(id);
        setDataPO(data);
        setDataSourceItems(globalHelpers.isiNilaiSatuan(data?.items || []));
        form.setFieldsValue({
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          customerName: data.customerName,
          date: globalHelpers.dateFormat(data.date),
          description: data.description,
          franco: data.franco,
          subtotalAmount: data.subtotalAmount,
          address: data?.customer?.address,
          typePayment: data?.typePayment,
          downPayment: data?.downPayment,
          incoterms: data?.incoterms,
        });
        formAsuransi.setFieldValue('additionalCharges', data?.additionalCharges);
      }
      setLoading(false);
    } catch (e) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
      setLoading(false);
    }
  };

  const getDataCode = async () => {
    setLoading(true);
    const data = await OrderEksporRNAxios.fetchGenCodeOrderPrnEkspor();
    form.setFieldsValue({
      orderNumber: data.code,
    });
    setLoading(false);
  };

  const columns: TableColumnsType<OrderEksporRNInterfaces.ProductType> = [
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
        return <span>${globalHelpers.currencyFormatter(priceProduct)}</span>;
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
      render: (_: any, record: OrderEksporRNInterfaces.ProductType) => (
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
  const tipePembayaran = Form.useWatch('typePayment', form);

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

  const handleOpenFileEkspor = async () => {
    try {
      const data = await OrderPraAxios.getFileOrderPra(dataPO?.fileUrlEkspor);
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

  const handleOpenFileProduksi = async () => {
    try {
      const data = await OrderPraAxios.getFileOrderPra(dataPO?.fileUrlProduksi);
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
      beratproduct: findOne?.beratproduct,
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

  return (
    <Card
      title={<TitleCardAdd title="Edit Pesanan (RN Ekspor)" />}
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        backgroundColor: '#fff',
      }}
    >
      <ModalCustomer open={open} setOpen={setOpen} handleRowDoubleClick={handleRowDoubleClick} />
      <DrawerOrderPra
        openDrawer={openDrawer}
        seOpenDrawer={seOpenDrawer}
        setDataSourceItems={setDataSourceItems}
        formItems={formItems}
      />

      <Form
        layout="vertical"
        form={form}
        name="orderForm"
        initialValues={{ remember: true }}
        style={{
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        onFinish={onFinish}
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Nomor Pesanan"
              name="orderNumber"
              rules={[{ required: true, message: 'Masukan nilai nomor pesanan!' }]}
            >
              <Input
                disabled
                style={{ width: '100%', borderRadius: 8 }}
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
              label="Tanggal PO"
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
                format={'YYYY-MM-DD'}
                style={{ width: '100%', borderRadius: 8 }}
                placeholder="Tanggal Order"
              />
            </Form.Item>

            <Form.Item
              label="Harga Total"
              name="subtotalAmount"
              rules={[{ required: true, message: 'Harga total!' }]}
              extra={<TextTerbilangDollar properti="subtotalAmount" form={form} />}
            >
              <InputNumber
                prefix={<DollarCircleOutlined />}
                formatter={globalHelpers.formatter}
                parser={globalHelpers.parser}
                disabled
                controls={false}
                style={{ width: '100%', borderRadius: 8 }}
                placeholder={'Harga total'}
              />
            </Form.Item>

            <Form.Item
              label="Incoterms"
              name="incoterms"
              rules={[{ required: true, message: 'Tipe Incoterms!' }]}
            >
              <Select
                showSearch
                placeholder="Pilih Tipe Incoterms"
                optionFilterProp="label"
                options={incotermsOptions}
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Flex wrap="wrap">
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
                getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList?.[0])}
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
                getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList?.[0])}
              >
                <Upload beforeUpload={() => false} maxCount={1}>
                  <Button icon={<UploadOutlined />}>Pilih File</Button>
                </Upload>
              </Form.Item>

              <Form.Item
                label="Upload File PI,SI,PEB dan NPE"
                name="fileUrlEkspor"
                valuePropName="file"
                extra={
                  <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                    {dataPO?.fileUrlEkspor && (
                      <li
                        style={{
                          color: '#52c41a',
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: 4,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                        }}
                        onClick={handleOpenFileEkspor}
                      >
                        <Eye style={{ marginRight: 8 }} /> Lihat PDF
                      </li>
                    )}
                    <li style={{ color: '#52c41a', display: 'flex', alignItems: 'center' }}>
                      <FilePdf style={{ marginRight: 8 }} /> File harus PDF
                    </li>
                  </ul>
                }
                getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList?.[0])}
                rules={[{ required: false, message: 'Masukan file Ekspor!' }]}
              >
                <Upload beforeUpload={() => false} maxCount={1}>
                  <Button icon={<UploadOutlined />}>Pilih File</Button>
                </Upload>
              </Form.Item>

              <Form.Item
                label="Upload File Packing List/COA"
                name="fileUrlProduksi"
                valuePropName="file"
                extra={
                  <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                    {dataPO?.fileUrlProduksi && (
                      <li
                        style={{
                          color: '#52c41a',
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: 4,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                        }}
                        onClick={handleOpenFileProduksi}
                      >
                        <Eye style={{ marginRight: 8 }} /> Lihat PDF
                      </li>
                    )}
                    <li style={{ color: '#52c41a', display: 'flex', alignItems: 'center' }}>
                      <FilePdf style={{ marginRight: 8 }} /> File harus PDF
                    </li>
                  </ul>
                }
                getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList?.[0])}
                rules={[{ required: false, message: 'Masukan file!' }]}
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
              rules={[{ required: true, message: 'Masukan Keterangan!' }]}
            >
              <Input
                style={{ width: '100%', borderRadius: 8 }}
                prefix={<Note size={16} />}
                placeholder="Keterangan"
              />
            </Form.Item>

            <Form.Item
              label="Franco"
              name="franco"
              rules={[{ required: true, message: 'Masukan Franco!' }]}
            >
              <Input
                style={{ width: '100%', borderRadius: 8 }}
                prefix={<Truck size={16} />}
                placeholder="Franco"
              />
            </Form.Item>

            <Form.Item
              label="Tipe Pembayaran"
              name="typePayment"
              rules={[{ required: true, message: 'Tipe Pembayaran!' }]}
            >
              <Select
                showSearch
                placeholder="Pilih Tipe Pembayaran"
                optionFilterProp="label"
                options={paymentOptions}
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            {(tipePembayaran === 'DOWNPAYMENT' ||
              tipePembayaran === 'FULLPAYMENT_BEFORE_INVOICE' ||
              tipePembayaran === 'OTHER') && (
              <Form.Item
                label="Jumlah Di Bayarkan"
                name="downPayment"
                rules={[{ required: true, message: 'Jumlah dibayarkan total!' }]}
                extra={<TextTerbilangDollar properti="downPayment" form={form} />}
              >
                <InputNumber
                  prefix={<DollarCircleOutlined />}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  controls={false}
                  style={{ width: '100%', borderRadius: 8 }}
                  placeholder="Jumlah di Bayarkan"
                />
              </Form.Item>
            )}
          </Col>
        </Row>

        <Card
          title={<TitleCardItems title="Item Pesanan" />}
          style={{
            borderRadius: 12,
            background: '#fafafa',
            marginTop: 20,
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
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
          <Table<OrderEksporRNInterfaces.ProductType>
            columns={columns}
            dataSource={dataSourceItems as any}
            scroll={{ x: 'max-content' }}
          />
        </Card>

        <AdditionalChargesForm totalBarang={10} form={formAsuransi} />

        <Flex justify="end" gap={12} style={{ marginTop: 24 }}>
          <Buttonback loading={loading} />
          <ButtonAdd loading={loading} />
        </Flex>
      </Form>
    </Card>
  );
}

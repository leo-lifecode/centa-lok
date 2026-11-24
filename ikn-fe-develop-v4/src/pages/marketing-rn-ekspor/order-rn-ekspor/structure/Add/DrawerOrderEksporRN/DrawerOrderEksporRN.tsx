import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Space,
  Form,
  Card,
  Row,
  Col,
  Tooltip,
  Input,
  InputNumber,
  FormInstance,
} from 'antd';
import { DollarCircleFilled, SearchOutlined } from '@ant-design/icons';
import {
  Folders,
  Gauge,
  Package,
  Scales,
  Stack,
  TagChevron,
  Unite,
  Warehouse,
} from '@phosphor-icons/react';
import ModalProdukPra from '../ModalOrderEksporRN/ModalProdukEksporRN';
import * as globalHelpers from '@/utils/helper';
const { TextArea } = Input;
import * as interfacesGlobal from '@/utils/interfaces/interfacesGlobal';
import * as OrderPraInterfaces from '@/pages/marketing/order-pra/interface/OrderPraInterfaces';
import TextTerbilangDollar from '@/components/atoms/Text/TextTerbilangDollar';

export default function DrawerOrderEksporRN({
  openDrawer,
  seOpenDrawer,
  setDataSourceItems,
  formItems,
}: Readonly<{
  openDrawer: boolean;
  seOpenDrawer: Function;
  setDataSourceItems: Function;
  formItems: FormInstance;
}>) {
  const [open, setOpen] = useState(false);
  const onFinishItems = async (values: OrderPraInterfaces.PayloadOrderRAType) => {
    setDataSourceItems((prev: any) => {
      const index = prev.findIndex((item: any) => item.productId === values.productId);
      if (index !== -1) {
        const newData = [...prev];
        newData[index] = values;
        return newData;
      } else {
        return [...prev, values];
      }
    });
    formItems.resetFields();
    seOpenDrawer(false);
  };

  const handleRowDoubleClick = (record: interfacesGlobal.ProductType) => {
    formItems.setFieldsValue({
      productId: record.finishedGoodId,
      kodeBarangProduct: record.kodeBarang,
      namabarangProduct: record.namaBarang,
      spesifikasiProduct: record.spesifikasi,
      stockProduct: record.stokTerkini,
      kategoriProduct: record.kategori,
      satuanProduct: record.Satuan,
      unitProduct: record.unitNama,
      nilaiSatuan: record.nilaiSatuan,
      namabarangProductInvoice: record.namaBarang,
    });
    setOpen(false);
  };
  const quantity = Form.useWatch('quantity', formItems);
  const nilaiSatuan = Form.useWatch('nilaiSatuan', formItems);

  useEffect(() => {
    formItems.setFieldValue('beratproduct', quantity * nilaiSatuan);
  }, [quantity, nilaiSatuan]);

  const onClose = () => {
    seOpenDrawer(false);
  };

  return (
    <Drawer
      title="Imput Items Order (RN Ekspor)"
      placement={'right'}
      width={500}
      onClose={onClose}
      open={openDrawer}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={onClose}>
            OK
          </Button>
        </Space>
      }
    >
      {open && (
        <ModalProdukPra setOpen={setOpen} open={open} handleRowDoubleClick={handleRowDoubleClick} />
      )}
      <Form
        layout="vertical"
        form={formItems}
        name="items"
        initialValues={{ remember: true }}
        onFinish={onFinishItems}
      >
        <Card title="Item Orders" style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Form.Item
                  label="productId"
                  name="productId"
                  style={{ width: '100%', display: 'none' }}
                  rules={[{ required: true, message: 'Masukan productId!' }]}
                >
                  <Input
                    disabled
                    style={{ flex: 1, width: '100%' }}
                    placeholder="Masukan Kode Barang"
                  />
                </Form.Item>
                <Form.Item
                  label="Kode Barang"
                  name="kodeBarangProduct"
                  style={{ width: '100%' }}
                  rules={[{ required: true, message: 'Masukan nilai Kode Barang!' }]}
                >
                  <Input
                    prefix={<TagChevron />}
                    disabled
                    style={{ flex: 1, width: '100%' }}
                    placeholder="Masukan Kode Barang"
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
                label="Nama Barang"
                name="namabarangProduct"
                rules={[{ required: true, message: 'Masuka Keterangan!' }]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<Package size={16} />}
                  placeholder="Keterangan"
                  disabled
                />
              </Form.Item>

              <Form.Item
                label="Keterangan"
                name="namabarangProductInvoice"
                rules={[{ required: true, message: 'Masuka Keterangan!' }]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<Package size={16} />}
                  placeholder="Keterangan"
                />
              </Form.Item>

              <Form.Item
                label="Nilai Satuan"
                name="nilaiSatuan"
                rules={[{ required: true, message: 'Masukan nilai satuan!' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix={<Scales size={16} />}
                  placeholder="Nilai satuan"
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  disabled
                />
              </Form.Item>

              <Form.Item
                label="Stok"
                name="stockProduct"
                rules={[{ required: true, message: 'Masukan stok!' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix={<Warehouse size={16} />}
                  placeholder="Stok"
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  disabled
                />
              </Form.Item>

              <Form.Item
                label="Spesifikasi"
                name="spesifikasiProduct"
                // style={{marginTop:50}}
                rules={[{ required: true, message: 'Masuka spesifikasi!' }]}
              >
                <TextArea
                  style={{ width: '100%' }}
                  placeholder="Spesifikasi"
                  // disabled
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label="Kategori"
                name="kategoriProduct"
                rules={[{ required: true, message: 'Masukan kategori!' }]}
              >
                <Input prefix={<Folders />} disabled placeholder="Kategori" />
              </Form.Item>

              <Form.Item
                label="Unit"
                name="unitProduct"
                rules={[{ required: true, message: 'Masuka unit!' }]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<Unite size={16} />}
                  placeholder="unit"
                  disabled
                />
              </Form.Item>

              <Form.Item
                label="satuan"
                name="satuanProduct"
                rules={[{ required: true, message: 'Masukan satuan!' }]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<Gauge size={16} />}
                  placeholder="satuan"
                  disabled
                />
              </Form.Item>

              <Form.Item
                label="Jumlah Barang"
                name="quantity"
                rules={[
                  {
                    required: true,
                    message: 'Masukkan Jumlah Barang!',
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || value <= getFieldValue('stockProduct')) {
                        return Promise.resolve();
                      }
                      return Promise.reject('Jumlah Barang tidak boleh lebih dari Stok!');
                    },
                  }),
                ]}
              >
                <InputNumber
                  controls={false}
                  style={{ width: '100%' }}
                  prefix={<Stack size={16} />}
                  placeholder="Jumlah Barang"
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                />
              </Form.Item>

              <Form.Item
                label="Satuan Total"
                name="beratproduct"
                rules={[{ required: true, message: 'Masukan total!' }]}
              >
                <InputNumber
                  controls={false}
                  style={{ width: '100%' }}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  prefix={<Scales size={16} />}
                  placeholder="Satuan Total"
                  disabled
                />
              </Form.Item>

              <Form.Item
                label="Harga"
                name="priceProduct"
                rules={[{ required: true, message: 'Masukan harga!' }]}
                extra={<TextTerbilangDollar properti="priceProduct" form={formItems} />}
              >
                <InputNumber
                  prefix={<DollarCircleFilled />}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  // disabled
                  controls={false}
                  style={{ width: '100%' }}
                  placeholder={'Harga total'}
                />
              </Form.Item>
            </Col>
          </Row>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 10,
            }}
          >
            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ width: 150 }}>
                Simpan
              </Button>
            </Form.Item>
          </div>
        </Card>
      </Form>
    </Drawer>
  );
}

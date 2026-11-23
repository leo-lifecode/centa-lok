import { useState } from 'react';
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
  message,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import ModalProdukPra from '../ModalCrossChekPajak/ModalCrossChekPajak';
import * as globalHelpers from '@/utils/helper';
import { calculateTax } from '@/utils/func/func';

export default function DrawerCrossChekPajak({
  openDrawer,
  seOpenDrawer,
  setDataSourcePajak,
  form,
  dataSourcePajak,
}: Readonly<{
  openDrawer: any;
  seOpenDrawer: Function;
  setDataSourcePajak: Function;
  form: FormInstance;
  dataSourcePajak: any;
}>) {
  const [open, setOpen] = useState(false);
  const [formItems] = Form.useForm();
  const onFinishItems = async (values: any) => {
    // Satu pesanan tidak boleh memiliki pajak yang sama dua kali (unik purchaseOrderId + taxId).
    if (dataSourcePajak.some((item: any) => item.taxId === values.taxId)) {
      message.warning('Pajak ini sudah ada pada pesanan.');
      return;
    }
    values.add = true;
    const pajak = [...dataSourcePajak, values];
    const result = calculateTax(openDrawer.subtotalAmount, pajak);
    form.setFieldValue('totalAmounTax', result);
    form.setFieldValue('totalAmount', result);
    setDataSourcePajak((prev: any) => [...prev, values]);
    formItems.resetFields();

    onClose();
  };

  const handleRowDoubleClick = (record: any) => {
    formItems.setFieldsValue({
      taxValue: record.taxValue,
      taxAmount: openDrawer.subtotalAmount * record.taxValue,
      taxType: record.taxType,
      taxId: record.id,
    });
    setOpen(false);
    // Bisa set state atau panggil fungsi untuk "select" row ini
  };

  const onClose = () => {
    seOpenDrawer((prev: any) => ({ ...prev, open: false }));
  };

  return (
    <Drawer
      title="Cross Chek Pajak"
      placement={'right'}
      width={500}
      onClose={onClose}
      open={openDrawer.open}
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
        <Card title="Item Pajak" style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              {/* hide field */}
              <Form.Item
                label="taxId "
                name="taxId"
                style={{ width: '100%', display: 'none' }}
                rules={[{ required: true, message: 'Masukan taxId!' }]}
              >
                <Input
                  disabled
                  style={{ flex: 1, width: '100%' }}
                  placeholder="Masukan nilai taxId"
                />
              </Form.Item>
              {/* end hide field */}

              <Form.Item
                label="Nilai Pajak "
                name="taxValue"
                style={{ width: '100%' }}
                rules={[{ required: true, message: 'Masukan nilai pajak!' }]}
              >
                <Input
                  disabled
                  style={{ flex: 1, width: '100%' }}
                  placeholder="Masukan nilai pajak"
                />
              </Form.Item>

              <Form.Item
                label="Jumlah Pajak"
                name="taxAmount"
                rules={[{ required: true, message: 'Masuka jumlah pajak!' }]}
              >
                <InputNumber
                  disabled
                  controls={false}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  style={{ width: '100%' }}
                  placeholder="Jumlah pajak"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Form.Item
                  label="Tipe Pajak"
                  name="taxType"
                  style={{ width: '100%' }}
                  rules={[{ required: true, message: 'Masukan tipe pajak!' }]}
                >
                  <Input
                    disabled
                    style={{ flex: 1, width: '100%' }}
                    placeholder="Masukan tipe pajak"
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

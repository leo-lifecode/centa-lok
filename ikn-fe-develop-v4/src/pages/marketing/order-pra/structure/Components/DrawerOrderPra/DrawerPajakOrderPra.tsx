import { useState } from 'react';
import { Button, Drawer, Space, Form, Card, Row, Col, Tooltip, Input, InputNumber } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import ModalProdukPra from '@/pages/keuangan/cross-chek-pajak/structure/Update/ModalCrossChekPajak/ModalCrossChekPajak';
import * as globalHelpers from '@/utils/helper';

export default function DrawerPajakOrderPra({
  openDrawer,
  seOpenDrawer,
  setDataSourcePajak,
}: Readonly<{
  openDrawer: {
    open: boolean;
    subtotalAmount: number;
  };
  seOpenDrawer: Function;
  setDataSourcePajak: Function;
}>) {
  const [open, setOpen] = useState(false);
  const [formItems] = Form.useForm();

  const onFinishItems = async (values: any) => {
    const taxValue = Number(values.taxValue);

    const taxAmount = Number(openDrawer.subtotalAmount) * taxValue;

    const newTax = {
      ...values,
      taxValue,
      taxAmount,
      add: true,
    };

    setDataSourcePajak((prev: any[]) => [...prev, newTax]);

    formItems.resetFields();
    setOpen(false);
  };

  const handleRowDoubleClick = (record: any) => {
    const taxValue = Number(record.taxValue);

    const taxAmount = Number(openDrawer.subtotalAmount) * taxValue;

    formItems.setFieldsValue({
      taxId: record.id,
      taxType: record.taxType,
      taxValue,
      taxAmount,
    });

    setOpen(false);
  };

  const onClose = () => {
    seOpenDrawer((prev: any) => ({
      ...prev,
      open: false,
    }));

    formItems.resetFields();
    setOpen(false);
  };

  return (
    <Drawer
      title="Tambah Pajak"
      placement="right"
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
        name="items-pajak-order-pra"
        onFinish={onFinishItems}
      >
        <Card
          title="Item Pajak"
          style={{
            boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="taxId"
                name="taxId"
                style={{
                  width: '100%',
                  display: 'none',
                }}
                rules={[
                  {
                    required: true,
                    message: 'Masukan taxId!',
                  },
                ]}
              >
                <Input disabled />
              </Form.Item>

              <Form.Item
                label="Nilai Pajak"
                name="taxValue"
                style={{ width: '100%' }}
                rules={[
                  {
                    required: true,
                    message: 'Masukan nilai pajak!',
                  },
                ]}
              >
                <Input disabled style={{ width: '100%' }} placeholder="Masukan nilai pajak" />
              </Form.Item>

              <Form.Item
                label="Jumlah Pajak"
                name="taxAmount"
                rules={[
                  {
                    required: true,
                    message: 'Masukan jumlah pajak!',
                  },
                ]}
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
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <Form.Item
                  label="Tipe Pajak"
                  name="taxType"
                  style={{ width: '100%' }}
                  rules={[
                    {
                      required: true,
                      message: 'Masukan tipe pajak!',
                    },
                  ]}
                >
                  <Input disabled style={{ width: '100%' }} placeholder="Masukan tipe pajak" />
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

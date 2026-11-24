import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Input,
  InputNumber,
  Button,
  Form,
  Popconfirm,
  Space,
  Typography,
  Select,
  Row,
  Col,
  DatePicker,
  Flex,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router';
import * as JurnalKhususAxios from '@pages/keuangan/jurnal/jurnal-khusus/service/JurnalKhususAxios';
import Buttonback from '@/components/atoms/button/buttonBack';
const { Text } = Typography;
import * as globalHelpers from '@/utils/helper';
import { useDebounce, useFetchOptions } from '@/hooks';
import * as helperGlobal from '@/utils/helper';
import * as UnitAxios from '@pages/master/unit/service/UnitAxios';
import dayjs, { Dayjs } from 'dayjs';
import * as JurnalHeaderInterfaces from '@pages/keuangan/jurnal/jurnal-khusus/interface/JurnalHeaderInterfaces';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import { showNotification } from '@/contexts/services/notificationService';
import { TagChevron } from '@phosphor-icons/react';
import ModalAccount from '@/components/ModalAccount/ModalAccount';
import { handleDate } from '@/utils/func/func';

const JurnalUmumEdit: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState<JurnalHeaderInterfaces.JournalDetailType[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm<JurnalHeaderInterfaces.PayloadUpdateType>();

  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
    isAll: 'Y',
  });
  const [open, setOpen] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] =
    useState<JurnalHeaderInterfaces.JournalDetailType | null>(null);

  const handleAddRow = () => {
    const newRow: any = {
      id: null,
      key: Date.now().toString(),
      accountCode: '',
      debit: 0,
      credit: 0,
      addRow: true,
      unitId: '',
      accountName: '',
      isNew: true,
      creditDollar: 0,
      debitDollar: 0,
    };
    setDetails([...details, newRow]);
  };

  const handleDelete = (key: string, id: string) => {
    setDetails(details.filter((entry) => (entry.isNew ? entry.key !== key : entry.id !== id)));
  };

  const handleChange = (
    key: string,
    id: string,
    field: keyof JurnalHeaderInterfaces.JournalDetailType,
    value: string | number
  ) => {
    setDetails((prev) =>
      prev.map((entry) =>
        (entry.isNew ? entry.key === key : entry.id === id) ? { ...entry, [field]: value } : entry
      )
    );
  };

  const totalDebit = details.reduce((sum, d) => sum + Number(d.debit), 0);
  const totalCredit = details.reduce((sum, d) => sum + Number(d.credit), 0);

  const columns: ColumnsType<JurnalHeaderInterfaces.JournalDetailType> = [
    {
      title: 'Account',
      dataIndex: 'accountCode',
      render: (_value, record) => (
        <div
          style={{
            display: 'flex',
            gap: 5,
            width: 'auto',
            minWidth: 300,
          }}
        >
          <Input
            value={`${details.find((i) => (i.isNew ? i.key === record.key : i.id === record.id))?.accountCode || ''} - ${details.find((i) => (i.isNew ? i.key === record.key : i.id === record.id))?.accountName}`}
            disabled
            prefix={<TagChevron size={16} />}
            placeholder="Nama Akun"
          />

          <Tooltip title="Search akun">
            <Button
              type="primary"
              shape="circle"
              icon={<SearchOutlined />}
              onClick={() => {
                setSelectedRecord(record);
                setOpen(true);
              }}
            />
          </Tooltip>
        </div>
      ),
    },

    {
      title: 'Unit',
      dataIndex: 'unit',
      render: (_: any, record) => {
        return (
          <Select
            showSearch
            allowClear
            style={{ width: 200 }}
            placeholder="Pilih Unit"
            onChange={(val) => handleChange(record.key, record.id, 'unitId', val)}
            onSearch={onSearchUnit}
            value={record.unitId}
            options={helperGlobal.toAntdOptionsV2(unit.data || [], 'id', 'nama')}
          />
        );
      },
    },

    {
      title: 'Debit',
      dataIndex: 'debit',
      render: (value, record) => (
        <InputNumber
          formatter={globalHelpers.formatNumber2Digits}
          parser={globalHelpers.parseNumber2Digits}
          // disabled={!record.addRow}
          controls={false}
          value={value}
          style={{ width: 200 }}
          min={0}
          onChange={(val) => handleChange(record.key, record.id, 'debit', val || 0)}
        />
      ),
    },
    {
      title: 'Credit',
      dataIndex: 'credit',
      render: (value, record) => (
        <InputNumber
          style={{ width: 200 }}
          formatter={globalHelpers.formatNumber2Digits}
          parser={globalHelpers.parseNumber2Digits}
          controls={false}
          // disabled={!record.addRow}
          value={value}
          min={0}
          onChange={(val) => handleChange(record.key, record.id, 'credit', val || 0)}
        />
      ),
    },
    {
      title: 'Aksi',
      dataIndex: 'action',
      render: (_, record) => (
        <Popconfirm title="Hapus baris ini?" onConfirm={() => handleDelete(record.key, record.id)}>
          <Button danger size="small">
            Hapus
          </Button>
        </Popconfirm>
      ),
    },
  ];

  useEffect(() => {
    getDataById();
  }, []);
  const getDataById = async () => {
    try {
      if (id) {
        const data = await JurnalKhususAxios.fetchJurnalKhususDetail(id);
        const dataJurnal = data?.details.map((item) => ({
          accountCode: item.accountCode,
          credit: item.credit,
          debit: item.debit,
          id: item.id,
          isTmp: item.isTmp,
          journalEntryId: item.journalEntryId,
          unitId: item.unitId,
          accountName: item.account.name,
          creditDollar: item.creditDollar,
          debitDollar: item.debitDollar,
        }));
        setDetails((dataJurnal as any) || []);
        form.setFieldsValue({
          numberJurnal: data?.numberJurnal,
          referenceNumber: data?.referenceNumber,
          unitId: data?.unit.id as any,
          date: dayjs(data?.date) as any,
          description: data?.description,
          createdBy: data?.createdBy,
        });
      }
    } catch (e) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
    }
  };

  const handleRowDoubleClick = (
    recordRow: any,
    record: JurnalHeaderInterfaces.JournalDetailType
  ) => {
    setDetails((prev) =>
      prev.map((entry) =>
        (entry.isNew ? entry.key === record.key : entry.id === record.id)
          ? { ...entry, ['accountCode']: recordRow.code, ['accountName']: recordRow.name }
          : entry
      )
    );
    setOpen(false);
  };

  useFetchOptions(unit, setUnit, UnitAxios.fetchDataUnit, [unit.nama]);

  const onSearchUnit = useDebounce((searchText: string) => {
    setUnit((prev) => ({ ...prev, nama: searchText }));
  }, 1000);

  const handleSubmit = async (values: JurnalHeaderInterfaces.PayloadUpdateType) => {
    try {
      if (totalDebit.toFixed(2) !== totalCredit.toFixed(2)) {
        return showNotification('warning', 'Peringatan', 'Total Debit dan Kredit Harus Balanace');
      }
      const hasEmptyCOA = details.some((entry) => !entry.accountCode);
      if (hasEmptyCOA) {
        return showNotification('warning', 'Peringatan', 'Semua entri harus memiliki akun COA');
      }
      setLoading(true);
      const payload = {
        ...values,
        date: handleDate(values.date as Dayjs),
        totalBalance: totalDebit,
        details: details.map((items) => {
          const { key, isTmp, addRow, isNew, currency, accountName, ...newItems } = items; //hapus objek
          return {
            ...newItems,
            creditDollar: Number(newItems.creditDollar),
            debitDollar: Number(newItems.debitDollar),
            credit: Number(newItems.credit),
            debit: Number(newItems.debit),
            currencyValue: 0,
          };
        }),
      };

      if (id) {
        await JurnalKhususAxios.updateJurnalKhusus(id, payload as any);
        navigate('/jurnal-umum');

        setLoading(false);
        showNotification('success', 'Berhasil', 'Berhasil Edit Data');
      } else {
        showNotification('warning', 'Peringatan', 'ID jurnal Kosong');
      }
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
    }
  };

  return (
    <Card title="Edit Jurnal (Draft)">
      <ModalAccount
        record={selectedRecord}
        open={open}
        setOpen={setOpen}
        handleRowDoubleClick={handleRowDoubleClick}
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item<JurnalHeaderInterfaces.PayloadUpdateType>
              style={{ width: '100%' }}
              label="Nomor Jurnal"
              name="numberJurnal"
            >
              <Input disabled placeholder="Number Jurnal umum " style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item<JurnalHeaderInterfaces.PayloadUpdateType>
              style={{ width: '100%' }}
              label="Referensi"
              name="referenceNumber"
            >
              <Input disabled placeholder="Number Jurnal umum jurnal" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item<JurnalHeaderInterfaces.PayloadUpdateType>
              style={{ width: '100%' }}
              label="Unit"
              name={'unitId'}
            >
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                placeholder="Pilih Unit"
                onChange={() => setUnit((prev) => ({ ...prev, nama: '' }))}
                onSearch={onSearchUnit}
                options={helperGlobal.toAntdOptionsV2(unit.data || [], 'id', 'nama')}
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item<JurnalHeaderInterfaces.PayloadUpdateType>
              style={{ width: '100%' }}
              label="Tanggal"
              name="date"
              initialValue={dayjs()}
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
                // disabledDate={helperGlobal.disabledDate}
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
              />
            </Form.Item>

            <Form.Item<JurnalHeaderInterfaces.PayloadUpdateType>
              style={{ width: '100%' }}
              label="Dibuat Oleh"
              name="createdBy"
            >
              <Input disabled placeholder="Dibuat Oleh" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item<JurnalHeaderInterfaces.PayloadUpdateType>
              style={{ width: '100%' }}
              label="Keterangan"
              name="description"
            >
              <Input placeholder="Deskripsi umum jurnal" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Table
          dataSource={details}
          columns={columns}
          rowKey="id"
          pagination={false}
          style={{ marginTop: 24 }}
          scroll={{ x: 'max-contents' }}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button icon={<PlusOutlined />} onClick={handleAddRow}>
                Tambah Baris
              </Button>
              <Space>
                <Text strong>Total Debit: {totalDebit.toLocaleString()}</Text>
                <Text strong>Total Credit: {totalCredit.toLocaleString()}</Text>
              </Space>
            </div>
          )}
        />

        <Space style={{ marginTop: 24 }}>
          <Flex gap={'small'}>
            <Buttonback loading={loading} />

            <ButtonAdd loading={loading} />
          </Flex>
        </Space>
      </Form>
    </Card>
  );
};

export default JurnalUmumEdit;

import { CalendarMinus, FilePdf, MapPin, TagChevron, Unite } from '@phosphor-icons/react';
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Flex,
  DatePicker,
  Input,
  Tooltip,
  InputNumber,
  Select,
  Table,
  Space,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import * as TransactionOutAxios from '@pages/keuangan/transactionOut/service/TransactionOutAxios';
import { useNavigate, useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import { BookOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import ModalNumberAccount from './ModalNumberAccount/ModalNumberAccount';
import * as TransactionOutInterfaces from '@pages/keuangan/transactionOut/interface/TransactionOutInterfaces';
import * as AccountInterfaces from '@pages/master/account-index/account/interface/AccountInterfaces';
import * as AccountAxios from '@pages/master/account-index/account/service/AccountAxios';
import ModalPajak from './ModalPajak/ModalPajak';
import * as hooksGlobal from '@/hooks';
import * as UnitAxios from '@pages/master/unit/service/UnitAxios';
import { showNotification } from '@/contexts/services/notificationService';
import { handleDate } from '@/utils/func/func';
import ModalAccount from '@/components/ModalAccount/ModalAccount';
import { DynamicModal, useDynamicModal } from '@/components/DynamicModal';
import axios from 'axios';

const { TextArea } = Input;
type JournalEntry = {
  key: string;
  accountCode: string | null;
  keterangan: string;
  debit: number;
  credit: number;
  accountName: string;
};

export default function TransactionOutUpdate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [openAccountNumber, setOpenAccountNumber] = useState(false);
  const [_dataAccount, setDataAccount] = useState<AccountInterfaces.AccountType[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
    isAll: 'Y',
  });

  const [entries, setEntries] = useState<JournalEntry[]>([
    {
      key: '1',
      accountCode: null,
      keterangan: '',
      debit: 0,
      credit: 0,
      accountName: '',
    },
  ]);
  const [selectedRecord, setSelectedRecord] = useState<JournalEntry | null>(null);
  const [openAccountDetails, setOpenAccountDetails] = useState<boolean>(false);
  const [openAccount, setOpenAccount] = useState<boolean>(false);
  const [statusJournal, setStatusJournal] = useState([]);
  const { open: openModal, config, showModal, handleConfirm, handleCancel } = useDynamicModal();

  // unit
  hooksGlobal.useFetchOptions(unit, setUnit, UnitAxios.fetchDataUnit, [unit.nama]);
  const onSearchUnit = hooksGlobal.useDebounce((searchText: string) => {
    setUnit((prev) => ({ ...prev, nama: searchText }));
  }, 1000);

  const totalCredit = useMemo(
    () => entries.reduce((acc, cur) => acc + cur.credit, 0),
    [entries, form.getFieldValue('amount')]
  );
  const totalDebit = useMemo(
    () => entries.reduce((acc, cur) => acc + cur.debit, 0),
    [entries, form.getFieldValue('amount')]
  );

  const onFinish = async (values: TransactionOutInterfaces.TransactionOutType) => {
    if ((totalCredit + form.getFieldValue('amount')).toFixed(2) !== totalDebit.toFixed(2)) {
      showNotification('warning', 'Perhatian', 'Total Credit dan Total Debit Harus Sama');
      return;
    }
    const isPosted = statusJournal.find((item: any) => item.isPosted);
    const isAdjusted = statusJournal.find((item: any) => item.addjust);
    if (isPosted) {
      return showModal({
        type: 'danger',
        title: 'Jurna Telah di Posting (Jurnal Khusus)',
        description:
          'Transaksi ini telah di posting. Anda tidak dapat mengubahnya. Silahkan reverse posting terlebih dahulu (Jurnal Khusus).',
        confirmText: 'Ya, Ubah',
        // onConfirm: () => console.log('updated'),
      });
    }

    if (isAdjusted) {
      return showModal({
        type: 'warning',
        title: 'Jurnal Telah di Sesuaikan (Jurnal Khusus)',
        description: 'Transaksi ini telah di sesuaikan, Apakah Anda yakin untuk mengubahnya?',
        confirmText: 'Ya, Ubah',
        onConfirm: async () => {
          await submit(values);
        },
      });
    }
    await submit(values);
  };

  const submit = async (values: TransactionOutInterfaces.TransactionOutType) => {
    try {
      if (id) {
        const payload = {
          transactionNumber: values.transactionNumber,
          amount: values.amount,
          bank_account_id: values.bank_account_id,
          date: handleDate(values?.date as Dayjs),
          accountCode: values.accountCode,
          description: values?.description || '-',
          unitId: values.unit,
          to: values.to,
          address: values.address,
          BankaccountCode: values.BankaccountCode,
          cashBankTransactionDetails: entries.map((items) => {
            const { key, id, cashBankTransactionId, deletedAt, createdAt, ...newItems } =
              items as any; //hapus objek
            return { ...newItems, unitId: values.unit };
          }),
        };
        setLoading(true);
        await TransactionOutAxios.updateTransaction(id, payload as any);
        showNotification('success', 'Berhasil', 'Berhasil Edit Data');
        setTimeout(() => {
          navigate('/transaction-out');
        }, 2000);
        setLoading(false);
        form.resetFields();
      } else {
        showNotification('warning', 'Perhatian', 'ID tidak di temukan');
      }
    } catch (e: any) {
      setLoading(false);
      if (axios.isAxiosError(e?.customMessage)) {
        return showModal({
          type: 'danger',
          title: 'Terjadi Kesalahan',
          description: e?.customMessage?.response?.data?.message || 'Gagal Edit Data',
          confirmText: 'Ya, Ubah',
          // onConfirm: () => console.log('updated'),
        });
      }
      showNotification('error', 'Gagal', 'Gagal Edit Data');
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    const data = await AccountAxios.fetchDataAccount({ accountTypeName: 'EXPENSE' });
    setDataAccount(data?.data?.data?.data);
  };

  const handleRowDoubleClickAccountnUmber = async (
    record: TransactionOutInterfaces.ResponseBankType
  ) => {
    setOpenAccountNumber((open) => !open);
    form.setFieldsValue({
      namaAkun: record.bankName,
      bank_account_id: record.id,
      BankaccountCode: record.bankCode,
      description: record.bankName || '-',
    });
  };

  type TaxType = {
    taxType: string;
    taxValue: number | null;
    accountCode: string;
  };

  const onDoubleClick = (record: TaxType) => {
    form.setFieldsValue({
      taxType: record.taxType,
      taxValue: record.taxValue,
      accounIdTax: record.accountCode,
    });

    setOpen(false);
  };

  useEffect(() => {
    TransactionAxiosUse();
  }, []);

  const TransactionAxiosUse = async () => {
    try {
      if (id) {
        const data = await TransactionOutAxios.fetchDataTransactionById(id);
        setStatusJournal(data?.journalEntry || []);

        form.setFieldsValue({
          invoiceNumber: data?.invoice?.invoiceNumber,
          inputDate: globalHelpers.dateFormat(data?.date),
          date: globalHelpers.dateFormat(data?.date),
          jumlahBayar: data?.amountInIDR || 0,
          description: data?.description || '-',
          invoiceDate: globalHelpers.dateFormat(data?.invoice?.invoiceDate),
          transactionNumber: data?.transactionNumber || '-',
          nomorAkun: data?.bank_account?.bankAccountNumber || '-',
          unit: data.unitId,
          amount: Number(data?.grossAmount),
          taxType: data.taxType,
          taxValue: data.taxValue,
          accountCode: data.accountCode,
          namaAkun: data?.bank_account?.bankName,
          bank_account_id: data?.bank_account_id,
          to: data?.to,
          BankaccountCode: data?.bank_account?.accountCode || '-',
          address: data.address,
        });
        const detail = data?.cashBankTransactionDetails
          // ?.filter((item: any) => item.accountCode !== data?.bank_account?.accountCode)
          .map((item: any) => ({
            accountCode: item.accountCode,
            keterangan: item.keterangan,
            accountName: item.accountName,
            credit: Number(item.credit) || 0,
            debit: Number(item.debit) || 0,
            key: Date.now().toString() + Math.random().toString(36).substring(2, 7),
          }));
        setEntries(detail || []);
      }
    } catch (e) {
      showNotification('error', 'Gagal', 'Gagal get data');
    }
  };

  const addRow = () => {
    setEntries([
      ...entries,
      {
        key: Date.now().toString(),
        accountCode: null,
        keterangan: '',
        debit: 0,
        credit: 0,
        accountName: '',
      },
    ]);
  };

  const removeRow = (key: string) => {
    setEntries(entries.filter((entry) => entry.key !== key));
  };
  const handleChange = (key: string, field: keyof JournalEntry, value: any) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, [field]: value } : entry))
    );
  };

  const columns = [
    {
      title: 'Akun (COA)',
      dataIndex: 'coa',
      render: (_: any, record: JournalEntry) => (
        <div
          style={{
            display: 'flex',
            gap: 5,
            width: 'auto',
            minWidth: 300,
          }}
        >
          <Input
            value={`${entries.find((i) => i.key === record.key)?.accountCode || ''} - ${entries.find((i) => i.key === record.key)?.accountName}`}
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
                setOpenAccountDetails(true);
              }}
            />
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Keterangan',
      dataIndex: 'keterangan',
      render: (_: any, record: JournalEntry) => (
        <Input
          onChange={(val) => {
            handleChange(record?.key, 'keterangan', val.target.value);
          }}
          value={record.keterangan}
          prefix={<BookOutlined size={16} />}
          placeholder="Keterangan"
        />
      ),
    },

    {
      title: 'Debit',
      dataIndex: 'debit',
      render: (_: any, record: JournalEntry) => (
        <InputNumber
          controls={false}
          min={0}
          style={{ width: 200 }}
          value={record.debit}
          formatter={globalHelpers.formatNumber2Digits}
          parser={globalHelpers.parseNumber2Digits}
          onChange={(val) => {
            handleChange(record.key, 'debit', val || 0);
            if (val) handleChange(record.key, 'credit', 0); // only one side filled
          }}
        />
      ),
    },
    {
      title: 'Kredit',
      dataIndex: 'credit',
      render: (_: any, record: JournalEntry) => (
        <InputNumber
          controls={false}
          style={{ width: 200 }}
          min={0}
          value={record.credit}
          formatter={globalHelpers.formatNumber2Digits}
          parser={globalHelpers.parseNumber2Digits}
          onChange={(val) => {
            handleChange(record.key, 'credit', val || 0);
            if (val) handleChange(record.key, 'debit', 0); // only one side filled
          }}
        />
      ),
    },
    {
      title: '',
      render: (_: any, record: JournalEntry) => (
        <Button danger icon={<DeleteOutlined />} onClick={() => removeRow(record.key)} />
      ),
    },
  ];

  const handleRowDoubleClick = async (record: AccountInterfaces.AccountType) => {
    form.setFieldsValue({
      accountName: record.name,
      accountCode: record.code,
    });
    setOpenAccount(false);
  };

  const handleRowDoubleClickAccount = (recordRow: any, record: JournalEntry) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.key === record.key
          ? {
              ...entry,
              ['accountCode']: recordRow.code,
              ['accountName']: recordRow.name,
              ['keterangan']: recordRow.name || '-',
            }
          : entry
      )
    );
    setOpenAccountDetails(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <DynamicModal
        open={openModal}
        config={config}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <ModalPajak setOpen={setOpen} handleRowDoubleClick={onDoubleClick} open={open} />

      <ModalAccount
        open={openAccount}
        setOpen={setOpenAccount}
        handleRowDoubleClick={handleRowDoubleClick}
      />

      <ModalAccount
        record={selectedRecord}
        open={openAccountDetails}
        setOpen={setOpenAccountDetails}
        handleRowDoubleClick={handleRowDoubleClickAccount}
      />

      <ModalNumberAccount
        open={openAccountNumber}
        setOpen={setOpenAccountNumber}
        handleRowDoubleClick={handleRowDoubleClickAccountnUmber}
      />

      <Card
        title={<TitleCardAdd title="Edit Transaksi" />}
        style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      >
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
                label="accounIdTax"
                style={{ flex: 1, width: '100%', display: 'none' }}
                name="accounIdTax"
                rules={[{ required: false }]}
              >
                <Input
                  disabled
                  style={{ width: '100%' }}
                  prefix={<FilePdf size={16} />}
                  placeholder="Nilai accounIdTax"
                />
              </Form.Item>

              <Form.Item
                label="bankAccountId"
                style={{ flex: 1, width: '100%', display: 'none' }}
                name="bank_account_id"
                rules={[{ required: true, message: 'Masukan nilai bankAccountId!' }]}
              >
                <Input
                  disabled
                  style={{ width: '100%' }}
                  prefix={<FilePdf size={16} />}
                  placeholder="Nilai bankAccountId"
                />
              </Form.Item>

              <Form.Item
                label="Nomor Transaksi"
                style={{ flex: 1, width: '100%' }}
                name="transactionNumber"
                rules={[{ required: true, message: 'Masukan nilai Nomor Transaksi!' }]}
              >
                <Input
                  disabled
                  style={{ width: '100%' }}
                  prefix={<TagChevron size={16} />}
                  placeholder="Nilai Nomor Transaksi"
                />
              </Form.Item>

              <Form.Item
                label="Tanggal Keluar"
                name="date"
                rules={[{ required: true, message: 'Masukan Tanggal Keluar' }]}
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
                  prefix={<CalendarMinus />}
                  style={{ width: '100%' }}
                  placeholder="Tanggal Keluar"
                  format={'YYYY-MM-DD'}
                />
              </Form.Item>

              <Form.Item
                label="Jumlah Pembayaran"
                name="amount"
                rules={[{ required: true, message: 'Masukan jumlah!' }]}
                extra={<TextTerbilang form={form} properti="amount" />}
              >
                <InputNumber
                  controls={false}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  style={{ width: '100%' }}
                  prefix={<span>Rp</span>}
                  placeholder="Jumlah"
                />
              </Form.Item>

              <Form.Item
                label="Unit"
                name="unit"
                rules={[{ required: true, message: 'Masukan unit' }]}
              >
                <Select
                  prefix={<Unite />}
                  showSearch
                  loading={unit.loading}
                  placeholder="Pilih unit"
                  optionFilterProp="label"
                  onChange={() => setUnit((prev) => ({ ...prev, nama: '' }))}
                  onSearch={onSearchUnit}
                  options={globalHelpers.toAntdOptionsV2(unit.data || [], 'id', 'nama')}
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
                  label="Nama Akun"
                  style={{ flex: 1, width: '100%' }}
                  name="namaAkun"
                  rules={[{ required: true, message: 'Masukan nilai Nama Akun!' }]}
                >
                  <Input
                    disabled
                    style={{ width: '100%' }}
                    prefix={<TagChevron size={16} />}
                    placeholder="Nilai nama akun"
                  />
                </Form.Item>
                <Tooltip title="search">
                  <Button
                    disabled
                    type="primary"
                    onClick={() => setOpenAccountNumber(true)}
                    shape="circle"
                    icon={<SearchOutlined />}
                  />
                </Tooltip>

                <Form.Item
                  label="BankaccountCode"
                  style={{ flex: 1, width: '100%', display: 'none' }}
                  name="BankaccountCode"
                  rules={[{ required: false }]}
                >
                  <Input
                    disabled
                    style={{ width: '100%' }}
                    prefix={<FilePdf size={16} />}
                    placeholder="Nilai BankaccountCode"
                  />
                </Form.Item>
              </div>

              <Form.Item label="Catatan" style={{ flex: 1, width: '100%' }} name="description">
                <TextArea rows={2} placeholder="Masukan Catatan" />
              </Form.Item>

              <Form.Item
                label="Penerima"
                style={{ flex: 1, width: '100%' }}
                name="to"
                rules={[{ required: true, message: 'Masukan Penerima!' }]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<TagChevron size={16} />}
                  placeholder="Penerima"
                />
              </Form.Item>

              <Form.Item
                label="Alamat Penerima"
                style={{ flex: 1, width: '100%' }}
                name="address"
                rules={[{ required: true, message: 'Masukan Alamat Penerima' }]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<MapPin size={16} />}
                  placeholder="Alamat Penerima"
                />
              </Form.Item>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={entries}
            pagination={false}
            scroll={{ x: 'max-content' }}
            rowKey="key"
            footer={() => (
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>
                  Tambah Baris
                </Button>

                <div
                  style={{
                    display: 'flex',
                    gap: 50,
                  }}
                >
                  <div>
                    <b>Total Debit: </b>
                    <span>{globalHelpers.formatter(totalDebit)}</span>
                  </div>
                  <div>
                    <b>Total Credit: </b>
                    <span>
                      {globalHelpers.formatter(totalCredit + form.getFieldValue('amount') || 0)}
                    </span>
                  </div>
                </div>
              </Space>
            )}
          />

          <Flex gap="small">
            <Buttonback loading={loading} />
            <ButtonAdd loading={loading} />
          </Flex>
        </Form>
      </Card>
    </div>
  );
}

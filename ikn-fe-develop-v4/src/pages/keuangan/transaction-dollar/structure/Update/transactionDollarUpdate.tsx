import { CalendarMinus, FilePdf, TagChevron, Unite } from '@phosphor-icons/react';
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
import * as TransactionAxios from '@pages/keuangan/transaction-dollar/service/TransactionDollarAxios';
import * as TransactionInterfaces from '@pages/keuangan/transaction/interface/TransactionInterfaces';
import * as MasterAkunBankAxios from '@pages/master/master-akun-bank/service/MasterAkunBankAxios';
import * as MasterAkunBankInterfaces from '@pages/master/master-akun-bank/interface/MasterAkunBankInterfaces';
import * as hooksGlobal from '@/hooks';
import * as UnitAxios from '@pages/master/unit/service/UnitAxios';
import * as globalHelpers from '@/utils/helper';
import * as InvoiceEksporRNInterfaces from '@pages/marketing-rn-ekspor/invoice-rn-ekspor/interface/InvoiceEksporRNInterfaces';
import { useNavigate, useParams } from 'react-router';
import {
  BookOutlined,
  DeleteOutlined,
  DollarCircleFilled,
  PlusCircleFilled,
  SearchOutlined,
} from '@ant-design/icons';
import ModalDeliveryPoPra from './ModalTransactionDollar/ModalTransactionDollar';
import dayjs from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import ModalNumberAccount from './ModalNumberAccount/ModalNumberAccount';
import { showNotification } from '@/contexts/services/notificationService';
import TextTerbilangDollar from '@/components/atoms/Text/TextTerbilangDollar';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import { handleDate, isValidCode } from '@/utils/func/func';
import ModalAccount from '@/components/ModalAccount/ModalAccount';

type JournalEntry = {
  key: string;
  accountCode: string | null;
  keterangan: string;
  debit: number;
  credit: number;
  accountName: string;
};

const { TextArea } = Input;
export default function TransactionDollarUpdate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [isManual, setIsManual] = useState<boolean>(false);
  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
    isAll: 'Y',
  });
  const [open, setOpen] = useState<boolean>(false);
  const [openAccountNumber, setOpenAccountNumber] = useState<boolean>(false);
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
  const totalCredit = useMemo(
    () => entries.reduce((acc, cur) => acc + cur.credit, 0),
    [entries, form.getFieldValue('amount')]
  );
  const totalDebit = useMemo(() => entries.reduce((acc, cur) => acc + cur.debit, 0), [entries]);

  const onFinish = async (values: TransactionInterfaces.TransactionType) => {
    if (totalCredit.toFixed(2) !== (totalDebit || 0).toFixed(2)) {
      showNotification('warning', 'Perhatian', 'Total Credit dan Total Debit Harus Sama');
      return;
    }
    try {
      if (id) {
        const payload = {
          transactionNumber: values?.transactionNumber,
          amount: values?.jumlahBayar,
          amountOriginal: values.amountOriginal,
          description: values?.description || '-',
          receivedFrom: values?.receivedFrom || null,
          purpose: values?.purpose || null,
          invoiceId: values?.invoiceId,
          bank_account_id: values?.bankAccountId,
          date: handleDate(values?.inputDate),
          administrasiAmount: values?.biaya,
          unitId: values.unitId,
          currency: 'DOLLAR',
          exchangeRate: values.exchangeRate,

          cashBankTransactionDetails: entries.map((items) => {
            const { key, id, cashBankTransactionId, deletedAt, createdAt, ...newItems }: any =
              items; //hapus objek
            return { ...newItems, unitId: values.unitId };
          }),
        };
        setLoading(true);
        await TransactionAxios.updateTransaction(id, payload as any);
        showNotification('success', 'Berhasil', 'Berhasil Edit Data');
        setTimeout(() => {
          navigate('/transaction-dollar');
        }, 2000);
        setLoading(false);
        form.resetFields();
      } else {
        showNotification('warning', 'Perhatian', 'ID tidak di temukan');
      }
    } catch (e: unknown) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Edit Data');
    }
  };

  const handleRowDoubleClick = (record: InvoiceEksporRNInterfaces.ResponseDataDetailType) => {
    form.setFieldsValue({
      invoiceId: record.id,
      invoiceNumber: record.invoiceNumber,
      invoiceDate: dayjs(record.date),
      biaya: 0,
      amountOriginal: record.totalCIF - Number(record.donePayment || 0),
      sumTmp: record.totalCIF - Number(record.donePayment || 0),
    });
    setOpen((open) => !open);
  };

  const inputDate = Form.useWatch('inputDate', form);
  const bankAccountId = Form.useWatch('bankAccountId', form);

  useEffect(() => {
    if (bankAccountId && inputDate) {
      generateCodeVoucher(bankAccountId, inputDate);
    }
  }, [inputDate, bankAccountId]);

  const handleRowDoubleClickAccountnUmber = async (
    record: MasterAkunBankInterfaces.DataBankAccountType
  ) => {
    generateCodeVoucher(record.id, inputDate);
    setOpenAccountNumber((open) => !open);
    form.setFieldValue('nomorAkun', record.bankAccountNumber);
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

  const generateCodeVoucher = async (id: string, date: Date) => {
    const query: MasterAkunBankInterfaces.ParamsBankAccountTypeGenCode = {
      bankAccountId: id,
      tanggal: date,
    };
    const data = await MasterAkunBankAxios.fetchGenCodeAkunBank(query);
    form.setFieldValue('transactionNumber', data.data);
    form.setFieldValue('bankAccountId', id);
  };

  const biaya: number = Form.useWatch('biaya', form);
  const sumTmp: number = Form.useWatch('sumTmp', form);
  const exchangeRate: number = Form.useWatch('exchangeRate', form);
  const jumlahBayarDollar: number = Form.useWatch('jumlahBayarDollar', form);

  useEffect(() => {
    const safeBiaya = isNaN(biaya) ? 0 : biaya;
    const safeAmount = isNaN(sumTmp) ? 0 : sumTmp;
    const jumlah = safeAmount - safeBiaya;
    form.setFieldValue('amountOriginal', jumlah);
  }, [biaya, sumTmp]);

  useEffect(() => {
    const amountOriginal = form.getFieldValue('amountOriginal');
    const sumRupiah = amountOriginal * exchangeRate;
    form.setFieldValue('amount', sumRupiah || 0);
  }, [exchangeRate, biaya]);

  useEffect(() => {
    const sumRupiah = jumlahBayarDollar * exchangeRate;
    form.setFieldValue('jumlahBayar', sumRupiah || 0);
  }, [jumlahBayarDollar, exchangeRate]);

  // unit
  hooksGlobal.useFetchOptions(unit, setUnit, UnitAxios.fetchDataUnit, [unit.nama]);

  const onSearchUnit = hooksGlobal.useDebounce((searchText: string) => {
    setUnit((prev) => ({ ...prev, nama: searchText }));
  }, 1000);

  useEffect(() => {
    getDataById();
  }, []);

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

  const getDataById = async () => {
    try {
      if (id) {
        setLoading(true);
        const data = await TransactionAxios.fetchDataTransactionById(id);
        setIsManual(!data?.invoiceEksporId);
        form.setFieldsValue({
          transactionNumber: data?.transactionNumber,
          amount: data?.amountInIDR,
          jumlahBayar: data?.amountInIDR,
          amountOriginal: data.amountOriginal || 0,
          description: data?.description || '-',
          receivedFrom: data?.receivedFrom || '',
          purpose: data?.purpose || '',
          bank_account_id: data?.bankAccountId,
          date: globalHelpers.dateFormat(data?.inputDate),
          administrasiAmount: data?.biaya,
          unitId: data.unitId,
          currency: 'DOLLAR',
          exchangeRate: Number(data.exchangeRate),
          invoiceNumber: data?.invoiceEkspor?.invoiceNumber,
          inputDate: globalHelpers.dateFormat(data.date),
          unit: data?.unit?.nama,
          nomorAkun: data?.bank_account?.bankAccountNumber,
          biaya: data?.administrasiAmount && Number(data?.administrasiAmount),
          invoiceDate:
            data?.invoiceEkspor?.date && globalHelpers.dateFormat(data?.invoiceEkspor?.date),
          jumlahBayarDollar: data.amountOriginal,
          sumTmp: data.amountOriginal || 0,
          bankAccountId: data?.bank_account_id,
          invoiceId: data?.invoiceEksporId,
        });
        const detail = data?.cashBankTransactionDetails
          // ?.filter((item: any) => item.accountCode !== data?.bank_account?.accountCode)
          .map((item: any) => ({
            ...item,
            credit: Number(item.credit) || 0,
            debit: Number(item.debit) || 0,
            key: Date.now().toString() + Math.random().toString(36).substring(2, 7),
          }));
        setEntries(detail || []);
        setLoading(false);
      } else {
        showNotification('warning', 'Perhatian', 'Perhatian ID tidak di temukan');
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal get data');
    }
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
            handleChange(record.key, 'keterangan', val.target.value);
          }}
          value={record.keterangan}
          prefix={<BookOutlined size={16} />}
          placeholder="Keterangan"
        />
      ),
    },

    {
      title: 'Debit Dollar',
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
      title: 'Kredit Dollar',
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Card
        title={<TitleCardAdd title="Edit Transaksi" />}
        style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      >
        <ModalDeliveryPoPra
          open={open}
          setOpen={setOpen}
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
                label="bankAccountId"
                style={{ flex: 1, width: '100%', display: 'none' }}
                name="bankAccountId"
                rules={[{ required: true, message: 'Masukan nilai bankAccountId!' }]}
              >
                <Input
                  disabled
                  style={{ width: '100%' }}
                  prefix={<FilePdf size={16} />}
                  placeholder="Nilai bankAccountId"
                />
              </Form.Item>

              {!isManual && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Form.Item
                    label="invoiceId"
                    style={{ flex: 1, width: '100%', display: 'none' }}
                    name="invoiceId"
                    rules={[{ required: !isManual, message: 'Masukan nilai invoiceId!' }]}
                  >
                    <Input
                      disabled
                      style={{ width: '100%' }}
                      prefix={<FilePdf size={16} />}
                      placeholder="Nilai invoiceId"
                    />
                  </Form.Item>

                  <Form.Item
                    label="Nomor Invoice"
                    style={{ flex: 1, width: '100%' }}
                    name="invoiceNumber"
                    rules={[{ required: !isManual, message: 'Masukan nilai Nomor Invoice!' }]}
                  >
                    <Input
                      disabled
                      style={{ width: '100%' }}
                      prefix={<TagChevron size={16} />}
                      placeholder="Nilai nomor invoice"
                    />
                  </Form.Item>

                  <Tooltip title="search">
                    <Button
                      type="primary"
                      disabled
                      onClick={() => setOpen(true)}
                      shape="circle"
                      icon={<SearchOutlined />}
                    />
                  </Tooltip>
                </div>
              )}
              <Form.Item
                label="Tanggal Masuk"
                name="inputDate"
                initialValue={dayjs()} // default ke hari ini
                rules={[{ required: true, message: 'Masukan Tanggal Masuk' }]}
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
                  placeholder="Tanggal Masuk"
                  format={'YYYY-MM-DD'}
                />
              </Form.Item>

              <Form.Item
                label="Jumlah Pembayaran (Dollar)"
                name="amountOriginal"
                rules={[{ required: true, message: 'Masukan jumlah!' }]}
                extra={<TextTerbilangDollar form={form} properti="amountOriginal" />}
              >
                <InputNumber
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  disabled
                  defaultValue={0}
                  style={{ width: '100%' }}
                  prefix={<DollarCircleFilled size={16} />}
                  placeholder="Jumlah"
                />
              </Form.Item>

              <Form.Item
                label="Jumlah Pembayaran (Rupiah)"
                name="amount"
                rules={[{ required: true, message: 'Masukan jumlah!' }]}
                extra={<TextTerbilangDollar form={form} properti="amount" />}
              >
                <InputNumber
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  disabled
                  defaultValue={0}
                  style={{ width: '100%' }}
                  prefix={<span>Rp</span>}
                  placeholder="Jumlah"
                />
              </Form.Item>

              <Form.Item
                label="Unit"
                name="unitId"
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

              <Form.Item
                label="Jumlah Pembayaran 2"
                name="sumTmp"
                style={{
                  display: 'none',
                }}
                rules={[{ required: true, message: 'Masukan jumlah!' }]}
                extra={<TextTerbilangDollar form={form} properti="sumTmp" />}
              >
                <InputNumber
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  disabled
                  defaultValue={0}
                  style={{ width: '100%' }}
                  prefix={<DollarCircleFilled size={16} />}
                  placeholder="Jumlah"
                />
              </Form.Item>

              <Form.Item
                label="Input Jumlah Pembayaran (Rupiah)"
                name="jumlahBayar"
                rules={[
                  { required: true, message: 'Masukan jumlah!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (value === getFieldValue('amount')) {
                        return Promise.resolve();
                      }
                      return Promise.reject('Jumlah Pembayaran Tidak Valid!');
                    },
                  }),
                ]}
                extra={<TextTerbilang form={form} properti="jumlahBayar" />}
              >
                <InputNumber
                  disabled
                  controls={false}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  style={{ width: '100%' }}
                  prefix={<span>Rp</span>}
                  placeholder="Jumlah"
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
                  label="Nomor Akun"
                  style={{ flex: 1, width: '100%' }}
                  name="nomorAkun"
                  rules={[{ required: true, message: 'Masukan nilai akun!' }]}
                >
                  <Input
                    disabled
                    style={{ width: '100%' }}
                    prefix={<TagChevron size={16} />}
                    placeholder="Nilai nomor akun"
                  />
                </Form.Item>
                <Tooltip title="search">
                  <Button
                    type="primary"
                    onClick={() => setOpenAccountNumber(true)}
                    shape="circle"
                    icon={<SearchOutlined />}
                  />
                </Tooltip>
              </div>

              <Form.Item
                label="Nomor Voucher"
                style={{ flex: 1, width: '100%' }}
                name="transactionNumber"
                rules={[
                  { required: true, message: 'Masukan nilai Nomor Transaksi!' },
                  {
                    validator: (_, value) => {
                      if (!value || isValidCode(value)) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error(
                          'Format harus: code/nomor urut/bulan/tahun (contoh: BMI04/VI/2026)'
                        )
                      );
                    },
                  },
                ]}
              >
                <Input
                  style={{ width: '100%' }}
                  prefix={<TagChevron size={16} />}
                  placeholder="Nilai Nomor Transaksi"
                />
              </Form.Item>

              <Form.Item
                label="Kurs Dollar"
                name="exchangeRate"
                rules={[{ required: true, message: 'Masukan Kurs!' }]}
                extra={<TextTerbilang form={form} properti="exchangeRate" />}
              >
                <InputNumber
                  controls={false}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  style={{ width: '100%' }}
                  prefix={<span>Rp</span>}
                  placeholder="Jumlah Kurs"
                />
              </Form.Item>

              {/* <Form.Item
                label="Biaya Administrasi/Biaya Lainnya (Dollar)"
                name="biaya"
                rules={[{ required: false, message: 'Masukan Biaya!' }]}
                extra={<TextTerbilangDollar form={form} properti="biaya" />}
              >
                <InputNumber
                  controls={false}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  defaultValue={0}
                  style={{ width: '100%' }}
                  prefix={<DollarCircleFilled size={16} />}
                  placeholder="Jumlah"
                />
              </Form.Item> */}

              {!isManual && (
                <Form.Item
                  label="Tanggal Invoice"
                  name="invoiceDate"
                  rules={[{ required: !isManual, message: 'Masukan Tanggal Invoice' }]}
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
                    disabled
                    style={{ width: '100%' }}
                    placeholder="Tanggal Invoice"
                    format={'YYYY-MM-DD'}
                  />
                </Form.Item>
              )}

              <Form.Item
                label="Input Jumlah Pembayaran (Dollar)"
                name="jumlahBayarDollar"
                rules={[
                  { required: true, message: 'Masukan jumlah!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const amountOriginal = Number(getFieldValue('amountOriginal'));
                      const jumlahBayar = Number(value);

                      if (
                        value !== undefined &&
                        value !== null &&
                        Number.isFinite(jumlahBayar) &&
                        jumlahBayar >= 0 &&
                        jumlahBayar <= amountOriginal
                      ) {
                        return Promise.resolve();
                      }

                      return Promise.reject(
                        `Jumlah Pembayaran Tidak Boleh Melebihi ${amountOriginal}!`
                      );
                    },
                  }),
                ]}
                extra={<TextTerbilangDollar form={form} properti="jumlahBayarDollar" />}
              >
                <InputNumber
                  controls={false}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  style={{ width: '100%' }}
                  prefix={<DollarCircleFilled size={16} />}
                  placeholder="Jumlah"
                />
              </Form.Item>

              <Form.Item label="Penerima" name="to" style={{ flex: 1, width: '100%' }}>
                <Input placeholder="Masukan Nama Penerima" />
              </Form.Item>

              <Form.Item label="Alamat Penerima" name="address" style={{ flex: 1, width: '100%' }}>
                <TextArea rows={2} placeholder="Masukan Alamat Penerima" />
              </Form.Item>

              <Form.Item label="Catatan" style={{ flex: 1, width: '100%' }} name="description">
                <TextArea rows={2} placeholder="Masukan Catatan" />
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
                <Button type="dashed" icon={<PlusCircleFilled />} onClick={addRow}>
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
                    <span>{globalHelpers.formatter(totalCredit)}</span>
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

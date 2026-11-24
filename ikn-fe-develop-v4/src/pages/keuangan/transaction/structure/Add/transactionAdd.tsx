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
  Table,
  Tooltip,
  InputNumber,
  Select,
  Space,
  Checkbox,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import * as TransactionAxios from '@pages/keuangan/transaction/service/TransactionAxios';
import { useNavigate } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import type { TableColumnsType } from 'antd';
import {
  BookOutlined,
  DeleteOutlined,
  DollarCircleFilled,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import ModalDeliveryPoPra from './ModalTransaction/ModalTransaction';
import dayjs, { Dayjs } from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import TitleCardItemsList from '@/components/atoms/Cards/Items/titleCardItemsList';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import ModalNumberAccount from './ModalNumberAccount/ModalNumberAccount';
import * as TransactionInterfaces from '@pages/keuangan/transaction/interface/TransactionInterfaces';
import * as MasterAkunBankAxios from '@pages/master/master-akun-bank/service/MasterAkunBankAxios';
import * as MasterAkunBankInterfaces from '@pages/master/master-akun-bank/interface/MasterAkunBankInterfaces';
import * as hooksGlobal from '@/hooks';
import * as UnitAxios from '@pages/master/unit/service/UnitAxios';
import * as helperGlobal from '@/utils/helper';
import { showNotification } from '@/contexts/services/notificationService';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import { handleDate, isValidCode } from '@/utils/func/func';
import ModalAccount from '@/components/ModalAccount/ModalAccount';

const { TextArea } = Input;
type JournalEntry = {
  key: string;
  accountCode: string | null;
  keterangan: string;
  debit: number;
  credit: number;
  accountName: string;
};
export default function TransactionAdd() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
    isAll: 'Y',
  });

  const [dataSourcePajak, setDataSourcePajak] = useState<TransactionInterfaces.InvoiceTax[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [openAccountNumber, setOpenAccountNumber] = useState<boolean>(false);

  // State untuk menentukan metode input transaksi
  const [isManual, setIsManual] = useState<boolean>(false);

  // Handler ketika checkbox Input Manual berubah
  const handleManualChange = (checked: boolean) => {
    setIsManual(checked);

    if (checked) {
      form.setFieldsValue({
        invoiceId: undefined,
        invoiceNumber: undefined,
        invoiceDate: undefined,
        sumTmp: undefined,
        biaya: 0,
        amount: undefined,
      });

      setDataSourcePajak([]);
    } else {
      form.setFieldsValue({
        jumlahBayar: undefined,
      });
    }
  };
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
  const jumlahBayar = Form.useWatch('jumlahBayar', form);

  const totalCredit = useMemo(
    () => entries.reduce((acc, cur) => acc + cur.credit, 0),
    [entries, form.getFieldValue('amount')]
  );
  const totalDebit = useMemo(() => entries.reduce((acc, cur) => acc + cur.debit, 0), [entries]);

  const onFinish = async (values: TransactionInterfaces.TransactionType) => {
    const amount = isManual ? Number(values.jumlahBayar || 0) : Number(values.amount || 0);

    if (totalCredit.toFixed(2) !== (totalDebit + amount).toFixed(2)) {
      showNotification('warning', 'Perhatian', 'Total Credit dan Total Debit Harus Sama');
      return;
    }

    try {
      const payload = {
        transactionNumber: values.transactionNumber,
        amount,
        jumlahBayar: isManual ? amount : values.jumlahBayar,
        description: values.description || '-',
        receivedFrom: values.receivedFrom || null,
purpose: values.purpose || null,

        // Mode manual tidak mengirim invoiceId.
        ...(!isManual && { invoiceId: values.invoiceId }),

        bank_account_id: values.bankAccountId,
        date: handleDate(values.inputDate as Dayjs),
        unitId: values.unitId,
        exchangeRate: 0,
        cashBankTransactionDetails: entries.map((items) => {
          const { key, ...newItems } = items;

          return {
            ...newItems,
            unitId: values.unitId,
          };
        }),
      };

      setLoading(true);

      await TransactionAxios.posTransaction(payload as any);

      showNotification('success', 'Berhasil', 'Berhasil Menambahkan Data');

      setTimeout(() => {
        navigate('/transaction');
      }, 2000);

      setLoading(false);
      form.resetFields();
    } catch (e: unknown) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal Menambahkan Data');
    }
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

  const columnsPajak: TableColumnsType<TransactionInterfaces.InvoiceTax> = [
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
      render: (taxAmount) => {
        return <span>{globalHelpers.currencyFormatter(taxAmount)}</span>;
      },
    },
  ];

  const handleRowDoubleClick = (record: TransactionInterfaces.InvoiceDatumType) => {
    form.setFieldsValue({
      invoiceId: record.id,
      invoiceNumber: record.invoiceNumber,
      invoiceDate: dayjs(record.invoiceDate),
      amount: record.amountWithTax - Number(record.downPayment || 0),
      biaya: 0,
      sumTmp: record.amountWithTax - Number(record.downPayment || 0),
    });
    setDataSourcePajak(record.invoiceTaxes || []);
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

  useEffect(() => {
    if (isManual) return;

    const safeBiaya = isNaN(biaya) ? 0 : biaya;
    const safeAmount = isNaN(sumTmp) ? 0 : sumTmp;
    const jumlah = safeAmount - safeBiaya;

    form.setFieldValue('amount', jumlah);
  }, [biaya, sumTmp, isManual]);

  // unit
  hooksGlobal.useFetchOptions(unit, setUnit, UnitAxios.fetchDataUnit, [unit.nama]);

  const onSearchUnit = hooksGlobal.useDebounce((searchText: string) => {
    setUnit((prev) => ({ ...prev, nama: searchText }));
  }, 1000);

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
            handleChange(record.key, 'keterangan', val.target.value);
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <ModalAccount
        record={selectedRecord}
        open={openAccountDetails}
        setOpen={setOpenAccountDetails}
        handleRowDoubleClick={handleRowDoubleClickAccount}
      />
      <Card
        title={<TitleCardAdd title="Buat Transaksi" />}
        style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      >
        <ModalDeliveryPoPra
          open={open}
          setOpen={setOpen}
          handleRowDoubleClick={handleRowDoubleClick}
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
          <Card
            title={
              <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
                <TitleCardItems title="Detail Transaksi" />

                <Checkbox
                  checked={isManual}
                  onChange={(e) => handleManualChange(e.target.checked)}
                  style={{
                    marginInlineEnd: 0,
                    fontWeight: 500,
                    padding: '7px 14px',
                    background: isManual ? '#e6f4ff' : '#f5f5f5',
                    border: `1px solid ${isManual ? '#91caff' : '#d9d9d9'}`,
                    borderRadius: 8,
                  }}
                >
                  Penerimaan Tahun Sebelumnya (Manual)
                </Checkbox>
              </Flex>
            }
            style={{
              boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)',
              borderRadius: 10,
            }}
          >
            {' '}
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

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!isManual && (
                    <>
                      <Form.Item
                        label="invoiceId"
                        style={{ flex: 1, width: '100%', display: 'none' }}
                        name="invoiceId"
                        rules={[{ required: true, message: 'Masukan nilai invoiceId!' }]}
                      >
                        <Input
                          disabled
                          style={{ width: '100%' }}
                          prefix={<FilePdf size={16} />}
                          placeholder="Nilai invoiceId"
                        />
                      </Form.Item>
                    </>
                  )}

                  {!isManual && (
                    <>
                      <Form.Item
                        label="Nomor Invoice"
                        style={{ flex: 1, width: '100%' }}
                        name="invoiceNumber"
                        rules={[{ required: true, message: 'Masukan nilai Nomor Invoice!' }]}
                      >
                        <Input
                          disabled
                          style={{ width: '100%' }}
                          prefix={<TagChevron size={16} />}
                          placeholder="Nilai nomor invoice"
                        />
                      </Form.Item>
                    </>
                  )}

                  {!isManual && (
                    <>
                      <Tooltip title="search">
                        <Button
                          type="primary"
                          onClick={() => setOpen(true)}
                          shape="circle"
                          icon={<SearchOutlined />}
                        />
                      </Tooltip>
                    </>
                  )}
                </div>

                <Form.Item
                  label="Tanggal Masuk"
                  name="inputDate"
                  initialValue={dayjs()} // default ke hari ini
                  rules={[{ required: true, message: 'Masukan Tanggal Masuk' }]}
                >
                  <DatePicker
                    prefix={<CalendarMinus />}
                    style={{ width: '100%' }}
                    placeholder="Tanggal Masuk"
                  />
                </Form.Item>

                {!isManual && (
                  <>
                    <Form.Item
                      label="Tanggal Invoice"
                      name="invoiceDate"
                      rules={[{ required: true, message: 'Masukan Tanggal Invoice' }]}
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
                        format={'YYYY-DD-MM'}
                      />
                    </Form.Item>
                  </>
                )}

                <Form.Item
                  label="Jumlah Pembayaran 2"
                  name="sumTmp"
                  style={{ display: 'none' }}
                  rules={[
                    {
                      required: !isManual,
                      message: 'Masukan jumlah!',
                    },
                  ]}
                  extra={<TextTerbilang form={form} properti="sumTmp" />}
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
                  label="Input Jumlah Pembayaran"
                  name="jumlahBayar"
                  rules={[{ required: true, message: 'Masukan jumlah!' }]}
                  extra={<TextTerbilang form={form} properti="jumlahBayar" />}
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
  label="Diterima Dari"
  name="receivedFrom"
  style={{ flex: 1, width: '100%' }}
>
  <Input placeholder="Masukan nama pengirim / sumber penerimaan" />
</Form.Item>

<Form.Item
  label="Untuk"
  name="purpose"
  style={{ flex: 1, width: '100%' }}
>
  <TextArea rows={2} placeholder="Masukan tujuan penerimaan uang" />
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
                  name={'unitId'}
                  label="Unit"
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
                    options={helperGlobal.toAntdOptionsV2(unit.data || [], 'id', 'nama')}
                  />
                </Form.Item>

                {!isManual && (
                  <Form.Item
                    label="Jumlah Pembayaran"
                    name="amount"
                    rules={[{ required: true, message: 'Masukan jumlah!' }]}
                    extra={<TextTerbilang form={form} properti="amount" />}
                  >
                    <InputNumber
                      disabled
                      formatter={globalHelpers.formatter}
                      parser={globalHelpers.parser}
                      defaultValue={0}
                      style={{ width: '100%' }}
                      prefix={<span>Rp</span>}
                      placeholder="Jumlah"
                    />
                  </Form.Item>
                )}

                <Form.Item label="Catatan" style={{ flex: 1, width: '100%' }} name="description">
                  <TextArea rows={2} placeholder="Masukan Catatan" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {!isManual && (
            <Card
              title={<TitleCardItemsList title="Daftar Pajak" />}
              style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
            >
              <Table<TransactionInterfaces.InvoiceTax>
                columns={columnsPajak}
                dataSource={dataSourcePajak}
                scroll={{ x: 'max-content' }}
              />
            </Card>
          )}

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
                    <span>
                      {isManual
                        ? jumlahBayar !== undefined && jumlahBayar !== null && jumlahBayar !== ''
                          ? globalHelpers.formatter(totalDebit + Number(jumlahBayar || 0))
                          : ''
                        : globalHelpers.formatter(totalDebit + (form.getFieldValue('amount') || 0))}
                    </span>
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

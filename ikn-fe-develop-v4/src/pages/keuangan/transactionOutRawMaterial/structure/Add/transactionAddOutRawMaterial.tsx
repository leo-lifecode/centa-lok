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
  Checkbox,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import * as TransactionOutAxiosMaterial from '@pages/keuangan/transactionOutRawMaterial/service/TransactionOutAxios';

import { useNavigate } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import { BookOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import ModalNumberAccount from './ModalNumberAccount/ModalNumberAccount';

import * as MasterAkunBankAxios from '@pages/master/master-akun-bank/service/MasterAkunBankAxios';
import * as MasterAkunBankInterfaces from '@pages/master/master-akun-bank/interface/MasterAkunBankInterfaces';
import * as TransactionOutInterfaces from '@pages/keuangan/transactionOut/interface/TransactionOutInterfaces';
import * as AccountInterfaces from '@pages/master/account-index/account/interface/AccountInterfaces';
import * as AccountAxios from '@pages/master/account-index/account/service/AccountAxios';
import * as helperGlobal from '@/utils/helper';
import ModalPajak from './ModalPajak/ModalPajak';
import * as hooksGlobal from '@/hooks';
import * as UnitAxios from '@pages/master/unit/service/UnitAxios';
import { showNotification } from '@/contexts/services/notificationService';
import ModalRawMaterial from './ModalRawMaterial/ModalRawMaterial';
import { handleDate, isValidCode } from '@/utils/func/func';
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
export default function TransactionOutAddRawMaterial() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [openAccountNumber, setOpenAccountNumber] = useState(false);
  const [dataAccount, setDataAccount] = useState<AccountInterfaces.AccountType[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [openKategori, setOpenKategori] = useState<boolean>(false);
  const [isManual, setIsManual] = useState<boolean>(false);
  const { open: openModal, config, showModal, handleConfirm, handleCancel } = useDynamicModal();

  const handleManualChange = (checked: boolean) => {
    setIsManual(checked);

    // Bersihkan data material ketika berpindah mode
    form.setFieldsValue({
      materialId: undefined,
      accountCode: undefined,
      amount: undefined,
      payAmount: undefined,
      to: undefined,
      address: undefined,
      unit: undefined,
    });

    // Reset jurnal agar tidak membawa akun dari material sebelumnya
    setEntries([
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

  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
    isAll: 'Y',
  });

  // unit
  hooksGlobal.useFetchOptions(unit, setUnit, UnitAxios.fetchDataUnit, [unit.nama]);
  const onSearchUnit = hooksGlobal.useDebounce((searchText: string) => {
    setUnit((prev) => ({ ...prev, nama: searchText }));
  }, 1000);

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

  const totalCredit = useMemo(
    () => entries.reduce((acc, cur) => acc + cur.credit, 0),
    [entries, form.getFieldValue('payAmount')]
  );
  const totalDebit = useMemo(() => entries.reduce((acc, cur) => acc + cur.debit, 0), [entries]);

  const onFinish = async (values: TransactionOutInterfaces.TransactionOutType) => {
    if ((totalCredit + form.getFieldValue('payAmount') || 0).toFixed(2) !== totalDebit.toFixed(2)) {
      showNotification('warning', 'Perhatian', 'Total Credit dan Total Debit H  arus Sama');
      return;
    }
    try {
      const payload = {
        transactionNumber: values.transactionNumber,
        amount: values.amount,
        description: values?.description || '-',
        bank_account_id: values.bank_account_id,
        BankaccountCode: values.BankaccountCode,
        date: handleDate(values?.date as Dayjs),
        accountCode: values.accountCode,
        accounIdTax: values.accounIdTax,
        unitId: values.unit,
        to: values.to,
        address: values.address,
        ...(!isManual && { materialId: values.materialId }),
        payAmount: values.payAmount,
        cashBankTransactionDetails: entries.map((items) => {
          const { key, ...newItems } = items;

          return {
            ...newItems,
            description: items.keterangan,
            unitId: values.unit,
          };
        }),
      };
      setLoading(true);
      await TransactionOutAxiosMaterial.posTransactionOut(payload as any);
      showNotification('success', 'Berhasil', 'Berhasil Menambahkan Data');
      setTimeout(() => {
        navigate('/transaction-out-raw-material');
      }, 2000);
      setLoading(false);
      form.resetFields();
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
      showNotification('error', 'Gagal', 'Gagal Menambahkan Data');
    }
  };

  const inputDate = Form.useWatch('date', form);
  const bankAccountId = Form.useWatch('bank_account_id', form);
  useEffect(() => {
    if (bankAccountId && inputDate) {
      generateCodeVoucher(bankAccountId, inputDate);
    }
  }, [inputDate, bankAccountId]);

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    const data = await AccountAxios.fetchDataAccount({
      accountTypeName: 'EXPENSE',
      page: 1,
      limit: 100,
    });
    setDataAccount(data?.data?.data?.data);
  };

  const handleRowDoubleClickAccountnUmber = async (
    record: TransactionOutInterfaces.ResponseBankType
  ) => {
    // generateCodeVoucher(bankAccountId, inputDate);
    setOpenAccountNumber((open) => !open);
    form.setFieldsValue({
      namaAkun: record.bankName,
      bank_account_id: record.id,
      BankaccountCode: record.accountCode,
    });
  };

  const handleRowDoubleClickRawMaterial = async (record: any) => {
    try {
      const paymentTotal = (record?.items || []).reduce(
        (total: number, item: any) => total + Number(item.Total || 0),
        0
      );

      const remainingPayment = Math.max(0, paymentTotal - Number(record.downPayment || 0));

      setEntries([
        {
          key: Date.now().toString(),
          accountCode: record.supplier.accountCode,
          keterangan: record.supplier?.account?.name,
          debit: remainingPayment,
          credit: 0,
          accountName: record.supplier?.account?.name || '-',
        },
      ]);

      form.setFieldsValue({
        amount: remainingPayment,
        unit: record.unitId,
        accountCode: record.supplier.accountCode,
        address: record.supplier.alamatRekanan,
        to: record.supplier.namaRekanan,
        materialId: record.id,
        payAmount: remainingPayment,
      });

      setOpenKategori(false);
    } catch (e) {
      showNotification('error', 'Error', 'Terjadi Kesalahan');
    }
  };

  const generateCodeVoucher = async (id: string, date: Date) => {
    const query: MasterAkunBankInterfaces.ParamsBankAccountTypeGenCode = {
      bankAccountId: id,
      tanggal: date,
    };
    const data = await MasterAkunBankAxios.fetchGenCodeAkunBank(query);
    form.setFieldValue('transactionNumber', data.data);
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

  const [openAccountDetails, setOpenAccountDetails] = useState<boolean>(false);

  const [selectedRecord, setSelectedRecord] = useState<JournalEntry | null>(null);
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
    if (!isManual && entries[0]?.key === key) {
      showNotification(
        'warning',
        'Perhatian',
        'Baris pertama pembayaran material tidak boleh dihapus!'
      );
      return;
    }

    setEntries((prev) => prev.filter((entry) => entry.key !== key));
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
          max={
            !isManual && record.key === entries[0]?.key
              ? Number(form.getFieldValue('amount') || 0)
              : undefined
          }
          style={{ width: 200 }}
          value={record.debit}
          formatter={globalHelpers.formatNumber2Digits}
          parser={globalHelpers.parseNumber2Digits}
          onChange={(val) => {
            handleChange(record.key, 'debit', val || 0);
            if (val) handleChange(record.key, 'credit', 0);
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

  const handleRowDoubleClickAccount = (recordRow: any, record: JournalEntry) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.key === record.key
          ? {
              ...entry,
              ['accountCode']: recordRow.code,
              ['accountName']: recordRow.name,
              ['keterangan']: recordRow.name,
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
      <ModalRawMaterial
        open={openKategori}
        setOpen={setOpenKategori}
        handleRowDoubleClick={handleRowDoubleClickRawMaterial}
      />
      <Card
        title={
          <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
            <TitleCardAdd title="Buat Transaksi" />

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
                label="materialId"
                style={{ flex: 1, width: '100%', display: 'none' }}
                name="materialId"
                rules={[{ required: false }]}
              >
                <Input
                  disabled
                  style={{ width: '100%' }}
                  prefix={<FilePdf size={16} />}
                  placeholder="Nilai materialId"
                />
              </Form.Item>

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
              <Form.Item name="BankaccountCode" hidden>
                <Input />
              </Form.Item>

              {!isManual && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <Form.Item
                    label="kategori"
                    style={{ flex: 1, width: '100%' }}
                    name="accountCode"
                    rules={[{ required: true, message: 'Masukan nilai kategori!' }]}
                  >
                    <Select
                      style={{ width: '100%' }}
                      disabled
                      prefix={<TagChevron size={16} />}
                      placeholder="Kategori"
                      options={dataAccount.map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                    />
                  </Form.Item>

                  <Tooltip title="search">
                    <Button
                      type="primary"
                      onClick={() => setOpenKategori(true)}
                      shape="circle"
                      icon={<SearchOutlined />}
                    />
                  </Tooltip>
                </div>
              )}

              <Form.Item
                label="Nomor Transaksi"
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
                label="Tanggal Keluar"
                name="date"
                initialValue={dayjs()} // default ke hari ini
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
                  disabled={!isManual}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  style={{ width: '100%' }}
                  prefix={<span>Rp</span>}
                  placeholder="Jumlah"
                />
              </Form.Item>

              <Form.Item
                label="Total"
                name="payAmount"
                rules={[
                  { required: true, message: 'Masukan jumlah!' },
                  {
                    validator: (_, value) => {
                      // Validasi ini hanya berlaku untuk mode Default.
                      if (isManual) {
                        return Promise.resolve();
                      }

                      const amount = Number(form.getFieldValue('amount') || 0);
                      const payment = Number(value || 0);
                      const debitMaterial = Number(entries[0]?.debit || 0);

                      if (!Number.isFinite(payment) || payment <= 0) {
                        return Promise.reject(new Error('Jumlah pembayaran harus lebih dari 0!'));
                      }

                      if (!Number.isFinite(debitMaterial) || debitMaterial <= 0) {
                        return Promise.reject(new Error('Pembayaran material harus lebih dari 0!'));
                      }

                      if (debitMaterial > amount) {
                        return Promise.reject(
                          new Error('Pembayaran material tidak boleh melebihi sisa tagihan!')
                        );
                      }

                      if (payment < debitMaterial) {
                        return Promise.reject(
                          new Error(
                            'Total uang keluar tidak boleh lebih kecil dari pembayaran material!'
                          )
                        );
                      }

                      return Promise.resolve();
                    },
                  },
                ]}
                extra={<TextTerbilang form={form} properti="payAmount" />}
              >
                <InputNumber
                  controls={false}
                  min={isManual ? undefined : 1}
                  precision={2}
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
                    type="primary"
                    onClick={() => setOpenAccountNumber(true)}
                    shape="circle"
                    icon={<SearchOutlined />}
                  />
                </Tooltip>
              </div>

              <Form.Item
                label="Penerima"
                style={{ flex: 1, width: '100%' }}
                name="to"
                rules={[{ required: true, message: 'Masukan Penerima!' }]}
              >
                <Input
                  disabled={!isManual}
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
                  disabled={!isManual}
                  style={{ width: '100%' }}
                  prefix={<MapPin size={16} />}
                  placeholder="Alamat Penerima"
                />
              </Form.Item>

              <Form.Item label="Catatan" style={{ flex: 1, width: '100%' }} name="description">
                <TextArea rows={2} placeholder="Masukan Catatan" />
              </Form.Item>

              <Form.Item
                label="Unit"
                name="unit"
                rules={[{ required: true, message: 'Masukan unit' }]}
              >
                <Select
                  disabled={!isManual}
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
                      {globalHelpers.formatter(totalCredit + form.getFieldValue('payAmount') || 0)}
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

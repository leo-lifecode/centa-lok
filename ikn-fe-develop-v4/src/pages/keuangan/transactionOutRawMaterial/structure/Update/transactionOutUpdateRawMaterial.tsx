import { CalendarMinus, MapPin, TagChevron, Unite } from '@phosphor-icons/react';
import {
  Card,
  Button,
  Checkbox,
  Form,
  Row,
  Col,
  Flex,
  DatePicker,
  Input,
  Tooltip,
  InputNumber,
  Select,
  Space,
  Table,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import * as TransactionOutAxiosMaterial from '@pages/keuangan/transactionOutRawMaterial/service/TransactionOutAxios';
import { useNavigate, useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import { BookOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import TextTerbilang from '@/components/atoms/Text/TextTerbilang';
import ModalNumberAccount from './ModalNumberAccount/ModalNumberAccount';

import * as TransactionOutInterfaces from '@pages/keuangan/transactionOutRawMaterial/interface/TransactionOutInterfaces';
import * as AccountInterfaces from '@pages/master/account-index/account/interface/AccountInterfaces';
import * as AccountAxios from '@pages/master/account-index/account/service/AccountAxios';
import ModalPajak from './ModalPajak/ModalPajak';
import * as hooksGlobal from '@/hooks';
import * as UnitAxios from '@pages/master/unit/service/UnitAxios';
import { showNotification } from '@/contexts/services/notificationService';
import { isValidCode } from '@/utils/func/func';
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

type TransactionFormValues = TransactionOutInterfaces.TransactionOutType & {
  date: string | Dayjs;
  unit: string;
  amount: number;
  payAmount: number;
  materialId?: string | null;
  namaAkun?: string;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function TransactionOutUpdateRawMaterial() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm<TransactionFormValues>();

  const [loading, setLoading] = useState(false);
  const [isManual, setIsManual] = useState<boolean | null>(null);
  const [originalMaterialId, setOriginalMaterialId] = useState<string | null>(null);
  const [maxMaterialPayment, setMaxMaterialPayment] = useState(0);
  const [openAccountNumber, setOpenAccountNumber] = useState(false);
  const [dataAccount, setDataAccount] = useState<AccountInterfaces.AccountType[]>([]);
  const [openTax, setOpenTax] = useState(false);
  const [openAccountDetails, setOpenAccountDetails] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<JournalEntry | null>(null);

  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
    isAll: 'Y',
  });

  const [entries, setEntries] = useState<JournalEntry[]>([]);

  const watchedPayAmount = Form.useWatch('payAmount', form);

  const totalCredit = useMemo(
    () => entries.reduce((total, item) => total + toNumber(item.credit), 0),
    [entries]
  );

  const totalDebit = useMemo(
    () => entries.reduce((total, item) => total + toNumber(item.debit), 0),
    [entries]
  );

  const totalCreditWithPayment = totalCredit + toNumber(watchedPayAmount);

  hooksGlobal.useFetchOptions(unit, setUnit, UnitAxios.fetchDataUnit, [unit.nama]);

  const onSearchUnit = hooksGlobal.useDebounce((searchText: string) => {
    setUnit((prev) => ({ ...prev, nama: searchText }));
  }, 1000);

  useEffect(() => {
    void fetchAccount();
    void loadTransaction();
  }, [id]);

  const fetchAccount = async () => {
    try {
      const response = await AccountAxios.fetchDataAccount({
        accountTypeName: 'EXPENSE',
        page: 1,
        limit: 100,
      });

      setDataAccount(response?.data?.data?.data || []);
    } catch {
      showNotification('error', 'Gagal', 'Gagal mengambil daftar akun');
    }
  };

  const loadTransaction = async () => {
    if (!id) {
      showNotification('warning', 'Perhatian', 'ID transaksi tidak ditemukan');
      return;
    }

    setLoading(true);

    try {
      const data = await TransactionOutAxiosMaterial.fetchDataTransactionById(id);

      if (!data) {
        showNotification('error', 'Gagal', 'Data transaksi tidak ditemukan');
        return;
      }

      // Mode transaksi ditentukan dari data asli.
      // Mode tidak boleh berubah selama proses UPDATE.
      const loadedMaterialId = data.materialId ? String(data.materialId) : null;

      setOriginalMaterialId(loadedMaterialId);
      setIsManual(!loadedMaterialId);

      const details: JournalEntry[] = (data.cashBankTransactionDetails || []).map(
        (item: any, index: number) => ({
          key: `${item.id || 'detail'}-${index}`,
          accountCode: item.accountCode ?? null,
          keterangan: item.keterangan || '',
          accountName: item.accountName || '',
          credit: toNumber(item.credit),
          debit: toNumber(item.debit),
        })
      );

      setEntries(details);

      // Batas pembayaran UPDATE:
      // total tagihan - (akumulasi pembayaran - debit transaksi yang sedang diedit)
      const currentTransactionDebit = toNumber(details[0]?.debit);
      const accumulatedPayment = toNumber(data.downPayment);
      const grossAmount = toNumber(data.grossAmount);

      const maxPayment = Math.max(0, grossAmount - (accumulatedPayment - currentTransactionDebit));

      setMaxMaterialPayment(maxPayment);

      form.setFieldsValue({
        transactionNumber: data.transactionNumber || '',
        date: data.date ? dayjs(data.date).format('YYYY-MM-DD') : '',
        description: data.description || '',
        unit: data.unitId || '',
        amount: toNumber(data.grossAmount),
        payAmount: toNumber(data.amountInIDR),
        accountCode: data.accountCode || undefined,
        accounIdTax: data.accounIdTax || undefined,
        taxType: data.taxType,
        taxValue: data.taxValue ?? undefined,
        bank_account_id: data.bank_account_id || '',
        to: data.to || '',
        address: data.address || '',
        materialId: loadedMaterialId || undefined,
      });

      // Field tampilan rekening, bukan bagian dari TransactionOutType
      form.setFieldValue('namaAkun' as any, data.bank_account?.bankName || '');
    } catch {
      showNotification('error', 'Gagal', 'Gagal mengambil data transaksi');
    } finally {
      setLoading(false);
    }
  };

  const handleRowDoubleClickBank = async (record: { id: string; bankName: string }) => {
    form.setFieldsValue({
      namaAkun: record.bankName,
      bank_account_id: record.id,
    });
    setOpenAccountNumber(false);
  };

  const handleTaxDoubleClick = (record: {
    taxType: string;
    taxValue: number | null;
    accountCode: string;
  }) => {
    form.setFieldsValue({
      taxType: record.taxType,
      taxValue: record.taxValue ?? undefined,
      accounIdTax: record.accountCode,
    });

    setOpenTax(false);
  };

  const addRow = () => {
    setEntries((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random()}`,
        accountCode: null,
        keterangan: '',
        debit: 0,
        credit: 0,
        accountName: '',
      },
    ]);
  };

  const removeRow = (key: string) => {
    if (isManual === false && entries[0]?.key === key) {
      showNotification(
        'warning',
        'Perhatian',
        'Baris pertama pembayaran material tidak boleh dihapus.'
      );
      return;
    }

    setEntries((prev) => prev.filter((entry) => entry.key !== key));
  };

  const handleChange = (key: string, field: keyof JournalEntry, value: unknown) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              [field]: field === 'debit' || field === 'credit' ? toNumber(value) : value,
            }
          : entry
      )
    );
  };

  const handleSelectAccount = (recordRow: any, selected: JournalEntry) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.key === selected.key
          ? {
              ...entry,
              accountCode: recordRow.code,
              accountName: recordRow.name,
              keterangan: recordRow.name,
            }
          : entry
      )
    );

    setOpenAccountDetails(false);
  };

  const columns = [
    {
      title: 'Akun (COA)',
      dataIndex: 'coa',
      render: (_: unknown, record: JournalEntry) => (
        <div style={{ display: 'flex', gap: 5, width: 'auto', minWidth: 300 }}>
          <Input
            value={`${record.accountCode || ''}${
              record.accountName ? ` - ${record.accountName}` : ''
            }`}
            disabled
            prefix={<TagChevron size={16} />}
            placeholder="Nama Akun"
          />

          <Tooltip title="Cari akun">
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
      render: (_: unknown, record: JournalEntry) => (
        <Input
          value={record.keterangan}
          onChange={(event) => handleChange(record.key, 'keterangan', event.target.value)}
          prefix={<BookOutlined size={16} />}
          placeholder="Keterangan"
        />
      ),
    },
    {
      title: 'Debit',
      dataIndex: 'debit',
      render: (_: unknown, record: JournalEntry) => (
        <InputNumber
          controls={false}
          min={0}
          max={
            isManual === false && record.key === entries[0]?.key ? maxMaterialPayment : undefined
          }
          style={{ width: 200 }}
          value={record.debit}
          formatter={globalHelpers.formatNumber2Digits}
          parser={globalHelpers.parseNumber2Digits}
          onChange={(value) => {
            handleChange(record.key, 'debit', value);

            if (toNumber(value) > 0) {
              handleChange(record.key, 'credit', 0);
            }
          }}
        />
      ),
    },
    {
      title: 'Kredit',
      dataIndex: 'credit',
      render: (_: unknown, record: JournalEntry) => (
        <InputNumber
          controls={false}
          min={0}
          style={{ width: 200 }}
          value={record.credit}
          formatter={globalHelpers.formatNumber2Digits}
          parser={globalHelpers.parseNumber2Digits}
          onChange={(value) => {
            handleChange(record.key, 'credit', value);

            if (toNumber(value) > 0) {
              handleChange(record.key, 'debit', 0);
            }
          }}
        />
      ),
    },
    {
      title: '',
      render: (_: unknown, record: JournalEntry) => (
        <Button danger icon={<DeleteOutlined />} onClick={() => removeRow(record.key)} />
      ),
    },
  ];

  const onFinish = async (values: TransactionFormValues) => {
    if (isManual === null) {
      showNotification('warning', 'Perhatian', 'Data transaksi belum selesai dimuat');
      return;
    }

    if (!id) {
      showNotification('warning', 'Perhatian', 'ID transaksi tidak ditemukan');
      return;
    }

    const paymentAmount = toNumber(values.payAmount);

    if (paymentAmount <= 0) {
      showNotification('warning', 'Perhatian', 'Jumlah pembayaran harus lebih besar dari 0');
      return;
    }

    // Validasi khusus transaksi Raw Material.
    if (isManual === false) {
      const debitMaterial = toNumber(entries[0]?.debit);

      if (debitMaterial <= 0) {
        showNotification('warning', 'Perhatian', 'Pembayaran material harus lebih besar dari 0.');
        return;
      }

      if (!entries[0]?.accountCode) {
        showNotification(
          'warning',
          'Perhatian',
          'Pilih akun COA untuk pembayaran material pada baris pertama.'
        );
        return;
      }

      if (paymentAmount < debitMaterial) {
        showNotification(
          'warning',
          'Perhatian',
          'Total uang keluar tidak boleh lebih kecil dari pembayaran material.'
        );
        return;
      }

      if (debitMaterial > maxMaterialPayment) {
        showNotification(
          'warning',
          'Perhatian',
          `Pembayaran material tidak boleh melebihi batas maksimal ${globalHelpers.formatter(
            maxMaterialPayment
          )}.`
        );
        return;
      }
    }

    if (Math.abs(totalCreditWithPayment - totalDebit) >= 0.01) {
      showNotification('warning', 'Perhatian', 'Total Kredit dan Total Debit harus sama');
      return;
    }

    // Material ID selalu berasal dari transaksi awal.
    // Dengan demikian transaksi tidak bisa berpindah mode/material.
    const payload: TransactionOutInterfaces.UpdateCashOutRawMaterialPayload = {
      transactionNumber: values.transactionNumber,
      amount: toNumber(values.amount),
      description: values.description || '-',
      bank_account_id: values.bank_account_id,
      date: dayjs(values.date).format('YYYY-MM-DD'),
      accountCode: values.accountCode,
      accounIdTax: values.accounIdTax,
      taxType: values.taxType,
      taxValue: values.taxValue,
      unitId: values.unit,
      to: values.to,
      address: values.address,

      // Material ID tetap mengikuti transaksi awal.
      // Jika transaksi awal manual, materialId tidak dikirim.
      ...(originalMaterialId ? { materialId: originalMaterialId } : {}),

      payAmount: paymentAmount,

      cashBankTransactionDetails: entries.map((item) => ({
        unitId: values.unit,

        // DTO backend mewajibkan description.
        description: item.keterangan || '-',

        accountCode: item.accountCode || undefined,
        accountName: item.accountName || '',
        keterangan: item.keterangan || '-',
        debit: toNumber(item.debit),
        credit: toNumber(item.credit),
      })),
    };

    setLoading(true);

    try {
      await TransactionOutAxiosMaterial.updateCashOutFlowRawMaterial(id, payload);

      showNotification('success', 'Berhasil', 'Berhasil memperbarui transaksi');

      navigate('/transaction-out-raw-material');
    } catch {
      showNotification('error', 'Gagal', 'Gagal memperbarui transaksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ModalPajak setOpen={setOpenTax} handleRowDoubleClick={handleTaxDoubleClick} open={openTax} />

      <ModalNumberAccount
        open={openAccountNumber}
        setOpen={setOpenAccountNumber}
        handleRowDoubleClick={handleRowDoubleClickBank}
      />

      <ModalAccount
        record={selectedRecord}
        open={openAccountDetails}
        setOpen={setOpenAccountDetails}
        handleRowDoubleClick={handleSelectAccount}
      />

      <Card
        title={
          <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
            <TitleCardAdd title="Edit Transaksi Kas Keluar Material" />

            <Checkbox
              checked={isManual === true}
              disabled
              style={{
                marginInlineEnd: 0,
                fontWeight: 500,
                padding: '7px 14px',
                background: isManual === true ? '#e6f4ff' : '#f5f5f5',
                border: `1px solid ${isManual === true ? '#91caff' : '#d9d9d9'}`,
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
          name="update-cash-out-raw-material"
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
              <Form.Item name="materialId" hidden>
                <Input disabled />
              </Form.Item>

              <Form.Item name="accounIdTax" hidden>
                <Input disabled />
              </Form.Item>

              <Form.Item
                name="bank_account_id"
                hidden
                rules={[
                  {
                    required: true,
                    message: 'Pilih rekening bank',
                  },
                ]}
              >
                <Input disabled />
              </Form.Item>

              {isManual === false && (
                <Form.Item
                  label="Kategori"
                  name="accountCode"
                  rules={[
                    {
                      required: true,
                      message: 'Kategori tidak ditemukan pada transaksi',
                    },
                  ]}
                >
                  <Select
                    disabled
                    prefix={<TagChevron size={16} />}
                    placeholder="Kategori material"
                    options={dataAccount.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                  />
                </Form.Item>
              )}

              <Form.Item
                label="Nomor Transaksi"
                name="transactionNumber"
                rules={[
                  {
                    required: true,
                    message: 'Masukkan nomor transaksi',
                  },
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
                <Input prefix={<TagChevron size={16} />} placeholder="Nomor Transaksi" />
              </Form.Item>

              <Form.Item
                label="Tanggal Keluar"
                name="date"
                rules={[
                  {
                    required: true,
                    message: 'Masukkan tanggal keluar',
                  },
                ]}
                getValueFromEvent={(date) => (date ? date.format('YYYY-MM-DD') : null)}
                getValueProps={(value) => ({
                  value: value ? dayjs(value, 'YYYY-MM-DD') : undefined,
                })}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  prefix={<CalendarMinus />}
                  format="YYYY-MM-DD"
                />
              </Form.Item>

              <Form.Item
                label="Jumlah Transaksi"
                name="amount"
                rules={[
                  {
                    required: true,
                    message: 'Masukkan jumlah transaksi',
                  },
                ]}
                extra={<TextTerbilang form={form} properti="amount" />}
              >
                <InputNumber
                  controls={false}
                  disabled={isManual !== true}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  style={{ width: '100%' }}
                  prefix={<span>Rp</span>}
                  placeholder="Jumlah"
                />
              </Form.Item>

              <Form.Item
                label="Jumlah Pembayaran"
                name="payAmount"
                rules={[
                  {
                    required: true,
                    message: 'Masukkan jumlah pembayaran',
                  },
                  {
                    validator: (_, value) =>
                      toNumber(value) > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error('Jumlah pembayaran harus lebih besar dari 0')),
                  },
                ]}
                extra={<TextTerbilang form={form} properti="payAmount" />}
              >
                <InputNumber
                  controls={false}
                  min={0}
                  formatter={globalHelpers.formatter}
                  parser={globalHelpers.parser}
                  style={{ width: '100%' }}
                  prefix={<span>Rp</span>}
                  placeholder="Jumlah pembayaran"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Form.Item
                  label="Nama Rekening"
                  name="namaAkun"
                  style={{ flex: 1, width: '100%' }}
                  rules={[
                    {
                      required: true,
                      message: 'Pilih rekening bank',
                    },
                  ]}
                >
                  <Input disabled prefix={<TagChevron size={16} />} placeholder="Nama rekening" />
                </Form.Item>

                <Tooltip title="Pilih rekening bank">
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<SearchOutlined />}
                    onClick={() => setOpenAccountNumber(true)}
                  />
                </Tooltip>
              </div>

              <Form.Item
                label="Penerima"
                name="to"
                rules={
                  isManual
                    ? [
                        {
                          required: true,
                          message: 'Masukkan penerima',
                        },
                      ]
                    : []
                }
              >
                <Input
                  disabled={isManual !== true}
                  prefix={<TagChevron size={16} />}
                  placeholder="Penerima"
                />
              </Form.Item>

              <Form.Item
                label="Alamat Penerima"
                name="address"
                rules={
                  isManual
                    ? [
                        {
                          required: true,
                          message: 'Masukkan alamat penerima',
                        },
                      ]
                    : []
                }
              >
                <Input
                  disabled={isManual !== true}
                  prefix={<MapPin size={16} />}
                  placeholder="Alamat penerima"
                />
              </Form.Item>

              <Form.Item label="Catatan" name="description">
                <TextArea rows={2} placeholder="Masukkan catatan" />
              </Form.Item>

              <Form.Item
                label="Unit"
                name="unit"
                rules={[
                  {
                    required: true,
                    message: 'Pilih unit',
                  },
                ]}
              >
                <Select
                  disabled={isManual !== true}
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
          </Row>

          <Table
            columns={columns}
            dataSource={entries}
            pagination={false}
            scroll={{ x: 'max-content' }}
            rowKey="key"
            footer={() => (
              <Space
                style={{
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>
                  Tambah Baris
                </Button>

                <div
                  style={{
                    display: 'flex',
                    gap: 32,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <b>Total Debit: </b>
                    <span>{globalHelpers.formatter(totalDebit)}</span>
                  </div>

                  <div>
                    <b>Total Kredit </b>
                    <span>{globalHelpers.formatter(totalCreditWithPayment)}</span>
                  </div>
                </div>
              </Space>
            )}
          />

          <Flex gap="small">
            <Buttonback loading={loading} />
            <ButtonAdd loading={loading || isManual === null} />
          </Flex>
        </Form>
      </Card>
    </div>
  );
}

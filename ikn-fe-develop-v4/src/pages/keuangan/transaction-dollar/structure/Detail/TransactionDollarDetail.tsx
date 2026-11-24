import {
  Card,
  Form,
  Flex,
  Divider,
  Descriptions,
  DatePicker,
  Table,
  Space,
  Button,
  Input,
  Tooltip,
  InputNumber,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import * as TransactionAxios from '@pages/keuangan/transaction-dollar/service/TransactionDollarAxios';
import * as globalHelpers from '@/utils/helper';
import { useParams } from 'react-router';
import dayjs, { Dayjs } from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';
import ButtonAdd from '@/components/atoms/button/buttonAdd';
import { showNotification } from '@/contexts/services/notificationService';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import { generateBuktiMasukDollarPDF } from '@/utils/generatePdf/generateForms';
import { ButtonFile } from '@/components/atoms/button/buttonCardGroups';
import { CalendarMinus } from '@phosphor-icons/react';
import * as TransactionOutInterfaces from '@pages/keuangan/transactionOut/interface/TransactionOutInterfaces';
import {
  BookOutlined,
  DeleteOutlined,
  PlusCircleFilled,
  SearchOutlined,
  PieChartFilled,
} from '@ant-design/icons';

type JournalEntry = {
  key: string;
  accountCode: string | null;
  keterangan: string;
  debit: number;
  credit: number;
  accountName: string;
};

export default function TransactionDollarDetail() {
  const { id } = useParams();
  const [form] = Form.useForm();
  const [dataAll, setDataAll] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [datePrint, setDatePrint] = useState<Dayjs | null>(null);
  const [other, setOther] = useState<TransactionOutInterfaces.CashBankTransactionDetails[] | []>(
    []
  );
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

  const totalDebit = useMemo(() => entries.reduce((acc, cur) => acc + cur.debit, 0), [entries]);
  const totalCredit = useMemo(() => entries.reduce((acc, cur) => acc + cur.credit, 0), [entries]);

  useEffect(() => {
    getDataById();
  }, []);

  const getDataById = async () => {
    try {
      if (id) {
        setLoading(true);
        const data = await TransactionAxios.fetchDataTransactionById(id);
        form.setFieldsValue({
          transactionNumber: data?.transactionNumber,
          amount: data?.amountInIDR,
          amountOriginal: data.amountOriginal,
          description: data?.description || '-',
          bank_account_id: data?.bankAccountId,
          date: globalHelpers.dateFormat(data?.inputDate),
          administrasiAmount: data?.biaya,
          unitId: data.unitId,
          currency: 'DOLLAR',
          exchangeRate: data.exchangeRate,
          invoiceNumber: data?.invoiceEkspor?.invoiceNumber,
          inputDate: globalHelpers.dateFormat(data.date),
          unit: data?.unit?.nama,
          nomorAkun: data?.bank_account?.bankAccountNumber,
          biaya: data?.administrasiAmount && Number(data?.administrasiAmount),
          invoiceDate:
            data?.invoiceEkspor?.date && globalHelpers.dateFormat(data?.invoiceEkspor?.date),
          jumlahBayarDollar: data.amountOriginal,
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
        setDataAll(data);
        setLoading(false);
        setOther(data?.cashBankTransactionDetails || []);
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
            prefix={<PieChartFilled size={16} />}
            placeholder="Nama Akun"
          />

          <Tooltip title="Search akun">
            <Button type="primary" shape="circle" icon={<SearchOutlined />} disabled />
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Keterangan',
      dataIndex: 'keterangan',
      render: (_: any, record: JournalEntry) => (
        <Input
          disabled
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
          disabled
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
          disabled
        />
      ),
    },
    {
      title: '',
      render: (_: any, _record: JournalEntry) => (
        <Button danger icon={<DeleteOutlined />} disabled />
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
        title={<TitleCardAdd title="Transaksi" />}
        style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
        extra={
          <div
            style={{
              display: 'flex',
              gap: 2,
            }}
          >
            <DatePicker
              prefix={<CalendarMinus />}
              style={{ width: '100%' }}
              placeholder="Tanggal Cetak"
              format={'YYYY-MM-DD'}
              onChange={(v) => setDatePrint(v)}
            />
            <ButtonFile
              text="Bukti Transaksi"
              onClick={() => generateBuktiMasukDollarPDF(dataAll, datePrint, other)}
            />
          </div>
        }
      >
        <Divider />
        <Card
          title={<TitleCardItems title="Detail Transaksi" />}
          style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
        >
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Nomor Invoice">
              {form.getFieldValue('invoiceNumber')}
            </Descriptions.Item>
            <Descriptions.Item label="Keterangan">
              {form.getFieldValue('description')}
            </Descriptions.Item>
            <Descriptions.Item label="Tanggal Masuk">
              {dayjs(form.getFieldValue('inputDate')).format('DD/MM/YYYY')}
            </Descriptions.Item>
            <Descriptions.Item label="Jumlah Pembayaran (Dollar)">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                }}
              >
                <p>
                  {' '}
                  ${globalHelpers.currencyFormatter(form.getFieldValue('amountOriginal') || 0)}
                </p>
                <p
                  style={{
                    color: 'green',
                  }}
                >
                  {globalHelpers.terbilangDollar(form.getFieldValue('amount') || 0)}
                </p>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Jumlah Pembayaran (Rupiah)" style={{ maxWidth: 200 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                }}
              >
                <p>Rp. {globalHelpers.currencyFormatter(form.getFieldValue('amount') || 0)}</p>
                <p
                  style={{
                    color: 'green',
                  }}
                >
                  {globalHelpers.terbilangRupiah(form.getFieldValue('amount') || 0)}
                </p>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Unit">{form.getFieldValue('unit')}</Descriptions.Item>
            <Descriptions.Item label="Nomor Akun">
              {form.getFieldValue('nomorAkun')}
            </Descriptions.Item>
            <Descriptions.Item label="Nomor Voucher">
              {form.getFieldValue('transactionNumber')}
            </Descriptions.Item>

            <Descriptions.Item label="Kurs">
              Rp. {globalHelpers.currencyFormatter(Number(form.getFieldValue('exchangeRate') || 0))}
            </Descriptions.Item>

            <Descriptions.Item label="Tanggal Invoice">
              {dayjs(form.getFieldValue('invoiceDate')).format('DD/MM/YYYY')}
            </Descriptions.Item>

            <Descriptions.Item label="Diterima Dari">
              {dataAll?.receivedFrom || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="Untuk">{dataAll?.purpose || '-'}</Descriptions.Item>

            <Descriptions.Item label="Catatan">
              {form.getFieldValue('description')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Card>

      <Table
        columns={columns}
        dataSource={entries}
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowKey="key"
        footer={() => (
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Button type="dashed" icon={<PlusCircleFilled />} disabled>
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
    </div>
  );
}

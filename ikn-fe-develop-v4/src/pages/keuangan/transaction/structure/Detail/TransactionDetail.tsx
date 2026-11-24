import { Card, Form, Descriptions, Flex, Table, DatePicker } from 'antd';
import { Fragment, useEffect, useState } from 'react';
import * as TransactionAxios from '@pages/keuangan/transaction/service/TransactionAxios';
import { useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import * as globalHooks from '@/hooks';
import dayjs, { Dayjs } from 'dayjs';
import { generateBuktiMasukPDF } from '@/utils/generatePdf/generateForms';
import TitleCardItems from '@/components/atoms/Cards/Items/titleCardItems';
import { ButtonFile } from '@/components/atoms/button/buttonCardGroups';
import Buttonback from '@/components/atoms/button/buttonBack';
import * as TransactionInterfaces from '@pages/keuangan/transaction/interface/TransactionInterfaces';
import type { TableColumnsType } from 'antd';
import { CalendarMinus } from '@phosphor-icons/react';
import * as TransactionOutInterfaces from '@pages/keuangan/transactionOut/interface/TransactionOutInterfaces';

export default function TransactionDetail() {
  const { id } = useParams();
  const [form] = Form.useForm();
  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
    isAll: 'Y',
  });

  const [customer, setCustomer] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    name: '',
  });
  const [dataAll, setDataAll] = useState<any>(null);
  globalHooks.useFetchOptions(unit, setUnit, TransactionAxios.fetchDataUnit, [unit.nama]);
  globalHooks.useFetchOptions(customer, setCustomer, TransactionAxios.fetchDataCustomer, [
    customer.name,
  ]);
  const [dataSourcePajak, setDataSourcePajak] = useState<TransactionInterfaces.InvoiceTax[]>([]);
  const [datePrint, setDatePrint] = useState<Dayjs | null>(null);
  const [other, setOther] = useState<TransactionOutInterfaces.CashBankTransactionDetails[] | []>(
    []
  );

  useEffect(() => {
    TransactionAxiosUse();
  }, []);

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

  const TransactionAxiosUse = async () => {
    if (id) {
      const data = await TransactionAxios.fetchDataTransactionById(id);
      form.setFieldsValue({
        invoiceNumber: data?.invoice?.invoiceNumber,
        inputDate: globalHelpers.dateFormat(data?.date),
        amount: data?.invoice?.totalAmount || 0,
        jumlahBayar: data?.amountInIDR || 0,
        description: data?.description || '-',
        invoiceDate: globalHelpers.dateFormat(data?.invoice?.invoiceDate),
        transactionNumber: data?.transactionNumber || '-',
        nomorAkun: data?.bank_account?.bankAccountNumber || '-',
      });
      setDataSourcePajak(data?.invoice?.invoiceTaxes || []);
      setOther(data?.cashBankTransactionDetails || []);
      setDataAll(data);
    }
  };
  return (
    <Card
      title="Detail Cash Bank"
      style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)' }}
      extra={
        <div
          style={{
            display: 'flex',
            gap: 4,
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
            onClick={() => generateBuktiMasukPDF(dataAll, datePrint, other)}
          />
        </div>
      }
    >
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
          <Descriptions.Item label="Nomor Voucher">
            {form.getFieldValue('transactionNumber')}
          </Descriptions.Item>
          <Descriptions.Item label="Nomor Akun">
            {form.getFieldValue('nomorAkun')}
          </Descriptions.Item>
          <Descriptions.Item label="Tangga Invoice" style={{ maxWidth: 200 }}>
            {dayjs(form.getFieldValue('invoiceDate')).format('DD/MMMM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Jumlah Total">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              <p>Rp. {globalHelpers.currencyFormatter(form.getFieldValue('jumlahBayar') || 0)}</p>
              <p
                style={{
                  color: 'green',
                }}
              >
                {globalHelpers.terbilangRupiah(form.getFieldValue('jumlahBayar') || 0)}
              </p>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="Tanggal Masuk">
            {dayjs(form.getFieldValue('date')).format('DD/MMMM/YYYY')}
          </Descriptions.Item>

          <Descriptions.Item label="Diterima Dari">
  {dataAll?.receivedFrom || '-'}
</Descriptions.Item>

<Descriptions.Item label="Untuk">
  {dataAll?.purpose || '-'}
</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card
        title={<TitleCardItems title="Daftar Pajak" />}
        style={{ boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)', marginTop: 10 }}
      >
        <Table<TransactionInterfaces.InvoiceTax>
          columns={columnsPajak}
          dataSource={dataSourcePajak}
          scroll={{ x: 'max-content' }}
        />{' '}
      </Card>

      <Card title={<TitleCardItems title="Rincian Biaya" />}>
        <Descriptions bordered column={1} size="small">
          {other?.map((item, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f7fafc'; // putih / abu-abu muda
            return (
              <Fragment key={index}>
                <Descriptions.Item
                  label={'Biaya'}
                  span={2}
                  style={{ background: bgColor, padding: '8px 16px' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        background: '#1890ff',
                        borderRadius: 10,
                        display: 'inline-block',
                      }}
                    />
                    {index + 1}
                  </span>
                </Descriptions.Item>

                <Descriptions.Item
                  label={'Kode Akun'}
                  span={2}
                  style={{ background: bgColor, padding: '8px 16px' }}
                >
                  {item.accountCode}
                </Descriptions.Item>

                <Descriptions.Item
                  label={'Nama Akun'}
                  span={2}
                  style={{ background: bgColor, padding: '8px 16px' }}
                >
                  {item.accountName}
                </Descriptions.Item>

                <Descriptions.Item
                  label={'Kredit'}
                  span={2}
                  style={{ background: bgColor, padding: '8px 16px' }}
                >
                  {globalHelpers.currencyFormatter(Number(item.credit) || 0)}
                </Descriptions.Item>

                <Descriptions.Item
                  label={'Debit'}
                  span={2}
                  style={{ background: bgColor, padding: '8px 16px' }}
                >
                  {globalHelpers.currencyFormatter(Number(item.debit) || 0)}
                </Descriptions.Item>

                <Descriptions.Item
                  label={'Keterangan'}
                  span={2}
                  style={{ background: bgColor, padding: '8px 16px' }}
                >
                  {item.keterangan}
                </Descriptions.Item>
              </Fragment>
            );
          })}
        </Descriptions>
      </Card>
      <Flex gap="small" style={{ marginTop: 10 }}>
        <Buttonback />
      </Flex>
    </Card>
  );
}

import { Card, Form, Flex, Descriptions, DatePicker } from 'antd';
import { Fragment, useEffect, useState } from 'react';
import * as TransactionOutAxios from '@pages/keuangan/transactionOut/service/TransactionOutAxios';
import { useParams } from 'react-router';
import * as globalHelpers from '@/utils/helper';
import dayjs, { Dayjs } from 'dayjs';
import TitleCardAdd from '@/components/atoms/Cards/titleCardAdd';
import Buttonback from '@/components/atoms/button/buttonBack';

import * as MasterAkunBankAxios from '@pages/master/master-akun-bank/service/MasterAkunBankAxios';
import * as MasterAkunBankInterfaces from '@pages/master/master-akun-bank/interface/MasterAkunBankInterfaces';
import { showNotification } from '@/contexts/services/notificationService';
import { generateBuktiKeluarPDF } from '@/utils/generatePdf/generateForms';
import { ButtonFile } from '@/components/atoms/button/buttonCardGroups';
import { CalendarMinus } from '@phosphor-icons/react';
import * as TransactionOutInterfaces from '@pages/keuangan/transactionOut/interface/TransactionOutInterfaces';

export default function TransactionOutDetailRawMaterial() {
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [dataAll, setDataAll] = useState([]);
  const [datePrint, setDatePrint] = useState<Dayjs | null>(null);
  const inputDate = Form.useWatch('date', form);
  const [other, setOther] = useState<TransactionOutInterfaces.CashBankTransactionDetails[] | []>(
    []
  );
  useEffect(() => {
    if (inputDate) {
      generateCodeVoucher(inputDate);
    }
  }, [inputDate]);

  const generateCodeVoucher = async (date: Date) => {
    const query: MasterAkunBankInterfaces.ParamsBankAccountTypeGenCode = {
      tanggal: date,
    };
    const data = await MasterAkunBankAxios.fetchGenCodeAkunBankPay(query);
    form.setFieldValue('transactionNumber', data.data);
  };
  useEffect(() => {
    TransactionAxiosUse();
  }, []);

  const TransactionAxiosUse = async () => {
    try {
      if (id) {
        setLoading(true);
        const data = await TransactionOutAxios.fetchDataTransactionById(id);
        setDataAll(data);
        form.setFieldsValue({
          invoiceNumber: data?.invoice?.invoiceNumber,
          inputDate: globalHelpers.dateFormat(data?.date),
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
          address: data?.address,
        });
        setOther(data?.cashBankTransactionDetails || []);
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
      showNotification('error', 'Gagal', 'Gagal get data');
    }
  };
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Card
        title={<TitleCardAdd title="Detail Transaksi" />}
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
            <ButtonFile onClick={() => generateBuktiKeluarPDF(dataAll, datePrint, other)} />
          </div>
        }
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Nomor Transaksi">
            {form.getFieldValue('transactionNumber')}
          </Descriptions.Item>

          <Descriptions.Item label="Tanggal Keluar">
            {dayjs(form.getFieldValue('inputDate')).format('DD/MMMM/YYYY')}
          </Descriptions.Item>

          <Descriptions.Item label="Jumlah Pembayaran">
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

          <Descriptions.Item label="Nama Akun" span={2}>
            {form.getFieldValue('namaAkun')}
          </Descriptions.Item>

          <Descriptions.Item label="Catatan" span={2}>
            {form.getFieldValue('description')}
          </Descriptions.Item>

          <Descriptions.Item label="Penerima" span={2}>
            {form.getFieldValue('to')}
          </Descriptions.Item>

          <Descriptions.Item label="Alamat" span={2}>
            {form.getFieldValue('address') || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<TitleCardAdd title="Rincian Biaya" />}>
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
        <Buttonback loading={loading} />
      </Flex>
    </div>
  );
}

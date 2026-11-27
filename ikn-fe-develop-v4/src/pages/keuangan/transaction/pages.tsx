import TableDragDrop from '@/components/atoms/table/TableDragDrop';
import {
  Card,
  DatePicker,
  InputNumber,
  Pagination,
  Select,
  type TableColumnsType,
  InputRef,
  TableColumnType,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Space, Popconfirm, Checkbox } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

import { MagnifyingGlass } from '@phosphor-icons/react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import Highlighter from 'react-highlight-words';
import { useNavigate } from 'react-router';
import * as TransactionAxios from '@pages/keuangan/transaction/service/TransactionAxios';

import * as globalHooks from '@/hooks';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { currencyFormatter, hasAccessButton } from '@/utils/helper';
import { ButtonDetailGroup, ButtonEditGroup } from '@/components/atoms/button/buttonTableGroups';
import * as TransactionInterfaces from '@pages/keuangan/transaction/interface/TransactionInterfaces';
import { showNotification } from '@/contexts/services/notificationService';
import { useAccess } from '@/contexts/AccessContext';
import { DynamicModal, useDynamicModal } from '@/components/DynamicModal';
import axios from 'axios';
// Extend dayjs dengan plugin
dayjs.extend(utc);
dayjs.extend(timezone);
type DataIndex = keyof TransactionInterfaces.TransactionType;

const renderInput = (
  dataIndex: string,
  setSelectedKeys: Function,
  selectedKeys: any,
  handleSearch: Function,
  searchInput: any
) => {
  const commonStyle = { marginBottom: 8, display: 'block', width: '100%' };

  const handleDateChange = (format: string) => (value: dayjs.Dayjs | null) => {
    setSelectedKeys(value ? [value.format(format)] : []);
  };

  if (dataIndex.includes('periode_month')) {
    return (
      <DatePicker
        format="MM/YYYY"
        picker="month"
        value={selectedKeys[0] ? dayjs(String(selectedKeys[0]), 'MM/YYYY') : undefined}
        onChange={handleDateChange('MM/YYYY')}
        style={commonStyle}
      />
    );
  }

  if (dataIndex.includes('date')) {
    return (
      <DatePicker
        value={selectedKeys[0] ? dayjs(String(selectedKeys[0])) : undefined}
        onChange={handleDateChange('YYYY-MM-DDTHH:mm:ss.SSSZ')}
        style={commonStyle}
      />
    );
  }

  if (dataIndex.includes('value_rkap')) {
    return (
      <InputNumber
        placeholder={`Search ${dataIndex}`}
        value={Number(selectedKeys[0]) || 0}
        onChange={(value) => setSelectedKeys(value !== undefined && value !== null ? [value] : [])}
        onPressEnter={() => handleSearch(selectedKeys as string[], confirm, dataIndex)}
        controls={false}
        style={commonStyle}
      />
    );
  }

  if (dataIndex.includes('status')) {
    return (
      <Select
        showSearch
        placeholder="Pilih status"
        optionFilterProp="label"
        value={selectedKeys[0]}
        onChange={(value) => setSelectedKeys(value ? [value] : [])}
        options={[
          { value: 'PENDING', label: 'PENDING' },
          { value: 'APPROVED', label: 'APPROVED' },
          { value: 'REJECTED', label: 'REJECTED' },
          { value: 'VERIFED', label: 'VERIFED' },
        ]}
        style={commonStyle}
      />
    );
  }

  return (
    <Input
      ref={searchInput}
      placeholder={`Search ${dataIndex}`}
      value={selectedKeys[0]}
      onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
      onPressEnter={() => handleSearch(selectedKeys as string[], confirm, dataIndex)}
      style={commonStyle}
    />
  );
};

export default function TransactionPage() {
  const navigate = useNavigate();

  const { access, user } = useAccess();
  const canToggleAction = [
    '8c6a2b36-43f2-4020-b06c-1f6ff0914b99',
    'dd54ff73-599f-4bfd-8b70-0e861ee49b30',
  ].includes(user?.id ?? '');
  const [searchText, setSearchText] = useState('');
  const [idDelete, setIdDelete] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const [postingId, setPostingId] = useState<string | null>(null);
  const [refreshData, setRefreshData] = useState(0);
  const searchInput = useRef<InputRef>(null);

  const [dataTable, setTable] = useState<{
    data: TransactionInterfaces.TransactionType[];
    page: number;
    limit: number;
    loading: boolean;
    date: dayjs.Dayjs | null;
    total: number;
    amount: number | null;
    description: string;
    transactionNumber: string;
    type: string;
    grossAmount: number | null;
    isNotEkspor: boolean;
  }>({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    date: null,
    total: 0,
    amount: null,
    description: '',
    transactionNumber: '',
    type: 'CASH_IN',
    grossAmount: null,
    isNotEkspor: true,
  });

  const { open: openModal, config, showModal, handleConfirm, handleCancel } = useDynamicModal();

  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
  });

  useEffect(() => {
    const fetch = async () => {
      setTable((prev) => ({ ...prev, loading: true }));

      const res = await TransactionAxios.fetchDataTransaction(dataTable as any);

      setTable((prev) => ({
        ...prev,
        data: res?.data.data.data,
        loading: false,
        total: res?.data.data.totalData,
      }));
    };

    fetch();
  }, [dataTable.page, dataTable.date, refreshData]);

  const dataSource: TransactionInterfaces.TransactionType[] = useMemo(
    () => dataTable.data,
    [dataTable.data]
  );

  globalHooks.useFetchOptions(unit, setUnit, TransactionAxios.fetchDataUnit, [unit.nama]);

  useEffect(() => {
    const newDdata = dataTable.data.filter((item: any) => item.id != idDelete);
    setTable((prev) => ({
      ...prev,
      page: 1,
      data: newDdata,
      total: prev.total - 1,
    }));
  }, [idDelete]);

  const handleSearch = (
    selectedKeys: string[],
    confirm: FilterDropdownProps['confirm'],
    dataIndex: DataIndex
  ) => {
    confirm();
    setTable((prev) => ({ ...prev, page: 1, [dataIndex]: selectedKeys[0] }));
  };

  const handleReset = (
    clearFilters: () => void,
    confirm: FilterDropdownProps['confirm'],
    dataIndex: string
  ) => {
    clearFilters();
    setSearchText('');
    confirm();
    setTable((prev) => ({ ...prev, [dataIndex]: null }));
  };

  const getColumnSearchProps = (
    dataIndex: DataIndex
  ): TableColumnType<TransactionInterfaces.TransactionType> => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div
        style={{
          padding: 8,
          background: 'white',
          zIndex: 99999,
          position: 'relative',
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {renderInput(dataIndex, setSelectedKeys, selectedKeys, handleSearch, searchInput)}
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys as string[], confirm, dataIndex)}
            icon={<MagnifyingGlass />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters, confirm, dataIndex)}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              confirm({ closeDropdown: false });
              setSearchText((selectedKeys as string[])[0]);
              setSearchedColumn(dataIndex);
            }}
          >
            Filter
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              close();
            }}
          >
            close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <MagnifyingGlass style={{ color: filtered ? '#1677ff' : undefined }} />
    ),
    filterDropdownProps: {
      onOpenChange(open) {
        if (open) {
          setTimeout(() => searchInput.current?.select(), 100);
        }
      },
    },
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ''}
        />
      ) : (
        text
      ),
  });

  const handleEdit = (id: string) => {
    navigate(`/transaction/edit/${id}`);
  };

  const handleDetail = (id: string) => {
    navigate(`/transaction/detail/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await TransactionAxios.delTransaction(id);
      setIdDelete(id);
      showNotification('success', 'Berhasil', 'Berhasil Delete Data');
    } catch (e: any) {
      if (axios.isAxiosError(e?.customMessage)) {
        return showModal({
          type: 'danger',
          title: 'Terjadi Kesalahan',
          description: e?.customMessage?.response?.data?.message || 'Gagal Edit Data',
          confirmText: 'Ya, Ubah',
          // onConfirm: () => console.log('updated'),
        });
      }
      showNotification('error', 'Gagal', 'Gagal Delete Data');
    }
  };

  const handleToggleAction = async (recordId: string, checked: boolean) => {
    try {
      await TransactionAxios.updateTransactionActionAccess(recordId, checked);

      setTable((prev) => ({
        ...prev,
        data: prev.data.map((item: TransactionInterfaces.TransactionType) =>
          item.id === recordId ? { ...item, isActionEnabled: checked } : item
        ),
      }));

      showNotification(
        'success',
        'Berhasil',
        checked ? 'Edit dan Delete berhasil diaktifkan.' : 'Edit dan Delete berhasil dinonaktifkan.'
      );
    } catch (error) {
      showNotification('error', 'Gagal', 'Gagal mengubah akses Edit dan Delete.');
    }
  };

  const handlePosting = async (id: string) => {
    try {
      setPostingId(id);

      await TransactionAxios.postingCashInFlow(id);

      showNotification('success', 'Berhasil', 'Jurnal transaksi berhasil dibuat kembali.');

      setRefreshData((prev) => prev + 1);
    } catch (error: any) {
      showNotification(
        'error',
        'Gagal',
        error?.response?.data?.message ||
          error?.customMessage?.response?.data?.message ||
          'Gagal melakukan posting jurnal.'
      );
    } finally {
      setPostingId(null);
    }
  };

  const baseColumns = (acc: any): TableColumnsType<TransactionInterfaces.TransactionType> => [
    {
      title: 'Nomor Transaksi',
      dataIndex: 'transactionNumber',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('transactionNumber'),
    },
    {
      title: 'Nomor Invoice',
      dataIndex: ['invoice', 'invoiceNumber'],
      width: 200,
      align: 'center',
      ...getColumnSearchProps('invoiceNumber'),
    },
    {
      title: 'Deskripsi',
      dataIndex: 'description',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('description'),
    },
    {
      title: 'Tanggal Transaksi',
      dataIndex: 'date',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('date'),
      render: (date: Date) => <span>{dayjs(date).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Jumlah Pembayaran',
      dataIndex: 'amountInIDR',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('amountInIDR'),
      render: (amountInIDR: number) => {
        return <span>Rp{currencyFormatter(amountInIDR)}</span>;
      },
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 200,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: TransactionInterfaces.TransactionType) => {
        const recordId = record.id;
        const hasJournal = (record.journalEntry?.length ?? 0) > 0;

        console.log('CHECKBOX DEBUG:', {
          recordId,
          userId: user?.id,
          canToggleAction,
        });
        const isEnabled = record.isActionEnabled === true;

        // Periksa seluruh jurnal yang terhubung dengan transaksi
        const isJournalPosted =
          record.journalEntry?.some((journal) => journal.isPosted === true) ?? false;

        // Edit dan Delete hanya aktif jika checkbox aktif
        // dan tidak ada jurnal yang sedang Posting
        const isActionDisabled = !isEnabled || isJournalPosted;

        return (
          <Space>
            {/* DETAIL */}
            <ButtonDetailGroup
              disabled={!hasAccessButton(acc, '/transaction', 'view')}
              onClick={() => handleDetail(record?.id as any)}
            />

            {/* EDIT */}
            <ButtonEditGroup
              disabled={
                !recordId || !hasAccessButton(acc, '/transaction', 'edit') || isActionDisabled
              }
              onClick={() => {
                if (recordId && !isActionDisabled) handleEdit(recordId);
              }}
            />

            {/* DELETE */}
            <Popconfirm
              title="Apakah Anda yakin ingin menghapus data ini?"
              okText="Ya"
              cancelText="Batal"
              onConfirm={() => {
                if (recordId) handleDelete(recordId);
              }}
            >
              <Button
                disabled={
                  !recordId || !hasAccessButton(acc, '/transaction', 'delete') || isActionDisabled
                }
                type="primary"
                danger
                icon={<DeleteOutlined />}
              >
                Delete
              </Button>
            </Popconfirm>

            <Popconfirm
              title="Konfirmasi Posting"
              description="Apakah Anda yakin ingin membuat kembali jurnal transaksi ini?"
              okText="Ya, Posting"
              cancelText="Batal"
              onConfirm={() => {
                if (recordId && !hasJournal) {
                  handlePosting(recordId);
                }
              }}
            >
              <Button
                type="primary"
                disabled={
                  !recordId ||
                  hasJournal ||
                  postingId !== null ||
                  !hasAccessButton(acc, '/transaction', 'edit')
                }
                loading={postingId === recordId}
              >
                Posting
              </Button>
            </Popconfirm>

            {/* CHECKBOX KHUSUS ADMIN DAN DEV */}
            {canToggleAction && recordId && (
              <Checkbox
                checked={isEnabled}
                disabled={isJournalPosted}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  if (!isJournalPosted) {
                    handleToggleAction(recordId, e.target.checked);
                  }
                }}
              >
                Aktif
              </Checkbox>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <DynamicModal
        open={openModal}
        config={config}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <TableDragDrop
        scroll={{ x: 'max-content' }} // Hindari overflow
        linkAdd={hasAccessButton(access, '/transaction', 'add') ? '/transaction/add' : ''}
        titleCard="Data Transaction"
        loading={dataTable.loading}
        baseColumns={baseColumns(access)}
        dataSource={dataSource}
        key={access as any}
      />
      <Card
        style={{
          backgroundColor: 'white',
          padding: 0,
          textAlign: 'center',
          marginTop: 10,
          boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Pagination
          showLessItems
          key={dataTable.page}
          defaultCurrent={dataTable.page}
          total={dataTable.total}
          defaultPageSize={dataTable.limit}
          showSizeChanger={false}
          showQuickJumper
          onChange={(page) => {
            setTable((prev) => ({ ...prev, page: page }));
          }}
        />
      </Card>
    </>
  );
}

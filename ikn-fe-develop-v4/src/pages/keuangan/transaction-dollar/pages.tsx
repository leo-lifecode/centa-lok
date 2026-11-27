import TableDragDrop from '@/components/atoms/table/TableDragDrop';
import { Card, Pagination, type TableColumnsType, InputRef, TableColumnType } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Popconfirm, Checkbox } from 'antd';
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
import RenderInput from './structure/Components/RenderInput';
import { useAccess } from '@/contexts/AccessContext';
// Extend dayjs dengan plugin
dayjs.extend(utc);
dayjs.extend(timezone);
type DataIndex = keyof TransactionInterfaces.TransactionType;

export default function TransactionDollarPage() {
  const navigate = useNavigate();
  const { access, user } = useAccess();

  const canToggleAction = [
    '8c6a2b36-43f2-4020-b06c-1f6ff0914b99',
    'dd54ff73-599f-4bfd-8b70-0e861ee49b30',
  ].includes(user?.id ?? '');
  const [searchText, setSearchText] = useState('');
  const [idDelete, setIdDelete] = useState('');
  const [postingId, setPostingId] = useState<string | null>(null);
  const [refreshData, setRefreshData] = useState(0);
  const [searchedColumn, setSearchedColumn] = useState('');
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
    transactionNumber: string | null;
    type: string;
    typeTransaction: string;
    grossAmount: number | null;
    invoiceNumber: string | null;
  }>({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    date: null,
    total: 0,
    amount: null,
    description: '',
    transactionNumber: null,
    type: 'CASH_IN',
    typeTransaction: 'RN_EKSPOR',
    grossAmount: null,
    invoiceNumber: null,
  });

  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
  });

  useEffect(() => {
    const fetch = async () => {
      const res = await TransactionAxios.fetchDataTransaction(dataTable as any);
      setTable((prev) => ({
        ...prev,
        data: res?.data.data.data,
        loading: false,
        total: res?.data.data.totalData,
      }));
    };
    fetch();
  }, [
    dataTable.page,
    dataTable.date,
    dataTable.transactionNumber,
    dataTable.invoiceNumber,
    dataTable.description,
    refreshData,
  ]);

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
        {RenderInput(dataIndex, setSelectedKeys, selectedKeys, handleSearch, searchInput)}
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
    navigate(`/transaction-dollar/edit/${id}`);
  };

  const handleDetail = (id: string) => {
    navigate(`/transaction-dollar/detail/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await TransactionAxios.delTransaction(id);
      setIdDelete(id);
      showNotification('success', 'Berhasil', 'Berhasil Delete Data');
    } catch (e) {
      showNotification('error', 'Gagal', 'Gagal Delete Data');
    }
  };

  const handlePosting = async (id: string) => {
    try {
      setPostingId(id);

      await TransactionAxios.postingCashInFlowDollar(id);

      showNotification('success', 'Berhasil', 'Jurnal transaksi Dollar berhasil dibuat kembali.');

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
      dataIndex: ['invoiceEkspor', 'invoiceNumber'],
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
      render: (amountInIDR: number) => {
        return <span>Rp{currencyFormatter(amountInIDR)}</span>;
      },
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 250,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: TransactionInterfaces.TransactionType) => {
        // Deklarasi variabel
        const recordId = record.id;
        const isEnabled = record.isActionEnabled === true;
        const hasJournal = (record.journalEntry?.length ?? 0) > 0;

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
              disabled={!hasAccessButton(acc, '/transaction-dollar', 'view')}
              onClick={() => handleDetail(recordId as any)}
            />

            {/* EDIT */}
            <ButtonEditGroup
              disabled={
                !recordId ||
                !hasAccessButton(acc, '/transaction-dollar', 'edit') ||
                isActionDisabled
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
                  !recordId ||
                  !hasAccessButton(acc, '/transaction-dollar', 'delete') ||
                  isActionDisabled
                }
                type="primary"
                danger
                icon={<DeleteOutlined />}
              >
                Delete
              </Button>
            </Popconfirm>

            {/* POSTING JURNAL */}
            <Popconfirm
              title="Konfirmasi Posting"
              description="Apakah Anda yakin ingin membuat kembali jurnal transaksi Dollar ini?"
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
                  !hasAccessButton(acc, '/transaction-dollar', 'edit')
                }
                loading={postingId === recordId}
              >
                Posting
              </Button>
            </Popconfirm>

            {/* CHECKBOX KHUSUS ADMIN DAN DEVELOPER */}
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
      <TableDragDrop
        scroll={{ x: 'max-content' }} // Hindari overflow
        linkAdd={
          hasAccessButton(access, '/transaction-dollar', 'add') ? '/transaction-dollar/add' : ''
        }
        titleCard="Data Transaction Dollar"
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

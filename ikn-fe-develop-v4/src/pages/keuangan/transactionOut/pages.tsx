import TableDragDrop from '@/components/atoms/table/TableDragDrop';
import { Card, Pagination, type TableColumnsType, InputRef, TableColumnType } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Popconfirm, Checkbox } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

import { MagnifyingGlass } from '@phosphor-icons/react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import Highlighter from 'react-highlight-words';
import { useNavigate } from 'react-router';
import * as TransactionOutAxios from '@pages/keuangan/transactionOut/service/TransactionOutAxios';

import * as globalHooks from '@/hooks';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { currencyFormatter, hasAccessButton } from '@/utils/helper';
import { ButtonDetailGroup, ButtonEditGroup } from '@/components/atoms/button/buttonTableGroups';
import RenderInput from './structure/Components/RenderInput';
import { showNotification } from '@/contexts/services/notificationService';
import { useAccess } from '@/contexts/AccessContext';
import { DynamicModal, useDynamicModal } from '@/components/DynamicModal';
import axios from 'axios';
dayjs.extend(utc);
dayjs.extend(timezone);
interface DataType {
  id: string;
  transactionNumber: string;
  amount: number;
  grossAmount: number;
  type: string;
  description: string;
  date: string;
  accountCode: string;
  invoiceNumber: string;
  amountInIDR: number;
  isActionEnabled?: boolean;
  journalEntry?: {
    id: string;
    isPosted: boolean;
    is_intercompany: boolean;
  }[];
}
type DataIndex = keyof DataType;
export default function TransactionOutPage() {
  const navigate = useNavigate();
  const { access, user } = useAccess();

  const canToggleAction = [
    '8c6a2b36-43f2-4020-b06c-1f6ff0914b99',
    'dd54ff73-599f-4bfd-8b70-0e861ee49b30',
  ].includes(user?.id ?? '');

  const [searchText, setSearchText] = useState('');
  const [idDelete, setIdDelete] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef<InputRef>(null);
  const [dataTable, setTable] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    total: 0,
    date: null,
    amountInIDR: null,
    description: null,
    transactionNumber: null,
    type: 'CASH_OUT',
    isMaterial: 'N',
    grossAmount: null,
  });

  const [postingId, setPostingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
  });
  const { open: openModal, config, showModal, handleConfirm, handleCancel } = useDynamicModal();

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await TransactionOutAxios.fetchDataTransaction(dataTable as any);

        const transactions = res?.data.data.data || [];

        setTable((prev) => ({
          ...prev,
          data: transactions,
          loading: false,
          total: res?.data.data.totalData,
        }));
      } catch (e) {
        showNotification('error', 'Gagal', 'Gagal Filter Data');
      }
    };

    fetch();
  }, [
    dataTable.page,
    dataTable.date,
    dataTable.transactionNumber,
    dataTable.description,
    dataTable.amountInIDR,
    refreshKey,
  ]);
  const dataSource: DataType[] = useMemo(() => dataTable.data, [dataTable.data]);

  globalHooks.useFetchOptions(unit, setUnit, TransactionOutAxios.fetchDataUnit, [unit.nama]);

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

  const getColumnSearchProps = (dataIndex: DataIndex): TableColumnType<DataType> => ({
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
    navigate(`/transaction-out/edit/${id}`);
  };

  const handleDetail = (id: string) => {
    navigate(`/transaction-out/detail/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await TransactionOutAxios.delTransaction(id);
      setIdDelete(id);
      showNotification('success', 'Berhasil', 'Berhapus Hapus Data');
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
      showNotification('error', 'Gagal', 'Gagal Hapus Data');
    }
  };

  const handlePosting = async (id: string) => {
    try {
      setPostingId(id);

      await TransactionOutAxios.postingCashOutFlow(id);

      showNotification('success', 'Berhasil', 'Jurnal Kas Keluar berhasil dibuat.');

      // Ambil ulang data agar status journalEntry diperbarui
      setRefreshKey((prev) => prev + 1);
    } catch (e: any) {
      showNotification('error', 'Gagal', 'Gagal melakukan Posting Jurnal Kas Keluar.');
    } finally {
      setPostingId(null);
    }
  };

  const handleToggleAction = async (recordId: string, checked: boolean) => {
    try {
      await TransactionOutAxios.updateTransactionActionAccess(recordId, checked);

      setTable((prev: any) => ({
        ...prev,
        data: prev.data.map((item: DataType) =>
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
  const baseColumns = (acc: any): TableColumnsType<DataType> => [
    {
      title: 'Nomor Transaksi',
      dataIndex: 'transactionNumber',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('transactionNumber'),
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
      render: (_: any, record: DataType) => <span>{dayjs(record.date).format('DD MMM YYYY')}</span>,
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
      width: 280,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: DataType) => {
        const isEnabled = record.isActionEnabled === true;

        const isJournalPosted =
          record.journalEntry?.some((journal) => journal.isPosted === true) ?? false;

        const hasActiveJournal = (record.journalEntry?.length ?? 0) > 0;

        const isActionDisabled = !isEnabled || isJournalPosted;

        return (
          <Space>
            {/* DETAIL */}
            <ButtonDetailGroup
              disabled={!hasAccessButton(acc, '/transaction-out', 'view')}
              onClick={() => handleDetail(record.id)}
            />

            {/* EDIT */}
            <ButtonEditGroup
              disabled={!hasAccessButton(acc, '/transaction-out', 'edit') || isActionDisabled}
              onClick={() => handleEdit(record.id)}
            />

            {/* DELETE */}
            <Popconfirm
              title="Apakah Anda yakin ingin menghapus data ini?"
              okText="Ya"
              cancelText="Batal"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button
                disabled={!hasAccessButton(acc, '/transaction-out', 'delete') || isActionDisabled}
                type="primary"
                danger
                icon={<DeleteOutlined />}
              >
                Delete
              </Button>
            </Popconfirm>

            <Popconfirm
              title="Konfirmasi Posting Jurnal"
              description="Apakah Anda yakin ingin melakukan posting transaksi ini ke jurnal?"
              okText="Ya"
              cancelText="Batal"
              onConfirm={() => handlePosting(record.id)}
            >
              <Button
                type="primary"
                disabled={hasActiveJournal || postingId === record.id}
                loading={postingId === record.id}
              >
                {hasActiveJournal ? 'Posting' : 'Posting!'}
              </Button>
            </Popconfirm>

            {/* CHECKBOX KHUSUS ADMIN DAN DEVELOPER */}
            {canToggleAction && (
              <Checkbox
                checked={isEnabled}
                disabled={isJournalPosted}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  if (!isJournalPosted) {
                    handleToggleAction(record.id, e.target.checked);
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
        scroll={{ x: 'max-content' }}
        linkAdd={hasAccessButton(access, '/transaction-out', 'add') ? '/transaction-out/add' : ''}
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

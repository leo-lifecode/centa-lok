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
  Button,
  Input,
  Space,
  Popconfirm,
} from 'antd';
import { showNotification } from '@/contexts/services/notificationService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
} from '@ant-design/icons';

import { MagnifyingGlass } from '@phosphor-icons/react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import Highlighter from 'react-highlight-words';
import { useNavigate } from 'react-router';
import * as BarangMentahAxios from '@pages/gudang/barang-mentah/service/BarangMentahAxios';

import * as globalHooks from '@/hooks';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/id';
import 'photoviewer/dist/photoviewer.css';
import { ButtonDetailGroup } from '@/components/atoms/button/buttonTableGroups';
import { useAccess } from '@/contexts/AccessContext';
import { hasAccessButton } from '@/utils/helper';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('id');

interface DataType {
  id: string;
  date: string;
  documentCode: string;
  documentNo: string;
  documentNumber: string;
  supplier: string | { namaRekanan?: string };
  quantity: number;
  status?: string;
}

type DataIndex = keyof DataType;

const renderInput = (
  dataIndex: string,
  setSelectedKeys: (keys: React.Key[]) => void,
  selectedKeys: React.Key[],
  handleSearch: (
    selectedKeys: string[],
    confirm: FilterDropdownProps['confirm'],
    dataIndex: DataIndex
  ) => void,
  searchInput: React.RefObject<InputRef | null>,
  confirm: FilterDropdownProps['confirm']
) => {
  const commonStyle = {
    marginBottom: 8,
    display: 'block' as const,
    width: '100%',
  };

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
        onPressEnter={() => handleSearch(selectedKeys.map(String), confirm, dataIndex as DataIndex)}
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
          { value: 'DRAFT', label: 'DRAFT' },
          { value: 'POSTED', label: 'POSTED' },
        ]}
        style={commonStyle}
      />
    );
  }

  return (
    <Input
      ref={searchInput}
      placeholder={`Search ${dataIndex}`}
      value={selectedKeys[0] as string | undefined}
      onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
      onPressEnter={() => handleSearch(selectedKeys.map(String), confirm, dataIndex as DataIndex)}
      style={commonStyle}
    />
  );
};

export default function PenerimaanBarang() {
  const navigate = useNavigate();
  const { access } = useAccess();

  const [refreshTable, setRefreshTable] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const searchInput = useRef<InputRef>(null);

  const [dataTable, setTable] = useState({
    data: [] as DataType[],
    page: 1,
    limit: 5,
    loading: false,
    date: null as string | null,
    total: 0,
    status: null as string | null,
    unit: null as string | null,
    documentCode: null as string | null,
    documentNumber: null as string | null,
    supplier: null as string | null,
  });

  const [unit, setUnit] = useState({
    data: [],
    page: 1,
    limit: 5,
    loading: false,
    nama: '',
  });

  const loadData = useCallback(async () => {
    setTable((prev) => ({ ...prev, loading: true }));

    try {
      const res = await BarangMentahAxios.fetchDataBarangMentah(dataTable as any);

      setTable((prev) => ({
        ...prev,
        data: res?.data?.data?.data ?? [],
        total: res?.data?.data?.totalData ?? 0,
        loading: false,
      }));
    } catch {
      setTable((prev) => ({ ...prev, loading: false }));
      showNotification('error', 'Gagal', 'Gagal memuat data penerimaan barang');
    }
  }, [
    dataTable.page,
    dataTable.limit,
    dataTable.date,
    dataTable.status,
    dataTable.unit,
    dataTable.documentCode,
    dataTable.documentNumber,
    dataTable.supplier,
    refreshTable,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dataSource: DataType[] = useMemo(() => dataTable.data, [dataTable.data]);

  globalHooks.useFetchOptions(unit, setUnit, BarangMentahAxios.fetchDataUnit, [unit.nama]);

  const handleSearch = (
    selectedKeys: string[],
    confirm: FilterDropdownProps['confirm'],
    dataIndex: DataIndex
  ) => {
    confirm();

    setTable((prev) => ({
      ...prev,
      page: 1,
      [dataIndex]: selectedKeys[0] || null,
    }));
  };

  const handleReset = (
    clearFilters: () => void,
    confirm: FilterDropdownProps['confirm'],
    dataIndex: string
  ) => {
    clearFilters();
    setSearchText('');
    setSearchedColumn('');
    confirm();

    setTable((prev) => ({
      ...prev,
      page: 1,
      [dataIndex]: null,
    }));
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
        {renderInput(dataIndex, setSelectedKeys, selectedKeys, handleSearch, searchInput, confirm)}

        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys.map(String), confirm, dataIndex)}
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
              setSearchText(String(selectedKeys[0] ?? ''));
              setSearchedColumn(dataIndex);
            }}
          >
            Filter
          </Button>

          <Button type="link" size="small" onClick={() => close()}>
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
          highlightStyle={{
            backgroundColor: '#ffc069',
            padding: 0,
          }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? String(text) : ''}
        />
      ) : (
        text
      ),
  });

  const handleDetail = (id: string) => {
    navigate(`/raw-material-receipt/detail/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/raw-material-receipt/edit/${id}`);
  };

  const handlePost = async (id: string) => {
    if (processingId) return;

    setProcessingId(id);

    try {
      await BarangMentahAxios.postReceiptBarangMentah(id);

      showNotification('success', 'Berhasil', 'Penerimaan barang berhasil di-posting');
      setRefreshTable((prev) => prev + 1);
    } catch (error: any) {
      console.error('POST RECEIPT ERROR:', error);
      console.error('BACKEND RESPONSE:', error?.response?.data);

      const responseData = error?.response?.data;

      const rawMessage = responseData?.message;
      const errorMessage = Array.isArray(rawMessage)
        ? rawMessage.join('\n')
        : typeof rawMessage === 'string'
          ? rawMessage
          : error?.message || 'Gagal posting penerimaan barang';

      const codes = responseData?.unmatchedCodes ?? error?.unmatchedCodes ?? [];

      const detail =
        Array.isArray(codes) && codes.length > 0
          ? `${errorMessage}\nKode barang bermasalah: ${codes.join(', ')}`
          : errorMessage;

      showNotification('error', 'Gagal', detail);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevert = async (id: string) => {
    if (processingId) return;

    setProcessingId(id);

    try {
      await BarangMentahAxios.revertReceiptBarangMentah(id);

      showNotification('success', 'Berhasil', 'Posting penerimaan barang berhasil dibatalkan');

      // Status yang dikembalikan backend akan ditampilkan ulang.
      setRefreshTable((prev) => prev + 1);
    } catch (error: any) {
      console.error('REVERT RECEIPT ERROR:', error);

      showNotification(
        'error',
        'Gagal',
        error?.response?.data?.message || 'Gagal revert penerimaan barang'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (processingId) return;

    setProcessingId(id);

    try {
      await BarangMentahAxios.delBarangMentah(id);

      showNotification('success', 'Berhasil', 'Penerimaan barang berhasil dihapus');

      // Ambil ulang data agar tabel sesuai dengan database.
      setRefreshTable((prev) => prev + 1);
    } catch (error: any) {
      console.error('DELETE RECEIPT ERROR:', error);

      showNotification(
        'error',
        'Gagal',
        error?.response?.data?.message || 'Gagal menghapus penerimaan barang'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const baseColumns = (acc: any): TableColumnsType<DataType> => [
    {
      title: 'Kode Dokumen',
      dataIndex: 'documentCode',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('documentCode'),
    },
    {
      title: 'No. Dokumen',
      dataIndex: 'documentNo',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('documentNumber'),
    },
    {
      title: 'Tanggal Penerimaan',
      dataIndex: 'date',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('date'),
      render: (_: any, record: DataType) => <span>{dayjs(record.date).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Supplier',
      dataIndex: ['supplier', 'namaRekanan'],
      width: 200,
      align: 'center',
      ...getColumnSearchProps('supplier'),
    },
    {
      title: 'Aksi',
      dataIndex: 'action',
      width: 360,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: DataType) => {
        const status = String(record?.status ?? '')
          .trim()
          .toUpperCase();

        const isDraft = status === 'DRAFT';
        const isPosted = status === 'POSTED';
        const isReverted = status === 'REVERTED';
        const isProcessing = processingId === record.id;
        const isAnyProcessing = processingId !== null;

        const canView = hasAccessButton(acc, '/raw-material-receipt', 'view');
        const canEdit = hasAccessButton(acc, '/raw-material-receipt', 'edit');
        const canDelete = hasAccessButton(acc, '/raw-material-receipt', 'delete');

        const canEditOrDelete = isDraft || isReverted;
        const canPost = isDraft || isReverted;
        const canRevert = isPosted;

        return (
          <Space wrap>
            {/* DETAIL: tersedia untuk semua status sesuai hak akses */}
            <ButtonDetailGroup disabled={!canView} onClick={() => handleDetail(record.id)} />

            {/* EDIT: DRAFT dan REVERTED */}
            <Button
              type="primary"
              style={{
                backgroundColor: '#16a34a',
                borderColor: '#16a34a',
                color: '#ffffff',
              }}
              icon={<EditOutlined />}
              disabled={!canEditOrDelete || !canEdit || isAnyProcessing}
              onClick={() => handleEdit(record.id)}
            >
              Edit
            </Button>

            {/* DELETE: DRAFT dan REVERTED, dengan konfirmasi */}
            <Popconfirm
              title="Hapus penerimaan barang mentah?"
              description={`Dokumen ${status} ini akan dihapus. Lanjutkan?`}
              okText="Ya, Hapus"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record.id)}
              disabled={!canEditOrDelete || !canDelete || isAnyProcessing}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={!canEditOrDelete || !canDelete || isAnyProcessing}
              >
                Delete
              </Button>
            </Popconfirm>

            {/* POSTING: DRAFT dan REVERTED, dengan konfirmasi */}
            <Popconfirm
              title="Posting penerimaan barang?"
              description="Stok dan jurnal akan diproses setelah Posting."
              okText="Ya, Posting"
              cancelText="Batal"
              onConfirm={() => handlePost(record.id)}
              disabled={!canPost || !canEdit || isAnyProcessing}
            >
              <Button
                type="primary"
                style={{
                  backgroundColor: '#1677ff',
                  borderColor: '#1677ff',
                  color: '#ffffff',
                }}
                icon={<CheckCircleOutlined />}
                disabled={!canPost || !canEdit || isAnyProcessing}
              >
                {isProcessing ? 'Memproses...' : 'Posting'}
              </Button>
            </Popconfirm>

            {/* REVERT: hanya POSTED, dengan konfirmasi */}
            <Popconfirm
              title="Revert penerimaan barang?"
              description="Posting akan dibatalkan. Jika berhasil, status menjadi REVERTED."
              okText="Ya, Revert"
              cancelText="Batal"
              onConfirm={() => handleRevert(record.id)}
              disabled={!canRevert || !canEdit || isAnyProcessing}
            >
              <Button
                icon={<RollbackOutlined />}
                disabled={!canRevert || !canEdit || isAnyProcessing}
              >
                {isProcessing ? 'Memproses...' : 'Revert'}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <TableDragDrop
        scroll={{ x: 'max-content' }}
        linkAdd={
          hasAccessButton(access, '/raw-material-receipt', 'add') ? '/raw-material-receipt/add' : ''
        }
        titleCard="Data Barang Mentah"
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
          current={dataTable.page}
          total={dataTable.total}
          pageSize={dataTable.limit}
          showSizeChanger={false}
          showQuickJumper
          onChange={(page) => {
            setTable((prev) => ({
              ...prev,
              page,
            }));
          }}
        />
      </Card>
    </>
  );
}

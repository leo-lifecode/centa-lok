import React, { useEffect, useRef, useState } from 'react';
import {
  Tag,
  Card,
  Pagination,
  Space,
  DatePicker,
  InputNumber,
  Select,
  Input,
  InputRef,
  Button,
  TableColumnType,
  Popconfirm,
} from 'antd';
import TableDragDrop from '@/components/atoms/table/TableDragDrop';
import NotificationBell from '@/components/atoms/Notifications/NotificationBell';
import { ButtonDetailGroup, ButtonEditGroup } from '@/components/atoms/button/buttonTableGroups';
import { useNavigate } from 'react-router';
import * as JurnalKhususAxios from '@pages/keuangan/jurnal/jurnal-khusus/service/JurnalKhususAxios';
import { showNotification } from '@/contexts/services/notificationService';
import dayjs, { Dayjs } from 'dayjs';
import { currencyFormatter } from '@/utils/helper';
import * as helperGlobal from '@/utils/helper';
import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react';
import Highlighter from 'react-highlight-words';
import * as JurnalUmumAxios from '@pages/keuangan/jurnal/jurnal-umum/service/JurnalUmumAxios';
import { FilterDropdownProps } from 'antd/es/table/interface';
import { DeleteOutlined } from '@ant-design/icons';
import { useAccess } from '@/contexts/AccessContext';
const monthFormat = 'YYYY-MM';

export interface JournalData {
  id: string;
  spbId: string;
  numberJurnal: string;
  module: string;
  transactionId: string | null;
  description: string;
  referenceNumber: string;
  createdBy: string;
  date: string;
  unit: string | null;
  deletedAt: string | null;
  journalId: string | null;
  createdAt: string;
  typeJournalEntry: string | null;
  purchaseOrderTaxId: string | null;
  sPBTaxId: string | null;
  status: boolean;
  isPosted: boolean;
  isRevert: 'Y' | 'N';
}

interface DataTable {
  loading: boolean;
  data: JournalData[];
  page: number;
  limit: number;
  total: number;
  createdBy: string;
  postCount: number;
  IsNottypeJournalEntry?: string;
  typeJournalEntry: string;
  date: string;
  totalBalance: number | null;
  totalBalanceUs: number | null;
  status: boolean;
  periode: Dayjs | string;
  referenceNumber: string;
  description: string;
  numberJurnal: string;
}
type DataIndex = keyof DataTable;

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

  if (dataIndex.includes('date')) {
    return (
      <DatePicker
        value={selectedKeys[0] ? dayjs(String(selectedKeys[0])) : undefined}
        onChange={handleDateChange('YYYY-MM-DDTHH:mm:ss.SSSZ')}
        style={commonStyle}
      />
    );
  }

  if (dataIndex.includes('totalBalance')) {
    return (
      <InputNumber
        formatter={helperGlobal.formatNumber2Digits}
        parser={helperGlobal.parseNumber2Digits}
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
          { value: 'DRAFT', label: 'DRAFT' },
          { value: 'CONFIRMED', label: 'CONFIRM' },
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

function JournalTable({
  data,
  page,
  limit,
  total,
  postCount,
  setDataTable,
  fetchData,
}: {
  data: JournalData[];
  page: number;
  limit: number;
  total: number;
  postCount?: number;
  setDataTable: React.Dispatch<React.SetStateAction<Omit<DataTable, 'setDataTable'>>>;
  fetchData: Function;
}) {
  const navigate = useNavigate();
  const { access } = useAccess();
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef<InputRef>(null);

  const handleDetail = (id: string) => {
    navigate(`/jurnal-khusus-dollar/detail/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/jurnal-khusus-dollar/edit/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await JurnalUmumAxios.delJournalEAntry(id as any);
      fetchData();
      showNotification('success', 'Berhasil', 'Hapus data Berhasil');
    } catch (e) {
      showNotification('error', 'Gagal', 'Hapus Data Gagal');
    }
  };

  const handleRvert = (id: string) => {
    navigate(`/jurnal-khusus-dollar/revert/${id}`);
  };

  const handleSearch = (
    selectedKeys: string[],
    confirm: FilterDropdownProps['confirm'],
    dataIndex: DataIndex
  ) => {
    confirm();
    setDataTable((prev) => ({ ...prev, page: 1, [dataIndex]: selectedKeys[0] }));
  };

  const handleReset = (
    clearFilters: () => void,
    confirm: FilterDropdownProps['confirm'],
    dataIndex: string
  ) => {
    clearFilters();
    setSearchText('');
    confirm();
    setDataTable((prev) => ({ ...prev, [dataIndex]: null }));
  };

  const getColumnSearchProps = (dataIndex: DataIndex): TableColumnType<DataTable> => ({
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

  const columns = (acc: any) => [
    {
      title: 'Nomor Jurnal',
      dataIndex: 'numberJurnal',
      key: 'numberJurnal',
      ...getColumnSearchProps('numberJurnal'),
    },
    {
      title: 'Referensi',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      ...getColumnSearchProps('referenceNumber'),
    },
    {
      title: 'Deskripsi',
      dataIndex: 'description',
      key: 'description',
      ...getColumnSearchProps('description'),
    },

    {
      title: 'Dibuat Oleh',
      dataIndex: 'createdBy',
      key: 'createdBy',
    },
    {
      title: 'Tanggal',
      dataIndex: 'date',
      key: 'date',
      ...getColumnSearchProps('date'),
      render: (date: string) => dayjs(date).format('DD-MM-YYYY'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      ...getColumnSearchProps('status'),
      render: (status: string) => <Tag color={status === 'DRAFT' ? 'red' : 'green'}>{status}</Tag>,
    },
    {
      title: 'Balance Dollar',
      dataIndex: 'totalBalanceUs',
      key: 'status',
      ...getColumnSearchProps('totalBalanceUs'),
      render: (totalBalanceUs: number) => currencyFormatter(Number(totalBalanceUs) || 0),
    },

    {
      title: 'Balance RP',
      dataIndex: 'totalBalance',
      key: 'status',
      ...getColumnSearchProps('totalBalance'),
      render: (totalBalance: number) => currencyFormatter(Number(totalBalance) || 0),
    },
    {
      title: 'Aksi',
      dataIndex: 'action',
      width: 200,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: JournalData) => (
        <Space>
          <ButtonDetailGroup
            disabled={!helperGlobal.hasAccessButton(acc, '/jurnal-khusus-dollar', 'view')}
            onClick={() => handleDetail(record.id)}
          />
          <ButtonEditGroup
            disabled={
              record.isPosted ||
              record.isRevert === 'Y' ||
              !helperGlobal.hasAccessButton(acc, '/jurnal-khusus-dollar', 'edit')
            }
            text="Penyesuian"
            onClick={() => handleEdit(record.id)}
          />
          <Popconfirm
            title="Apakah Anda yakin ingin menghapus data ini?"
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleDelete(record.id)} // Fungsi delete
          >
            <Button
              disabled={
                record.isRevert === 'Y' ||
                !helperGlobal.hasAccessButton(acc, '/jurnal-khusus-dollar', 'delete')
              }
              type="primary"
              danger
              icon={<DeleteOutlined />}
            >
              Hapus
            </Button>
          </Popconfirm>

          <Button
            disabled={!record.isPosted || record.isRevert === 'Y'}
            onClick={() => handleRvert(record.id)}
            type="primary"
            danger
            style={{
              background: 'orange',
            }}
            icon={<ArrowLeft />}
          >
            Revert
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <TableDragDrop
        scroll={{ x: 'max-content' }} // Hindari overflow
        titleCard="Data Jurnal Detail"
        baseColumns={columns(access)}
        dataSource={data}
        key={access as any}
        loading={false}
        Notifikasi={<NotificationBell count={postCount} />}
        rowClassName={(record: any) => (!record.addjust ? 'table-row-adjust-false' : '')}
        Other={
          <DatePicker
            defaultValue={dayjs()}
            format={monthFormat}
            picker="month"
            onChange={(value) => setDataTable((prev) => ({ ...prev, periode: value }))}
          />
        }
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
          key={page}
          defaultCurrent={page}
          total={total}
          defaultPageSize={limit}
          showSizeChanger={false}
          showQuickJumper
          onChange={(page) => {
            setDataTable((prev) => ({ ...prev, page: page }));
          }}
        />
      </Card>
    </div>
  );
}

const JurnalHeader = () => {
  const [dataTable, setDataTable] = useState<DataTable>({
    loading: false,
    data: [],
    page: 1,
    limit: 10,
    total: 0,
    createdBy: 'System',
    typeJournalEntry: 'RN_EKSPOR',
    postCount: 0,
    date: '',
    totalBalance: null,
    totalBalanceUs: null,
    status: false,
    periode: dayjs().format('YYYY-MM'),
    referenceNumber: '',
    description: '',
    numberJurnal: '',
  });
  useEffect(() => {
    fetchData();
  }, [
    dataTable.status,
    dataTable.date,
    dataTable.totalBalance,
    dataTable.totalBalanceUs,
    dataTable.periode,
    dataTable.page,
    dataTable.referenceNumber,
    dataTable.description,
    dataTable.numberJurnal,
  ]);

  const fetchData = async () => {
    try {
      setDataTable((prev) => ({ ...prev, loading: true }));
      const data = await JurnalKhususAxios.fetchJurnalKhususHeader(dataTable);
      setDataTable((prev) => ({
        ...prev,
        data: data.data || [],
        loading: false,
        total: data.totalData,
        postCount: data?.postCount,
      }));
    } catch (e) {
      showNotification('error', 'Gagal', 'Terjadi Kesalahan');
    }
  };

  return (
    <JournalTable
      total={dataTable.total}
      limit={dataTable.limit}
      page={dataTable.page}
      data={dataTable.data}
      postCount={dataTable.postCount}
      setDataTable={setDataTable}
      fetchData={fetchData}
    />
  );
};

export default JurnalHeader;

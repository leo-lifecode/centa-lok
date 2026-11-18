import {
  Button,
  Input,
  Modal,
  Space,
  Table,
  type TableColumnsType,
  InputRef,
  TableColumnType,
  Card,
  Pagination,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

import { MagnifyingGlass } from '@phosphor-icons/react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import Highlighter from 'react-highlight-words';
import { DatePicker, InputNumber, Select } from 'antd';

import * as CrossChekPajakAxios from '@pages/keuangan/cross-chek-pajak/service/CrossChekPajakAxios';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
// Extend dayjs dengan plugin
dayjs.extend(utc);
dayjs.extend(timezone);

interface DataType {
  id: string;
  total: number;
  limit: number;
  page: number;
  taxType: string;
  taxValue: number | null;
  taxAmount: number | null;
}
type DataIndex = keyof DataType;

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

export default function ModalCrossChekPajak({
  setOpen,
  open,
  handleRowDoubleClick,
}: Readonly<{
  setOpen: Function;
  open: boolean;
  handleRowDoubleClick: Function;
}>) {
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef<InputRef>(null);
  const [dataTable, setTable] = useState({
    data: [],
    page: 1,
    limit: 5,
    total: 0,
    loading: false,
    taxType: '',
    taxValue: 0,
  });

  useEffect(() => {
    const fetch = async () => {
      const res = await CrossChekPajakAxios.fetchDataPajak(dataTable);
      setTable((prev) => ({
        ...prev,
        data: res?.data.data.data,
        loading: false,
        total: res?.data.data.totalData,
      }));
    };
    fetch();
  }, [dataTable.page, dataTable.total, dataTable.taxType, dataTable.taxValue]);

  const dataSource: DataType[] = useMemo(() => dataTable.data, [dataTable.data]);

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

  const baseColumns: TableColumnsType<DataType> = [
    {
      title: 'Tipe Pajak',
      dataIndex: 'taxType',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('taxType'),
    },
    {
      title: 'Nilai Pajak',
      dataIndex: 'taxValue',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('taxValue'),
    },
  ];
  const handleTableChange = (_pagination: any, _filters: any, sorter: any) => {
    const sortField = sorter.field;
    const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
    setTable((prev) => ({ ...prev, sortBy: sortField, sortOrder: sortOrder }));
  };

  return (
    <Modal
      title={<p>Pilih Pajak</p>}
      loading={dataTable.loading}
      open={open}
      width={{
        xs: '90%',
        sm: '80%',
        md: '70%',
        lg: '60%',
        xl: '50%',
        xxl: '40%',
      }}
      onCancel={() => setOpen(false)}
      footer={[
        <Button key="cancel" onClick={() => setOpen(false)}>
          Cancel
        </Button>,
      ]}
    >
      <Table<DataType>
        rowKey="key"
        bordered={true}
        scroll={{ x: 'max-content' }} // Hindari overflow
        columns={baseColumns}
        dataSource={dataSource}
        loading={dataTable.loading}
        onChange={handleTableChange}
        pagination={false}
        rowClassName={(_, index) => {
          return index % 2 === 0 ? 'table-row-light' : 'table-row-dark';
        }}
        onRow={(record) => {
          return {
            onDoubleClick: () => handleRowDoubleClick(record),
          };
        }}
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
    </Modal>
  );
}

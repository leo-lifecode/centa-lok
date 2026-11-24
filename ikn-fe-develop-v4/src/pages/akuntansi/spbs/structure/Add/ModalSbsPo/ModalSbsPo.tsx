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
  InputNumber,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EnvelopeOpen, MagnifyingGlass } from '@phosphor-icons/react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import Highlighter from 'react-highlight-words';
import { DatePicker, Select } from 'antd';
import * as DeliveryOrderPraAxios from '@pages/marketing/delivery-order-pra/service/DeliveryOrderPraAxios';
import * as globalHelpers from '@/utils/helper';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { currencyFormatter } from '@/utils/helper';
import * as SpbsInterfaces from 'pages/akuntansi/spbs/interface/SpbsInterfaces';
// Extend dayjs dengan plugin
dayjs.extend(utc);
dayjs.extend(timezone);

type DataIndex = keyof SpbsInterfaces.PurchaseOrderType;

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

  if (dataIndex.includes('typeSalesDelivery')) {
    return (
      <Select
        showSearch
        placeholder="Pilih Type"
        optionFilterProp="label"
        value={selectedKeys[0]}
        onChange={(value) => setSelectedKeys(value ? [value] : [])}
        options={[
          { value: 'RA', label: 'RA' },
          { value: 'RN', label: 'RN' },
          { value: 'RN_EKSPOR', label: 'RN_EKSPOR' },
        ]}
        style={commonStyle}
      />
    );
  }

  if (dataIndex.includes('subtotalAmount')) {
    return (
      <InputNumber
        controls={false}
        formatter={globalHelpers.formatter}
        parser={globalHelpers.parser}
        placeholder="Total Amount"
        onChange={(e) => setSelectedKeys(e ? [e] : [])}
        onPressEnter={() => handleSearch(selectedKeys as string[], confirm, dataIndex)}
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

export default function ModalSpbsPo({
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
    loading: false,
    date: null,
    total: 0,
    status: null,
    unit: null,
    orderNumber: null,
    selectionStatus: 'NOT_SELECTED',
    typeSalesDelivery: null,
    description: null,
    franco: null,
    subtotalAmount: null,
  });

  useEffect(() => {
    const fetch = async () => {
      const res = await DeliveryOrderPraAxios.fetchDataDeliveryOrderPra(dataTable);
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
    dataTable.unit,
    dataTable.orderNumber,
    dataTable.typeSalesDelivery,
    dataTable.description,
    dataTable.date,
    dataTable.franco,
    dataTable.subtotalAmount,
  ]);

  const dataSource: SpbsInterfaces.SpbsType[] = useMemo(() => dataTable.data, [dataTable.data]);

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
  ): TableColumnType<SpbsInterfaces.SpbsType> => ({
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

  const baseColumns: TableColumnsType<SpbsInterfaces.SpbsType> = [
    {
      title: 'Nomor Pesanan',
      dataIndex: ['purchaseOrder', 'orderNumber'],
      width: 200,
      align: 'center',
      ...getColumnSearchProps('orderNumber'),
    },
    {
      title: 'Type',
      dataIndex: 'typeSalesDelivery',
      width: 200,
      align: 'center',
      ...getColumnSearchProps('typeSalesDelivery'),
    },
    {
      title: 'Deskripsi',
      dataIndex: ['purchaseOrder', 'description'],
      width: 200,
      align: 'center',
      ...getColumnSearchProps('description'),
    },
    {
      title: 'Tanggal Pembuatan',
      dataIndex: ['purchaseOrder', 'date'],
      width: 200,
      align: 'center',
      ...getColumnSearchProps('date'),
      render: (date: Date) => <span>{dayjs(date).format('DD MMM YYYY')}</span>,
    },

    {
      title: 'Franco',
      dataIndex: ['purchaseOrder', 'franco'],
      width: 200,
      align: 'center',
      ...getColumnSearchProps('franco'),
    },
    {
      title: 'Harga',
      dataIndex: ['purchaseOrder', 'subtotalAmount'],
      width: 200,
      align: 'center',
      ...getColumnSearchProps('subtotalAmount'),
      render: (subtotalAmount: number, record: any) => {
        const harga =
          record.typeSalesDelivery === 'RA'
            ? Number(record.totalAmount ?? 0)
            : Number(subtotalAmount ?? 0);

        return (
          <span>
            {record.typeSalesDelivery === 'RN_EKSPOR' ? '$' : 'Rp'}
            {currencyFormatter(harga)}
          </span>
        );
      },
    },
  ];
  const handleTableChange = (_pagination: any, _filters: any, sorter: any) => {
    const sortField = sorter.field;
    const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
    setTable((prev) => ({ ...prev, sortBy: sortField, sortOrder: sortOrder }));
  };

  return (
    <Modal
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <EnvelopeOpen size={20} />
          <p>Pilih Pesanan</p>
        </div>
      }
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
      <Table<SpbsInterfaces.SpbsType>
        rowKey="key"
        bordered={true}
        scroll={{ x: 'max-content' }} // Hindari overflow
        columns={baseColumns}
        dataSource={dataSource}
        loading={dataTable.loading}
        onChange={handleTableChange}
        pagination={false}
        onRow={(record) => {
          return {
            onDoubleClick: () => handleRowDoubleClick(record),
            style: { cursor: 'pointer' },
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

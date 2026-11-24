import React from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import JurnalDetail from './structure/Components/Tabs/JurnalDetail';
import JurnalHeader from './structure/Components/Tabs/JurnalHeader';

const onChange = (key: string) => {
  console.log(key);
};

const items: TabsProps['items'] = [
  {
    key: '1',
    label: 'Jurnal Header',
    children: <JurnalHeader />,
  },
  {
    key: '2',
    label: 'Jurnal Detail',
    children: <JurnalDetail />,
  },
];

const JurnalKhusuPage: React.FC = () => (
  <Tabs defaultActiveKey="1" items={items} onChange={onChange} />
);

export default JurnalKhusuPage;

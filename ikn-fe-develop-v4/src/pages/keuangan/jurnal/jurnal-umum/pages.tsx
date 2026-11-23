import React from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import JurnalDetail from '@pages/keuangan/jurnal/jurnal-umum/structture/Components/Tabs/JurnalDetail';
import JurnalHeader from '@pages/keuangan/jurnal/jurnal-umum/structture/Components/Tabs/JurnalHeader';

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

const JurnalUmumPage: React.FC = () => (
  <Tabs defaultActiveKey="1" items={items} onChange={onChange} />
);

export default JurnalUmumPage;

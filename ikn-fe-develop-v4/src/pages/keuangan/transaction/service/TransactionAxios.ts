import { filterAndRemoveKeys, ThrowError } from '@/utils/helper';
import dayjs from 'dayjs';
import api from '@/api/axiosInstance';
import * as TransactionInterfaces from '@pages/keuangan/transaction/interface/TransactionInterfaces';

export const fetchGenCodeTransaction = async () => {
  try {
    const result = await api.get(`/api/v1/master/generate-code/transaction`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const posTransaction = async (data: TransactionInterfaces.TransactionType) => {
  try {
    const result = await api.post(`/api/v1/keuangan/transaction`, data);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const postingCashInFlow = async (id: string) => {
  try {
    const result = await api.post(
      `/api/v1/keuangan/transaction/cash-in-flow/${id}/posting`
    );

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const postingCashInFlowDollar = async (id: string) => {
  try {
    const result = await api.post(
      `/api/v1/keuangan/transaction/dollar/cash-in-flow/${id}/posting`
    );

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};


export const updateTransaction = async (
  id: string,
  data: TransactionInterfaces.TransactionType
) => {
  try {
    const result = await api.patch(`/api/v1/keuangan/transaction/${id}`, data);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const updateTransactionActionAccess = async (id: string, isActionEnabled: boolean) => {
  try {
    const result = await api.patch(`/api/v1/keuangan/transaction/${id}/action-access`, {
      isActionEnabled,
    });

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const fetchDataTransaction = async (
  params: Omit<TransactionInterfaces.TransactionType, 'data' | 'total'>
) => {
  const removeKeys = ['data', 'total']; // Properti yang ingin dihapus
  params = {
    ...params,
    date: params?.date ? dayjs(params?.date).format('YYYY-MM-DD') : '',
  };
  const fixObjParams = filterAndRemoveKeys(params, removeKeys);
  const queryString = new URLSearchParams(fixObjParams as Record<string, string>).toString();
  try {
    const result = await api.get(`/api/v1/keuangan/transaction?${queryString}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const fetchDataTransactionById = async (id: string) => {
  try {
    const result = await api.get(`/api/v1/keuangan/transaction/${id}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const delTransaction = async (id: string) => {
  try {
    const result = await api.delete(`/api/v1/keuangan/transaction/${id}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const fetchDataUnit = async (params: Record<string, string>) => {
  const removeKeys = ['data', 'total']; // Properti yang ingin dihapus
  const fixObjParams = filterAndRemoveKeys(params, removeKeys);
  const queryString = new URLSearchParams(fixObjParams as Record<string, string>).toString();
  try {
    const result = await api.get(`/api/v1/master/unit?${queryString}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const fetchDataSatuan = async (params: Record<string, string>) => {
  const removeKeys = ['data', 'total']; // Properti yang ingin dihapus
  const fixObjParams = filterAndRemoveKeys(params, removeKeys);
  const queryString = new URLSearchParams(fixObjParams as Record<string, string>).toString();
  try {
    const result = await api.get(`/api/v1/master/satuan?${queryString}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const fetchGenCodePo = async () => {
  try {
    const result = await api.get(`/api/v1/master/generate-code/po`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

export const fetchDataCustomer = async (params: Record<string, string>) => {
  const removeKeys = ['data', 'total']; // Properti yang ingin dihapus
  const fixObjParams = filterAndRemoveKeys(params, removeKeys);
  const queryString = new URLSearchParams(fixObjParams as Record<string, string>).toString();
  try {
    const result = await api.get(`/api/v1/master/customer?${queryString}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result;
  } catch (e) {
    ThrowError(e);
  }
};

export const fetchDataInvoice = async (params: Record<string, string>) => {
  const removeKeys = ['data', 'total']; // Properti yang ingin dihapus
  const fixObjParams = filterAndRemoveKeys(params, removeKeys);
  const queryString = new URLSearchParams(fixObjParams as Record<string, string>).toString();
  try {
    const result = await api.get(`/api/v1/marketing/invoice?${queryString}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result;
  } catch (e) {
    ThrowError(e);
  }
};

interface ParamsTypeBankAccount {
  code: string;
}
export const fetchDataBankAccount = async (params: ParamsTypeBankAccount) => {
  const removeKeys = ['data', 'total']; // Properti yang ingin dihapus

  const fixObjParams = filterAndRemoveKeys(params, removeKeys);
  const queryString = new URLSearchParams(fixObjParams as Record<string, string>).toString();
  try {
    const result = await api.get(`/api/v1/keuangan/bank-account?${queryString}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result;
  } catch (e: unknown) {
    ThrowError(e);
  }
};

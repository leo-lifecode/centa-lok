import { filterAndRemoveKeys, ThrowError } from '@/utils/helper';
import dayjs from 'dayjs';
import api from '@/api/axiosInstance';
import * as TransactionOutInterfaces from '@pages/keuangan/transactionOutRawMaterial/interface/TransactionOutInterfaces';

export const fetchGenCodeTransaction = async () => {
  try {
    const result = await api.get(`/api/v1/master/generate-code/transaction`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const posTransactionOut = async (data: TransactionOutInterfaces.TransactionOutType) => {
  try {
    const result = await api.post(`/api/v1/keuangan/transaction/cash-out-flow-raw-material`, data);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

/**
 * UPDATE transaksi Cash Out Raw Material.
 * Endpoint khusus Raw Material, bukan endpoint Cash Out biasa.
 */
export const updateCashOutFlowRawMaterial = async (
  id: string,
  data: TransactionOutInterfaces.UpdateCashOutRawMaterialPayload
) => {
  try {
    const result = await api.patch(
      `/api/v1/keuangan/transaction/cash-out-flow-raw-material/${id}`,
      data
    );

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

/**
 * UPDATE transaksi Cash Out biasa.
 * Tetap dipertahankan agar tidak mengganggu modul Cash Out lainnya.
 */
export const updateTransaction = async (
  id: string,
  data: TransactionOutInterfaces.TransactionOutType
) => {
  try {
    const result = await api.patch(`/api/v1/keuangan/transaction/cash-out/${id}`, data);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

interface ParamsType {
  page: number;
  limit: number;
  date?: string | null;
  description?: string | null;
  unit?: string | null;
  periode_month?: string | null;
  status?: string | null;
  value_rkap: string | null;
}

export const fetchDataTransaction = async (params: TransactionOutInterfaces.TransactionOutType) => {
  const removeKeys = ['data', 'total'];

  const fixedParams = {
    ...params,
    date: params.date ? dayjs(params.date).format('YYYY-MM-DD') : '',
  };

  const fixObjParams = filterAndRemoveKeys(fixedParams, removeKeys);

  const queryString = new URLSearchParams(fixObjParams as any).toString();

  try {
    const result = await api.get(`/api/v1/keuangan/transaction?${queryString}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result;
  } catch (e: any) {
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
  } catch (e: any) {
    ThrowError(e);
  }
};

export const delTransaction = async (id: string) => {
  try {
    const result = await api.delete(`/api/v1/marketing/invoice/${id}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const delCashOutFlowRawMaterial = async (id: string) => {
  try {
    const result = await api.delete(
      `/api/v1/keuangan/transaction/cash-out-flow-raw-material/${id}`
    );

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const fetchDataUnit = async (params: ParamsType) => {
  const removeKeys = ['data', 'total'];

  const fixObjParams = filterAndRemoveKeys(params, removeKeys);

  const queryString = new URLSearchParams(fixObjParams as any).toString();

  try {
    const result = await api.get(`/api/v1/master/unit?${queryString}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const fetchDataSatuan = async (params: ParamsType) => {
  const removeKeys = ['data', 'total'];

  const fixObjParams = filterAndRemoveKeys(params, removeKeys);

  const queryString = new URLSearchParams(fixObjParams as any).toString();

  try {
    const result = await api.get(`/api/v1/master/satuan?${queryString}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result;
  } catch (e: any) {
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
  } catch (e: any) {
    ThrowError(e);
  }
};

export const fetchDataCustomer = async (params: ParamsType) => {
  const removeKeys = ['data', 'total'];

  const fixObjParams = filterAndRemoveKeys(params, removeKeys);

  const queryString = new URLSearchParams(fixObjParams as any).toString();

  try {
    const result = await api.get(`/api/v1/master/customer?${queryString}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const fetchDataInvoice = async (params: ParamsType) => {
  const removeKeys = ['data', 'total'];

  const fixObjParams = filterAndRemoveKeys(params, removeKeys);

  const queryString = new URLSearchParams(fixObjParams as any).toString();

  try {
    const result = await api.get(`/api/v1/marketing/invoice?${queryString}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result;
  } catch (e: any) {
    ThrowError(e);
  }
};

interface ParamsTypeBankAccount {
  code: string;
}

export const fetchDataBankAccount = async (params: ParamsTypeBankAccount) => {
  const removeKeys = ['data', 'total'];

  const fixObjParams = filterAndRemoveKeys(params, removeKeys);

  const queryString = new URLSearchParams(fixObjParams as any).toString();

  try {
    const result = await api.get(`/api/v1/keuangan/bank-account?${queryString}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result;
  } catch (e: any) {
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
  } catch (e: any) {
    ThrowError(e);
  }
};

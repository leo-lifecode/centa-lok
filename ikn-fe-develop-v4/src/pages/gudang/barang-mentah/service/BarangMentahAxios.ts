import {
  DataType,
  UpdateBarangMentahPayload,
} from '@/pages/gudang/barang-mentah/interface/BarangMentahInterfaces';

import { filterAndRemoveKeys, ThrowError } from '@/utils/helper';
import dayjs from 'dayjs';
import api from '@/api/axiosInstance';

export const fetchGenCodeBarangMentah = async () => {
  try {
    const result = await api.get(`/api/v1/master/generate-code/barang-jadi`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const posBarangMentah = async (data: DataType) => {
  try {
    const result = await api.post(`/api/v1/gudang/barang-mentah`, data);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const updateBarangMentah = async (id: string, data: UpdateBarangMentahPayload) => {
  try {
    const result = await api.patch(`/api/v1/gudang/barang-mentah/${id}`, data);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan saat mengubah penerimaan barang mentah');
    }

    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
    throw e;
  }
};

interface ParamsType {
  page: number;
  limit: number;
  date?: string | null;
  documentCode?: string | null;
  documentNo?: string | null;
  supplier?: string | null;
  description?: string | null;
  unit?: string | null;
  periode_month?: string | null;
  status?: string | null;
  value_rkap: string | null;
  [key: string]: any;
}

export const fetchDataBarangMentah = async (params: ParamsType) => {
  const removeKeys = ['data', 'total'];
  params = {
    ...params,
    date: params.date ? dayjs(params.date).format('YYYY-MM-DD') : '',
  };
  const fixObjParams = filterAndRemoveKeys(params, removeKeys);
  const queryString = new URLSearchParams(fixObjParams as any).toString();

  try {
    const result = await api.get(`/api/v1/gudang/barang-mentah?${queryString}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const fetchDataBarangMentahById = async (id: string) => {
  try {
    const result = await api.get(`/api/v1/gudang/barang-mentah/${id}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const delBarangMentah = async (id: string) => {
  try {
    const result = await api.delete(`/api/v1/gudang/barang-mentah/${id}`);
    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }
    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

export const postReceiptBarangMentah = async (id: string) => {
  const result = await api.post(`/api/v1/gudang/barang-mentah/${id}/post`);

  return result.data.data;
};

// BARU: Revert posting penerimaan barang mentah
export const revertReceiptBarangMentah = async (id: string) => {
  try {
    const result = await api.post(`/api/v1/gudang/barang-mentah/${id}/revert`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan saat revert penerimaan barang');
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
  } catch (e) {
    ThrowError(e);
  }
};

export const fetchDataReceiptList = async (params?: any) => {
  try {
    const removeKeys = ['data', 'total'];
    const fixObjParams = filterAndRemoveKeys(params, removeKeys);
    const queryString = new URLSearchParams(fixObjParams as any).toString();

    const result = await api.get(`/api/v1/gudang/barang-mentah/receipt-list?${queryString}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data?.data || [];
  } catch (e: any) {
    ThrowError(e);
  }
};

export const fetchGenCodeBarangMentahWithStock = async (params?: any) => {
  try {
    const removeKeys = ['data', 'total'];
    const fixObjParams = filterAndRemoveKeys(params, removeKeys);
    const queryString = new URLSearchParams(fixObjParams as any).toString();

    const result = await api.get(`/api/v1/master/barang-mentah/all?${queryString}`);

    if (![200, 201].includes(result.status)) {
      throw new Error('Terjadi kesalahan');
    }

    return result.data.data;
  } catch (e: any) {
    ThrowError(e);
  }
};

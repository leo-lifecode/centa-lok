import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getAccessToken, setTokens, clearTokens, decodeToken } from './authService';
import type { InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/', // ganti sesuai API-mu
  withCredentials: true, // agar cookie terkirim
});

type ErrorLogPayload = {
  message: string;
  stack?: string;
  pageUrl: string;
  route: string;
  componentStack?: string;
  userAgent: string;
  release: string;
  source: string;
  actorId?: string;
  actorName?: string;
  metadata?: unknown;
};

const ERROR_SOURCE = 'ikn-fe';

const truncate = (value: string, maxLen: number) => {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen);
};

const safeStringify = (value: unknown, maxLen = 6000) => {
  try {
    return truncate(JSON.stringify(value), maxLen);
  } catch {
    return truncate(String(value), maxLen);
  }
};

const redactSensitive = (value: unknown): unknown => {
  const visit = (v: any): any => {
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(visit);
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      const key = k.toLowerCase();
      if (key.includes('password') || key.includes('token') || key.includes('authorization')) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = visit(val);
      }
    }
    return out;
  };
  return visit(value);
};

const shouldEnableErrorLogging = () => import.meta.env.VITE_ENABLE_ERROR_LOGGING !== 'false';

const getErrorLogEndpoint = () => '/api/v1/frontend-error';

const getRelease = () => import.meta.env.VITE_RELEASE || import.meta.env.MODE;

const getActor = () => {
  try {
    const decoded = decodeToken();
    if (!decoded) return {};
    return {
      actorId: decoded.id,
      actorName: decoded.name,
    };
  } catch {
    return {};
  }
};

const errorLogDedupe = new Map<string, number>();

const shouldDedupe = (key: string, windowMs: number) => {
  const now = Date.now();
  const last = errorLogDedupe.get(key);
  if (last && now - last < windowMs) return true;
  errorLogDedupe.set(key, now);
  return false;
};

const postErrorLog = async (payload: ErrorLogPayload) => {
  const endpoint = getErrorLogEndpoint() || '/api/v1/frontend-error';
  if (!endpoint || !shouldEnableErrorLogging()) return;

  try {
    const token = getAccessToken();
    const client = axios.create({
      baseURL: '/',
      withCredentials: true,
    });

    if (token) {
      client.defaults.headers.common.Authorization = `Bearer ${token}`;
    }

    await client.post(endpoint, payload);
  } catch {
    return;
  }
};

const toMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if ((err as any)?.customMessage) return String((err as any).customMessage);
  return String(err);
};

const toStack = (err: unknown) => {
  if (err instanceof Error) return err.stack;
  return (err as any)?.stack ? String((err as any).stack) : undefined;
};

export const logClientError = async (params: {
  message: string;
  stack?: string;
  componentStack?: string;
  metadata?: unknown;
}) => {
  const endpoint = getErrorLogEndpoint();
  if (!endpoint || !shouldEnableErrorLogging()) return;

  const pageUrl = window.location.href;
  const route = window.location.pathname;
  const userAgent = navigator.userAgent;

  const payload: ErrorLogPayload = {
    message: truncate(params.message, 2000),
    stack: params.stack ? truncate(params.stack, 8000) : undefined,
    pageUrl,
    route,
    componentStack: params.componentStack ? truncate(params.componentStack, 8000) : undefined,
    userAgent,
    release: getRelease(),
    source: ERROR_SOURCE,
    ...getActor(),
    metadata: params.metadata ? redactSensitive(params.metadata) : undefined,
  };

  const dedupeKey = `${payload.route}|${payload.message}`;
  if (shouldDedupe(dedupeKey, 30_000)) return;

  await postErrorLog(payload);
};

export const captureError = async (err: unknown, metadata?: unknown) => {
  await logClientError({
    message: toMessage(err),
    stack: toStack(err),
    metadata: metadata ? redactSensitive(metadata) : undefined,
  });
};

export const initGlobalErrorReporting = () => {
  const w = window as any;
  if (w.__iknErrorReportingInitialized) return;
  w.__iknErrorReportingInitialized = true;

  window.addEventListener('error', (event) => {
    logClientError({
      message: toMessage(event.error || event.message),
      stack: toStack(event.error),
      metadata: {
        pageUrl: window.location.href,
        route: window.location.pathname,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logClientError({
      message: toMessage(event.reason),
      stack: toStack(event.reason),
      metadata: {
        pageUrl: window.location.href,
        route: window.location.pathname,
        reason: safeStringify(redactSensitive(event.reason)),
      },
    });
  });
};

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // try {
  //   const { challengeId, hash } = await getChallengeHeaders();
  //   if (config.headers) {
  //     config.headers['X-Client-Id'] = challengeId;
  //     config.headers['X-Client-Challenge'] = hash;
  //   }
  // } catch (err) {
  //   console.log('apiiii', err);
  //   console.error('Failed to add challenge headers', err);
  //   clearTokens();
  //   // window.location.href = '/login';
  //   return Promise.reject(err);
  // }

  return config;
});

// Untuk menghindari infinite loop
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };
    const requestedUrl = originalRequest?.url || '';
    if (requestedUrl.includes('/login')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      clearTokens();
      // Redirect ke login atau tampilkan pesan error
      window.location.href = '/login';
      return Promise.reject(error);
    } else if (error.response?.status === 403 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await api.get('/api/v1/authentikasi/login/refresh');
        const newAccessToken = res.data.data.access_token;
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        setTokens(newAccessToken);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        clearTokens();
        // Redirect ke login atau tampilkan pesan error
        window.location.href = '/login';
        // useNavigate()('/login')
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    const endpoint = getErrorLogEndpoint();
    const cfg = error.config as any;
    const requestedUrlForLog: string = cfg?.url || '';
    const statusForLog = error.response?.status;
    const shouldReport =
      !!endpoint &&
      shouldEnableErrorLogging() &&
      !requestedUrlForLog.includes('/login') &&
      !requestedUrlForLog.includes(endpoint) &&
      ((typeof statusForLog === 'number' && statusForLog >= 500) || !statusForLog);

    if (shouldReport) {
      logClientError({
        message: toMessage(error),
        stack: toStack(error),
        metadata: {
          request: {
            method: cfg?.method,
            url: cfg?.url,
            data: cfg?.data,
            params: cfg?.params,
          },
          response: {
            status: statusForLog,
            data: error.response?.data,
          },
        },
      });
    }

    return Promise.reject(error);
  }
);

export default api;

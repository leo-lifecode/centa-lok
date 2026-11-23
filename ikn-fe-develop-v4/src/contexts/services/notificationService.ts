import type { NotificationInstance } from 'antd/es/notification/interface';
import {
  CONNECTION_ERROR_MESSAGE,
  CONNECTION_ERROR_TITLE,
  hasRecentConnectionError,
} from '@/utils/connectionError';

let notificationApi: NotificationInstance | null = null;
export function setNotificationApi(api: NotificationInstance) {
  notificationApi = api;
}
type NotificationType = 'success' | 'info' | 'warning' | 'error';
export function showNotification(
  type: NotificationType,
  title: string,
  description: string,
  placement: 'topRight' | 'topLeft' | 'bottomLeft' | 'bottomRight' = 'topRight'
) {
  if (!notificationApi) {
    console.warn('Notification API not initialized');
    return;
  }

  // Jika error tadi disebabkan koneksi/timeout, tampilkan penyebab sebenarnya.
  const isConn = type === 'error' && hasRecentConnectionError();

  notificationApi[type]({
    message: isConn ? CONNECTION_ERROR_TITLE : title,
    description: isConn ? CONNECTION_ERROR_MESSAGE : description,
    placement,
  });
}

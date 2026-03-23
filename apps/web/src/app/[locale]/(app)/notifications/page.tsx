'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const [page, setPage] = useState(1);
  const {
    data: notifications,
    meta,
    loading,
    markRead,
    markAllRead,
    remove,
  } = useNotifications(page);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          {meta && (
            <p className="mt-1 text-sm text-gray-500">
              {t('count', { total: meta.total, unread: meta.unreadCount })}
            </p>
          )}
        </div>
        {meta && meta.unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            {t('markAllRead')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
              <div className="h-4 w-1/3 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-2/3 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <Bell className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">{t('empty')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('emptySubtitle')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start gap-4 rounded-lg border bg-white p-4 transition-colors ${
                !n.is_read ? 'border-primary-blue/20 bg-blue-50/30' : 'border-gray-200'
              }`}
            >
              <div className="mt-0.5">
                {!n.is_read ? (
                  <span className="flex h-2.5 w-2.5 rounded-full bg-primary-blue" />
                ) : (
                  <span className="flex h-2.5 w-2.5 rounded-full bg-gray-200" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                  >
                    {n.title}
                  </p>
                  <span className="shrink-0 text-xs text-gray-500">{formatDate(n.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{n.message}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {n.type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-600"
                    title={t('markRead')}
                    aria-label={t('markRead')}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => remove(n.id)}
                  className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-500"
                  title={t('delete')}
                  aria-label={t('delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tc('previous')}
          </button>
          <span className="text-sm text-gray-500">{tc('pageOf', { page, total: totalPages })}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tc('next')}
          </button>
        </div>
      )}
    </div>
  );
}

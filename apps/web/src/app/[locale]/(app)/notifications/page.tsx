'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url: string | null;
  created_at: string;
}

interface NotificationsMeta {
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
}

function getOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('clarixbi-org-store');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.currentOrgId || null;
    }
  } catch {
    // ignore
  }
  return null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<NotificationsMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      const res = await apiClient<{ data: NotificationItem[]; meta: NotificationsMeta }>(
        `/organizations/${orgId}/notifications?page=${p}&limit=20`,
      );
      setNotifications(res.data);
      setMeta(res.meta);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(page);
  }, [page, fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      if (meta) setMeta({ ...meta, unreadCount: Math.max(0, meta.unreadCount - 1) });
    } catch {
      // silent fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/notifications/mark-all-read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (meta) setMeta({ ...meta, unreadCount: 0 });
    } catch {
      // silent fail
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (meta) setMeta({ ...meta, total: meta.total - 1 });
    } catch {
      // silent fail
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Notificari</h1>
          {meta && (
            <p className="mt-1 text-sm text-gray-500">
              {meta.total} notificari, {meta.unreadCount} necitite
            </p>
          )}
        </div>
        {meta && meta.unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            Marcheaza toate ca citite
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
          <Bell className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Nicio notificare</h3>
          <p className="mt-1 text-sm text-gray-500">
            Vei primi notificari cand apar evenimente importante.
          </p>
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
                  <span className="shrink-0 text-xs text-gray-400">{formatDate(n.created_at)}</span>
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
                    onClick={() => handleMarkRead(n.id)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Marcheaza ca citita"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(n.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  title="Sterge"
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
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            Pagina {page} din {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Urmator
          </button>
        </div>
      )}
    </div>
  );
}

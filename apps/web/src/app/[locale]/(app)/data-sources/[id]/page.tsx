'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Save,
  Loader2,
  FileSpreadsheet,
  ShoppingCart,
  Upload,
  Play,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';

interface DataSource {
  id: string;
  type: string;
  name: string;
  status: string;
  last_sync_at: string | null;
  total_rows: number;
  sync_interval_minutes: number;
  created_at: string;
}

interface SyncLog {
  id: string;
  status: string;
  rows_imported: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  smartbill: FileSpreadsheet,
  woocommerce: ShoppingCart,
  csv: Upload,
  demo: Play,
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  syncing: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
  disconnected: 'bg-gray-100 text-gray-700',
};

const intervalOptions = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 ora', value: 60 },
  { label: '2 ore', value: 120 },
  { label: '3 ore', value: 180 },
];

export default function DataSourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ds, setDs] = useState<DataSource | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState('');
  const [editInterval, setEditInterval] = useState(15);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dsRes, logsRes] = await Promise.all([
          apiClient<{ data: DataSource }>(`/organizations/current/data-sources/${id}`),
          apiClient<{ data: SyncLog[] }>(`/organizations/current/data-sources/${id}/logs?limit=20`),
        ]);
        setDs(dsRes.data);
        setLogs(logsRes.data);
        setEditName(dsRes.data.name);
        setEditInterval(dsRes.data.sync_interval_minutes);
      } catch {
        router.push('/data-sources');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  if (loading || !ds) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const Icon = typeIcons[ds.type] || Database;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiClient(`/organizations/current/data-sources/${id}/sync`, { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient<{ data: DataSource }>(
        `/organizations/current/data-sources/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: editName, sync_interval_minutes: editInterval }),
        },
      );
      setDs(res.data);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Sigur vrei sa stergi aceasta sursa de date?')) return;
    try {
      await apiClient(`/organizations/current/data-sources/${id}`, { method: 'DELETE' });
      router.push('/data-sources');
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/data-sources')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Inapoi
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
          <Icon className="h-6 w-6 text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{ds.name}</h1>
          <Badge
            className={`mt-1 text-xs ${statusColors[ds.status] || statusColors['disconnected']}`}
          >
            {ds.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informatii</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tip conexiune</span>
              <span className="text-gray-900 capitalize">{ds.type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Interval sincronizare</span>
              <span className="text-gray-900">{ds.sync_interval_minutes} min</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total randuri</span>
              <span className="text-gray-900">{ds.total_rows.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ultima sincronizare</span>
              <span className="text-gray-900">
                {ds.last_sync_at ? new Date(ds.last_sync_at).toLocaleString() : '-'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editeaza</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nume</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Interval sincronizare
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={editInterval}
                onChange={(e) => setEditInterval(Number(e.target.value))}
              >
                {intervalOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salveaza
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync acum
        </Button>
        <Button variant="outline" className="text-red-500" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Sterge sursa
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Istoric sincronizari</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Nicio sincronizare inregistrata
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Randuri</th>
                    <th className="pb-2 font-medium">Eroare</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 text-gray-700">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <Badge
                          className={`text-xs ${
                            log.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : log.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-gray-700">
                        {(log.rows_imported || 0).toLocaleString()}
                      </td>
                      <td className="py-2 text-red-500 text-xs truncate max-w-[200px]">
                        {log.error_message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

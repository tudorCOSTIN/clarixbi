'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Plus,
  Play,
  Pause,
  TestTube,
  History,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

interface Alert {
  id: string;
  name: string;
  metric_query: string;
  condition_operator: string;
  threshold_value: number;
  check_frequency: string;
  is_active: boolean;
  data_source_id: string;
  created_at: string;
  updated_at: string;
}

interface AlertTrigger {
  id: string;
  triggered_at: string;
  metric_value: number;
  threshold_value: number;
  notified_via: string[];
}

interface DataSource {
  id: string;
  name: string;
  type: string;
}

interface AlertLimit {
  activeCount: number;
  limit: number;
  tier: string;
}

const OPERATORS: Record<string, string> = {
  gt: '>',
  lt: '<',
  eq: '=',
  gte: '>=',
  lte: '<=',
  change_pct: '% change >',
};

const FREQUENCIES: Record<string, string> = {
  realtime: 'Real-time (5 min)',
  hourly: 'La fiecare ora',
  daily: 'Zilnic',
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    alertId: string;
    wouldTrigger: boolean;
    currentValue: number;
    threshold: number;
  } | null>(null);
  const [alertLimit, setAlertLimit] = useState<AlertLimit | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      const res = await apiClient<{ data: Alert[] }>(`/organizations/${orgId}/alerts`);
      setAlerts(res.data);

      // Calculate limit info
      const activeCount = res.data.filter((a) => a.is_active).length;
      setAlertLimit({ activeCount, limit: 3, tier: 'starter' }); // Will be updated from plan
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleToggle = async (alertId: string, isActive: boolean) => {
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/alerts/${alertId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_active: isActive } : a)));
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('ALERT_LIMIT_REACHED') || msg.includes('402')) {
        alert('Ai atins limita de alerte active. Upgradeaza planul.');
      }
    }
  };

  const handleTest = async (alertId: string) => {
    try {
      setTestingId(alertId);
      const orgId = getOrgId();
      if (!orgId) return;
      const res = await apiClient<{
        data: { wouldTrigger: boolean; currentValue: number; threshold: number };
      }>(`/organizations/${orgId}/alerts/${alertId}/test`, { method: 'POST' });
      setTestResult({ alertId, ...res.data });
    } catch {
      // ignore
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm('Stergi alerta?')) return;
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/alerts/${alertId}`, { method: 'DELETE' });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const activeCount = alerts.filter((a) => a.is_active).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerte</h1>
          <p className="text-sm text-gray-500 mt-1">Monitorizeaza metrici si primeste notificari</p>
        </div>
        <div className="flex items-center gap-3">
          {alertLimit && (
            <span className="text-xs text-gray-500">
              {activeCount}/{alertLimit.limit === -1 ? '∞' : alertLimit.limit} alerte active
              {alertLimit.limit !== -1 && (
                <Link href="/settings/billing" className="text-primary-blue ml-1 hover:underline">
                  Upgrade
                </Link>
              )}
            </span>
          )}
          <Button onClick={() => setShowCreateWizard(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Creeaza alerta
          </Button>
        </div>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-500">Nicio alerta</h3>
            <p className="text-sm text-gray-400 mt-1">
              Creeaza prima alerta pentru a monitoriza datele
            </p>
            <Button
              onClick={() => setShowCreateWizard(true)}
              className="mt-4 gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Creeaza alerta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Nume
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Conditie
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Frecventa
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Actiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900">{alert.name}</div>
                    <div
                      className="text-xs text-gray-400 truncate max-w-[200px]"
                      title={alert.metric_query}
                    >
                      {alert.metric_query.substring(0, 60)}...
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {OPERATORS[alert.condition_operator] || alert.condition_operator}{' '}
                      {alert.threshold_value}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {FREQUENCIES[alert.check_frequency] || alert.check_frequency}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={alert.is_active ? 'default' : 'secondary'}>
                      {alert.is_active ? 'Activa' : 'Pauzata'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggle(alert.id, !alert.is_active)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title={alert.is_active ? 'Pauza' : 'Activeaza'}
                      >
                        {alert.is_active ? (
                          <Pause className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Play className="h-4 w-4 text-green-500" />
                        )}
                      </button>
                      <button
                        onClick={() => handleTest(alert.id)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Test (dry-run)"
                        disabled={testingId === alert.id}
                      >
                        {testingId === alert.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        ) : (
                          <TestTube className="h-4 w-4 text-blue-500" />
                        )}
                      </button>
                      <button
                        onClick={() => setShowHistory(alert.id)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Istoric triggers"
                      >
                        <History className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Sterge"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Test Result Toast */}
      {testResult && (
        <div className="fixed bottom-4 right-4 bg-white border rounded-xl shadow-lg p-4 max-w-sm z-50">
          <div className="flex items-start gap-3">
            {testResult.wouldTrigger ? (
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {testResult.wouldTrigger ? 'Alerta s-ar activa!' : 'Alerta NU s-ar activa'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Valoare curenta: <span className="font-mono">{testResult.currentValue}</span>
                {' / '}
                Prag: <span className="font-mono">{testResult.threshold}</span>
              </p>
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="p-1 hover:bg-gray-100 rounded ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Alert Wizard */}
      {showCreateWizard && (
        <CreateAlertWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={() => {
            setShowCreateWizard(false);
            fetchAlerts();
          }}
        />
      )}

      {/* Alert History Modal */}
      {showHistory && (
        <AlertHistoryModal alertId={showHistory} onClose={() => setShowHistory(null)} />
      )}
    </div>
  );
}

function CreateAlertWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [metricQuery, setMetricQuery] = useState('');
  const [operator, setOperator] = useState('gt');
  const [threshold, setThreshold] = useState('');
  const [frequency, setFrequency] = useState('hourly');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const orgId = getOrgId();
        if (!orgId) return;
        const res = await apiClient<{ data: DataSource[] }>(`/organizations/${orgId}/data-sources`);
        setDataSources(res.data);
      } catch {
        // ignore
      }
    };
    fetchSources();
  }, []);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/alerts`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          dataSourceId: selectedSource,
          metricQuery,
          conditionOperator: operator,
          thresholdValue: parseFloat(threshold),
          checkFrequency: frequency,
        }),
      });
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Eroare la salvare';
      if (msg.includes('ALERT_LIMIT_REACHED') || msg.includes('402')) {
        setError('Ai atins limita de alerte active. Upgradeaza planul.');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Creeaza alerta</h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full ${s <= step ? 'bg-primary-blue' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 min-h-[200px]">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data source</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                >
                  <option value="">Selecteaza sursa de date...</option>
                  {dataSources.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interogare metric (SQL)
                </label>
                <textarea
                  value={metricQuery}
                  onChange={(e) => setMetricQuery(e.target.value)}
                  placeholder="SELECT SUM(total_amount) FROM invoices WHERE org_id = '{orgId}' AND status = 'unpaid'"
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-blue resize-none"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                >
                  <option value="gt">Mai mare decat (&gt;)</option>
                  <option value="lt">Mai mic decat (&lt;)</option>
                  <option value="eq">Egal cu (=)</option>
                  <option value="gte">Mai mare sau egal (&gt;=)</option>
                  <option value="lte">Mai mic sau egal (&lt;=)</option>
                  <option value="change_pct">Schimbare procentuala (&gt;%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valoare prag</label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="10000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frecventa verificare
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                >
                  <option value="realtime">Real-time (la fiecare 5 min)</option>
                  <option value="hourly">La fiecare ora</option>
                  <option value="daily">Zilnic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nume alerta</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Facturi neachitate > 10000 RON"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                  {error.includes('Upgrade') && (
                    <Link href="/settings/billing" className="text-primary-blue underline ml-1">
                      <ArrowUpRight className="h-3.5 w-3.5 inline" /> Upgrade
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between p-4 border-t">
          <Button variant="outline" onClick={step > 1 ? () => setStep(step - 1) : onClose}>
            {step > 1 ? 'Inapoi' : 'Anuleaza'}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && (!selectedSource || !metricQuery.trim())) ||
                (step === 2 && !threshold)
              }
            >
              Urmatorul
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salveaza
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertHistoryModal({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const [triggers, setTriggers] = useState<AlertTrigger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTriggers = async () => {
      try {
        const orgId = getOrgId();
        if (!orgId) return;
        const res = await apiClient<{ data: AlertTrigger[] }>(
          `/organizations/${orgId}/alerts/${alertId}/triggers`,
        );
        setTriggers(res.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchTriggers();
  }, [alertId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Istoric triggers</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
            </div>
          ) : triggers.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">Niciun trigger inregistrat</div>
          ) : (
            <div className="space-y-2">
              {triggers.map((trigger) => (
                <div key={trigger.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {new Date(trigger.triggered_at).toLocaleString('ro-RO')}
                    </span>
                    <div className="flex gap-1">
                      {trigger.notified_via.map((via) => (
                        <Badge key={via} variant="secondary" className="text-[10px]">
                          {via}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Valoare: <span className="font-mono">{trigger.metric_value}</span>
                    {' / '}
                    Prag: <span className="font-mono">{trigger.threshold_value}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

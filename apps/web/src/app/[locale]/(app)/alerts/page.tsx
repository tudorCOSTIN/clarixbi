'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
import { FocusTrapDialog } from '@/components/ui/focus-trap-dialog';
import { useAlerts } from '@/hooks/useAlerts';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';
import { useSocketEvent } from '@/hooks/useWebSocket';
import Link from 'next/link';

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

export default function AlertsPage() {
  const t = useTranslations('alerts');
  const { data: alerts, loading, refetch, toggle, test: testAlert, remove } = useAlerts();
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

  useEffect(() => {
    if (!loading && alerts.length >= 0) {
      const activeCount = alerts.filter((a) => a.is_active).length;
      setAlertLimit({ activeCount, limit: 3, tier: 'starter' });
    }
  }, [alerts, loading]);

  // Real-time: refetch when an alert triggers
  const { on } = useSocketEvent();
  useEffect(() => {
    const off = on(
      'alert:triggered',
      (data: { alertId: string; value: number; threshold: number }) => {
        setTestResult({
          alertId: data.alertId,
          wouldTrigger: true,
          currentValue: data.value,
          threshold: data.threshold,
        });
      },
    );
    return () => off();
  }, [on]);

  const handleToggle = async (alertId: string, isActive: boolean) => {
    try {
      await toggle(alertId, isActive);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('ALERT_LIMIT_REACHED') || msg.includes('402')) {
        alert(t('limitReached'));
      }
    }
  };

  const handleTest = async (alertId: string) => {
    try {
      setTestingId(alertId);
      const result = await testAlert(alertId);
      setTestResult({ alertId, ...result });
    } catch {
      // ignore
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await remove(alertId);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const activeCount = alerts.filter((a) => a.is_active).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {alertLimit && (
            <span className="text-xs text-gray-500">
              {t('activeCount', {
                count: activeCount,
                limit: alertLimit.limit === -1 ? '∞' : alertLimit.limit,
              })}
              {alertLimit.limit !== -1 && (
                <Link href="/settings/billing" className="text-primary-blue ml-1 hover:underline">
                  {t('upgrade')}
                </Link>
              )}
            </span>
          )}
          <Button onClick={() => setShowCreateWizard(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
        </div>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-500">{t('empty')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('emptySubtitle')}</p>
            <Button
              onClick={() => setShowCreateWizard(true)}
              className="mt-4 gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              {t('create')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  {t('table.name')}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  {t('table.condition')}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  {t('table.frequency')}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  {t('table.status')}
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900">{alert.name}</div>
                    <div
                      className="text-xs text-gray-500 truncate max-w-[200px]"
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
                    {t(`frequencies.${alert.check_frequency}`)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={alert.is_active ? 'default' : 'secondary'}>
                      {alert.is_active ? t('active') : t('paused')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggle(alert.id, !alert.is_active)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title={alert.is_active ? t('pause') : t('activate')}
                        aria-label={alert.is_active ? t('pause') : t('activate')}
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
                        title={t('testDryRun')}
                        aria-label={t('testDryRun')}
                        disabled={testingId === alert.id}
                      >
                        {testingId === alert.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                        ) : (
                          <TestTube className="h-4 w-4 text-blue-500" />
                        )}
                      </button>
                      <button
                        onClick={() => setShowHistory(alert.id)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title={t('triggerHistory')}
                        aria-label={t('triggerHistory')}
                      >
                        <History className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title={t('delete')}
                        aria-label={t('delete')}
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
        <div
          className="fixed bottom-4 right-4 bg-white border rounded-xl shadow-lg p-4 max-w-sm z-50"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            {testResult.wouldTrigger ? (
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {testResult.wouldTrigger
                  ? t('testResult.wouldTrigger')
                  : t('testResult.wouldNotTrigger')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t('testResult.currentValue')}:{' '}
                <span className="font-mono">{testResult.currentValue}</span>
                {' / '}
                {t('testResult.threshold')}:{' '}
                <span className="font-mono">{testResult.threshold}</span>
              </p>
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="p-1 hover:bg-gray-100 rounded ml-2"
              aria-label="Dismiss"
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
            refetch();
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
  const t = useTranslations('alerts.wizard');
  const tAlerts = useTranslations('alerts');
  const { currentOrgId } = useOrgStore();
  const { create } = useAlerts();
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
        if (!currentOrgId) return;
        const res = await apiClient<{ data: DataSource[] }>(
          `/organizations/${currentOrgId}/data-sources`,
        );
        setDataSources(res.data);
      } catch {
        // ignore
      }
    };
    fetchSources();
  }, [currentOrgId]);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await create({
        name,
        dataSourceId: selectedSource,
        metricQuery,
        conditionOperator: operator,
        thresholdValue: parseFloat(threshold),
        checkFrequency: frequency,
      });
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('saveError');
      if (msg.includes('ALERT_LIMIT_REACHED') || msg.includes('402')) {
        setError(tAlerts('limitReached'));
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <FocusTrapDialog isOpen onDeactivate={onClose}>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{t('title')}</h2>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`w-2 h-2 rounded-full ${s <= step ? 'bg-primary-blue' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-4 min-h-[200px]">
            {step === 1 && (
              <>
                <div>
                  <label
                    htmlFor="alert-data-source"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('dataSource')}
                  </label>
                  <select
                    id="alert-data-source"
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  >
                    <option value="">{t('selectSource')}</option>
                    {dataSources.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="alert-metric-query"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('metricQuery')}
                  </label>
                  <textarea
                    id="alert-metric-query"
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
                  <label
                    htmlFor="alert-operator"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('operator')}
                  </label>
                  <select
                    id="alert-operator"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  >
                    <option value="gt">{t('operators.gt')}</option>
                    <option value="lt">{t('operators.lt')}</option>
                    <option value="eq">{t('operators.eq')}</option>
                    <option value="gte">{t('operators.gte')}</option>
                    <option value="lte">{t('operators.lte')}</option>
                    <option value="change_pct">{t('operators.change_pct')}</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="alert-threshold"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('thresholdValue')}
                  </label>
                  <input
                    id="alert-threshold"
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
                  <label
                    htmlFor="alert-frequency"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('checkFrequency')}
                  </label>
                  <select
                    id="alert-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  >
                    <option value="realtime">{t('frequencyOptions.realtime')}</option>
                    <option value="hourly">{t('frequencyOptions.hourly')}</option>
                    <option value="daily">{t('frequencyOptions.daily')}</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="alert-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('alertName')}
                  </label>
                  <input
                    id="alert-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('alertNamePlaceholder')}
                    aria-describedby={error ? 'wizard-error' : undefined}
                    aria-invalid={!!error}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  />
                </div>
                {error && (
                  <div
                    id="wizard-error"
                    role="alert"
                    aria-live="assertive"
                    className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg"
                  >
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
              {step > 1 ? t('back') : t('cancel')}
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && (!selectedSource || !metricQuery.trim())) ||
                  (step === 2 && !threshold)
                }
              >
                {t('next')}
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={!name.trim() || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('save')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </FocusTrapDialog>
  );
}

function AlertHistoryModal({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const t = useTranslations('alerts.history');
  const { getTriggers } = useAlerts();
  const [triggers, setTriggers] = useState<AlertTrigger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTriggers = async () => {
      try {
        const data = await getTriggers(alertId);
        setTriggers(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchTriggers();
  }, [alertId, getTriggers]);

  return (
    <FocusTrapDialog isOpen onDeactivate={onClose}>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">{t('title')}</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto" />
              </div>
            ) : triggers.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">{t('empty')}</div>
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
                      {t('value')}: <span className="font-mono">{trigger.metric_value}</span>
                      {' / '}
                      {t('threshold')}: <span className="font-mono">{trigger.threshold_value}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </FocusTrapDialog>
  );
}

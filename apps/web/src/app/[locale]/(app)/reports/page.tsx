'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Plus, Download, Clock, Calendar, Loader2, Trash2, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useReports } from '@/hooks/useReports';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface Report {
  id: string;
  name: string;
  description: string | null;
  dashboard_id: string;
  dashboard?: { name: string };
  config: { widgetIds?: string[]; generatedFiles?: { url: string; generatedAt: string }[] };
  schedules?: {
    id: string;
    cron_expression: string;
    recipients: string[];
    is_active: boolean;
    next_run_at: string;
  }[];
  created_at: string;
  updated_at: string;
}

interface Dashboard {
  id: string;
  name: string;
  widgets?: { id: string; title: string }[];
}

export default function ReportsPage() {
  const t = useTranslations('reports');
  const {
    data: reports,
    loading,
    refetch,
    generate,
    download,
    remove,
    create,
    schedule,
  } = useReports();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = async (reportId: string) => {
    try {
      setGenerating(reportId);
      await generate(reportId);
      setTimeout(() => {
        refetch();
        setGenerating(null);
      }, 3000);
    } catch {
      setGenerating(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await remove(reportId);
    } catch {
      // ignore
    }
  };

  const handleDownload = async (reportId: string) => {
    try {
      const url = await download(reportId);
      if (url) {
        window.open(url, '_blank');
      }
    } catch {
      alert(t('noPdf'));
    }
  };

  const getLastGenerated = (report: Report): string | null => {
    const files = report.config?.generatedFiles;
    if (!files || files.length === 0) return null;
    return files[files.length - 1]!.generatedAt;
  };

  const getScheduleLabel = (cron: string): string => {
    if (cron === '0 8 * * *') return t('schedule.daily');
    if (cron === '0 8 * * 1') return t('schedule.weekly');
    if (cron === '0 8 1 * *') return t('schedule.monthly');
    return cron;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-500">{t('empty')}</h3>
            <p className="text-sm text-gray-400 mt-1">{t('emptySubtitle')}</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              {t('create')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(reports as Report[]).map((report) => {
            const lastGenerated = getLastGenerated(report);
            const reportSchedule = report.schedules?.[0];
            return (
              <Card key={report.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{report.name}</CardTitle>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                      aria-label={t('deleteConfirm')}
                    >
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  {report.description && (
                    <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{report.dashboard?.name || 'Dashboard'}</span>
                  </div>

                  {lastGenerated && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {t('generated', { date: new Date(lastGenerated).toLocaleDateString() })}
                      </span>
                    </div>
                  )}

                  {reportSchedule && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-gray-500" />
                      <Badge variant="secondary" className="text-[10px]">
                        {getScheduleLabel(reportSchedule.cron_expression)}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        → {t('destinations', { count: reportSchedule.recipients.length })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs flex-1"
                      onClick={() => handleGenerate(report.id)}
                      disabled={generating === report.id}
                    >
                      {generating === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {t('generateNow')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => handleDownload(report.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => setShowScheduleModal(report.id)}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Report Modal */}
      {showCreateModal && (
        <CreateReportModal
          onClose={() => setShowCreateModal(false)}
          onCreated={async (dto) => {
            await create(dto);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(null)}
          onSaved={async (dto) => {
            await schedule(showScheduleModal, dto);
            setShowScheduleModal(null);
          }}
        />
      )}
    </div>
  );
}

function CreateReportModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (dto: {
    name: string;
    dashboardId: string;
    widgetIds: string[];
    description?: string;
  }) => Promise<void>;
}) {
  const t = useTranslations('reports.modal');
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState('');
  const [widgets, setWidgets] = useState<{ id: string; title: string }[]>([]);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const { currentOrgId } = useOrgStore();

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        if (!currentOrgId) return;
        const res = await apiClient<{ data: Dashboard[] }>(
          `/organizations/${currentOrgId}/dashboards`,
        );
        setDashboards(res.data);
      } catch {
        // ignore
      }
    };
    fetchDashboards();
  }, [currentOrgId]);

  const handleDashboardChange = async (dashId: string) => {
    setSelectedDashboard(dashId);
    if (!dashId) {
      setWidgets([]);
      setSelectedWidgets([]);
      return;
    }
    try {
      if (!currentOrgId) return;
      const res = await apiClient<{ data: { widgets: { id: string; title: string }[] } }>(
        `/organizations/${currentOrgId}/dashboards/${dashId}`,
      );
      const w = res.data?.widgets || [];
      setWidgets(w);
      setSelectedWidgets(w.map((wi: { id: string }) => wi.id));
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !selectedDashboard || selectedWidgets.length === 0) return;
    setSaving(true);
    try {
      await onCreated({
        name,
        dashboardId: selectedDashboard,
        widgetIds: selectedWidgets,
        description: description || undefined,
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const toggleWidget = (id: string) => {
    setSelectedWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id],
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('createTitle')}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('createTitle')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reportName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('reportNamePlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('description')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard')}</label>
            <select
              value={selectedDashboard}
              onChange={(e) => handleDashboardChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            >
              <option value="">{t('selectDashboard')}</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {widgets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('widgets', { selected: selectedWidgets.length, total: widgets.length })}
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                {widgets.map((w) => (
                  <label
                    key={w.id}
                    className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedWidgets.includes(w.id)}
                      onChange={() => toggleWidget(w.id)}
                      className="rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
                    />
                    <span className="text-sm">{w.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !selectedDashboard || selectedWidgets.length === 0 || saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('create')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (dto: { frequency: string; recipients: string[]; timezone: string }) => Promise<void>;
}) {
  const t = useTranslations('reports.scheduleModal');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recipientsText, setRecipientsText] = useState('');
  const [timezone, setTimezone] = useState('Europe/Bucharest');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const recipients = recipientsText
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));
    if (recipients.length === 0) return;

    setSaving(true);
    try {
      await onSaved({ frequency, recipients, timezone });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('frequency')}</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            >
              <option value="daily">{t('frequencyOptions.daily')}</option>
              <option value="weekly">{t('frequencyOptions.weekly')}</option>
              <option value="monthly">{t('frequencyOptions.monthly')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('recipients')}
            </label>
            <textarea
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              placeholder="john@company.com, maria@company.com"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('timezone')}</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            >
              <option value="Europe/Bucharest">Europe/Bucharest</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!recipientsText.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

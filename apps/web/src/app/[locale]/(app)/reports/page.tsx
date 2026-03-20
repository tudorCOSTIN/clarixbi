'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Download, Clock, Calendar, Loader2, Trash2, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

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
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      const res = await apiClient<{ data: Report[] }>(`/organizations/${orgId}/reports`);
      setReports(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async (reportId: string) => {
    try {
      setGenerating(reportId);
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/reports/${reportId}/generate`, { method: 'POST' });
      // Wait briefly then refresh
      setTimeout(() => {
        fetchReports();
        setGenerating(null);
      }, 3000);
    } catch {
      setGenerating(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Stergi raportul?')) return;
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/reports/${reportId}`, { method: 'DELETE' });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch {
      // ignore
    }
  };

  const handleDownload = async (reportId: string) => {
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      const res = await apiClient<{ data: { url: string } }>(
        `/organizations/${orgId}/reports/${reportId}/download`,
      );
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      }
    } catch {
      alert('Nu exista PDF generat. Apasa "Genereaza acum" mai intai.');
    }
  };

  const getLastGenerated = (report: Report): string | null => {
    const files = report.config?.generatedFiles;
    if (!files || files.length === 0) return null;
    return files[files.length - 1]!.generatedAt;
  };

  const getScheduleLabel = (cron: string): string => {
    if (cron === '0 8 * * *') return 'Zilnic';
    if (cron === '0 8 * * 1') return 'Saptamanal';
    if (cron === '0 8 1 * *') return 'Lunar';
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
          <h1 className="text-2xl font-bold text-gray-900">Rapoarte</h1>
          <p className="text-sm text-gray-500 mt-1">
            Genereaza si programeaza rapoarte PDF din dashboard-uri
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Creeaza raport
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-500">Niciun raport</h3>
            <p className="text-sm text-gray-400 mt-1">Creeaza primul raport din dashboard</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Creeaza raport
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => {
            const lastGenerated = getLastGenerated(report);
            const schedule = report.schedules?.[0];
            return (
              <Card key={report.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{report.name}</CardTitle>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
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
                      <span>Generat: {new Date(lastGenerated).toLocaleDateString('ro-RO')}</span>
                    </div>
                  )}

                  {schedule && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-gray-500" />
                      <Badge variant="secondary" className="text-[10px]">
                        {getScheduleLabel(schedule.cron_expression)}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        → {schedule.recipients.length} dest.
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
                      Genereaza acum
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
          onCreated={() => {
            setShowCreateModal(false);
            fetchReports();
          }}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          reportId={showScheduleModal}
          onClose={() => setShowScheduleModal(null)}
          onSaved={() => {
            setShowScheduleModal(null);
            fetchReports();
          }}
        />
      )}
    </div>
  );
}

function CreateReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState('');
  const [widgets, setWidgets] = useState<{ id: string; title: string }[]>([]);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        const orgId = getOrgId();
        if (!orgId) return;
        const res = await apiClient<{ data: Dashboard[] }>(`/organizations/${orgId}/dashboards`);
        setDashboards(res.data);
      } catch {
        // ignore
      }
    };
    fetchDashboards();
  }, []);

  useEffect(() => {
    if (!selectedDashboard) {
      setWidgets([]);
      setSelectedWidgets([]);
      return;
    }
    const fetchWidgets = async () => {
      try {
        const orgId = getOrgId();
        if (!orgId) return;
        const res = await apiClient<{ data: { widgets: { id: string; title: string }[] } }>(
          `/organizations/${orgId}/dashboards/${selectedDashboard}`,
        );
        const w = res.data?.widgets || [];
        setWidgets(w);
        setSelectedWidgets(w.map((wi) => wi.id));
      } catch {
        // ignore
      }
    };
    fetchWidgets();
  }, [selectedDashboard]);

  const handleSave = async () => {
    if (!name.trim() || !selectedDashboard || selectedWidgets.length === 0) return;
    setSaving(true);
    try {
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          dashboardId: selectedDashboard,
          widgetIds: selectedWidgets,
          description: description || undefined,
        }),
      });
      onCreated();
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Creeaza raport</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nume raport</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Raport vanzari lunar"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descriere (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Raport cu datele de vanzari..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dashboard</label>
            <select
              value={selectedDashboard}
              onChange={(e) => setSelectedDashboard(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            >
              <option value="">Selecteaza dashboard...</option>
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
                Widget-uri ({selectedWidgets.length}/{widgets.length} selectate)
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
            Anuleaza
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !selectedDashboard || selectedWidgets.length === 0 || saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Creeaza
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({
  reportId,
  onClose,
  onSaved,
}: {
  reportId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
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
      const orgId = getOrgId();
      if (!orgId) return;
      await apiClient(`/organizations/${orgId}/reports/${reportId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ frequency, recipients, timezone }),
      });
      onSaved();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Programeaza raport</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frecventa</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
            >
              <option value="daily">Zilnic</option>
              <option value="weekly">Saptamanal (Luni)</option>
              <option value="monthly">Lunar (1a zi)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destinatari (email-uri, separate prin virgula)
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
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
            Anuleaza
          </Button>
          <Button onClick={handleSave} disabled={!recipientsText.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salveaza
          </Button>
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

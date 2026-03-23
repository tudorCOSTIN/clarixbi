'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  default_timezone: string;
  default_language: string;
}

export default function OrganizationPage() {
  const t = useTranslations('organization');
  const { currentOrgId } = useOrgStore();
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('Europe/Bucharest');
  const [language, setLanguage] = useState('ro');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    const load = async () => {
      try {
        const res = await apiClient<{ data: Organization }>(`/organizations/${currentOrgId}`);
        setOrg(res.data);
        setName(res.data.name);
        setSlug(res.data.slug);
        setTimezone(res.data.default_timezone || 'Europe/Bucharest');
        setLanguage(res.data.default_language || 'ro');
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentOrgId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiClient<{ data: Organization }>(`/organizations/${currentOrgId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          slug,
          default_timezone: timezone,
          default_language: language,
        }),
      });
      setOrg(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== org?.name) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/organizations/${currentOrgId}`, { method: 'DELETE' });
      window.location.href = '/';
    } catch {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-dark-navy">{t('title')}</h1>

      {/* Organization Details */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-dark-navy mb-4">{t('details')}</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
              {t('name')}
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="org-slug" className="block text-sm font-medium text-gray-700 mb-1">
              {t('slug')}
            </label>
            <input
              id="org-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="org-timezone" className="block text-sm font-medium text-gray-700 mb-1">
              {t('timezone')}
            </label>
            <select
              id="org-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Europe/Bucharest">Europe/Bucharest (EET)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Europe/Berlin">Europe/Berlin (CET)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label htmlFor="org-language" className="block text-sm font-medium text-gray-700 mb-1">
              {t('language')}
            </label>
            <select
              id="org-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ro">Romana</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '...' : t('save')}
            </button>
            {saved && <span className="text-sm text-green-600">{t('saved')}</span>}
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-xl border-2 border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-red-700">{t('dangerZone')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('deleteDescription')}</p>
        <div className="mt-4">
          <button
            onClick={() => setShowDelete(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {t('deleteOrg')}
          </button>
        </div>
      </section>

      {/* Delete Confirmation Dialog */}
      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label={t('deleteConfirmTitle')}
        >
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">{t('deleteConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('deleteConfirmMessage')}</p>
            <div className="mt-4">
              <label
                htmlFor="delete-confirm-org"
                className="block text-sm font-medium text-gray-700"
              >
                {t('deleteConfirmLabel', { name: org?.name })}
              </label>
              <input
                id="delete-confirm-org"
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder={org?.name}
              />
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDelete(false);
                  setDeleteConfirm('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== org?.name || deleteLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteLoading ? '...' : t('deleteConfirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

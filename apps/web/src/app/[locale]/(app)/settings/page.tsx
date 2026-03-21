'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  preferred_language: string;
  preferred_timezone: string;
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('ro');
  const [timezone, setTimezone] = useState('Europe/Bucharest');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportMessage, setExportMessage] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient<{ data: UserProfile }>('/users/me', {
          skipOrgHeader: true,
        });
        setUser(res.data);
        setName(res.data.name);
        setLanguage(res.data.preferred_language || 'ro');
        setTimezone(res.data.preferred_timezone || 'Europe/Bucharest');
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiClient<{ data: UserProfile }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          preferred_language: language,
          preferred_timezone: timezone,
        }),
      });
      setUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // If language changed, redirect to the new locale
      if (language !== user?.preferred_language) {
        const path = window.location.pathname.replace(/^\/(ro|en)/, `/${language}`);
        router.push(path);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    setExportMessage('');
    try {
      await apiClient('/users/me/gdpr/export', { method: 'POST' });
      setExportMessage(t('exportRequested'));
    } catch {
      setExportMessage('Error requesting export.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await apiClient('/users/me/gdpr/delete', { method: 'POST' });
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
      router.push('/');
    } catch {
      setDeleteError('Error deleting account. Please try again.');
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

      {/* Profile Section */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-dark-navy mb-4">{t('profile')}</h2>
        <div className="flex items-start gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              user?.name?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div className="flex-1 space-y-4 max-w-md">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('name')}
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('emailLabel')}
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Preferences Section */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-dark-navy mb-4">{t('preferences')}</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label htmlFor="pref-language" className="block text-sm font-medium text-gray-700 mb-1">
              {t('language')}
            </label>
            <select
              id="pref-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ro">Romana</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label htmlFor="pref-timezone" className="block text-sm font-medium text-gray-700 mb-1">
              {t('timezone')}
            </label>
            <select
              id="pref-timezone"
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
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '...' : t('save')}
            </button>
            {saved && <span className="text-sm text-green-600">{t('savedSuccess')}</span>}
          </div>
        </div>
      </section>

      {/* Your Data Section */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-dark-navy">{t('yourData')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('dataDescription')}</p>
        <div className="mt-4">
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {exportLoading ? '...' : t('exportData')}
          </button>
          {exportMessage && (
            <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {exportMessage}
            </p>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-xl border-2 border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-red-700">{t('dangerZone')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('deleteConfirmMessage')}</p>
        <div className="mt-4">
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t('deleteAccount')}
          </button>
        </div>
      </section>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">{t('deleteConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('deleteConfirmMessage')}</p>
            <div className="mt-4">
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-gray-700">
                {t('deleteConfirmLabel')}
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="DELETE"
              />
            </div>
            {deleteError && <p className="mt-2 text-xs text-red-600">{deleteError}</p>}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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

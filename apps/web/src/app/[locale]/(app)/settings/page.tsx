'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const router = useRouter();
  const [exportMessage, setExportMessage] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      // Clear cookies
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-dark-navy">{t('title')}</h1>

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

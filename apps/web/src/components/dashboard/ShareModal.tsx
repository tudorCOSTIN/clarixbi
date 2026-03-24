'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Copy, Trash2, Link, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FocusTrapDialog } from '@/components/ui/focus-trap-dialog';
import { apiClient } from '@/lib/api-client';

interface ShareLink {
  id: string;
  share_token: string;
  view_count: number;
  created_at: string;
}

interface ShareModalProps {
  dashboardId: string;
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ dashboardId, orgId, isOpen, onClose }: ShareModalProps) {
  const t = useTranslations('dashboard.shareModal');
  const tA11y = useTranslations('a11y');
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient<{ data: ShareLink[] }>(
        `/organizations/${orgId}/dashboards/${dashboardId}/shares`,
      );
      setShares(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [orgId, dashboardId]);

  useEffect(() => {
    if (isOpen) {
      fetchShares();
      setShowRevokeAll(false);
    }
  }, [isOpen, fetchShares]);

  if (!isOpen) return null;

  const getShareUrl = (token: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/d/${token}`;
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await apiClient(`/organizations/${orgId}/dashboards/${dashboardId}/share`, {
        method: 'POST',
      });
      await fetchShares();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(getShareUrl(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await apiClient(`/organizations/${orgId}/dashboards/${dashboardId}/shares/${shareId}`, {
        method: 'DELETE',
      });
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch {
      // ignore
    }
  };

  const handleRevokeAll = async () => {
    try {
      await apiClient(`/organizations/${orgId}/dashboards/${dashboardId}/shares`, {
        method: 'DELETE',
        headers: { 'X-Confirm-Revoke-All': 'true' },
      });
      setShares([]);
      setShowRevokeAll(false);
    } catch {
      // ignore
    }
  };

  return (
    <FocusTrapDialog isOpen={isOpen} onDeactivate={onClose}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
      >
        <Card className="w-full max-w-lg mx-4">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">{t('title')}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={tA11y('close')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-4 space-y-4">
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link className="h-4 w-4 mr-2" />
              )}
              {t('generateLink')}
            </Button>

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">{t('noLinks')}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-gray-700 font-mono text-xs">
                        {getShareUrl(share.share_token)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(share.created_at).toLocaleDateString()} &middot;{' '}
                        {share.view_count} {t('views')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => handleCopy(share.share_token, share.id)}
                      aria-label={tA11y('copyLink')}
                    >
                      <Copy
                        className={`h-3.5 w-3.5 ${copiedId === share.id ? 'text-green-500' : ''}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0 text-red-500"
                      onClick={() => handleRevoke(share.id)}
                      aria-label={t('revokeLink')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {shares.length > 1 && (
              <div>
                {showRevokeAll ? (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700 flex-1">{t('revokeAllConfirm')}</p>
                    <Button variant="destructive" size="sm" onClick={handleRevokeAll}>
                      {t('revokeAllYes')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowRevokeAll(false)}>
                      {t('revokeAllCancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-500"
                    onClick={() => setShowRevokeAll(true)}
                  >
                    {t('revokeAll')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FocusTrapDialog>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/useTeam';

const ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;

export default function TeamPage() {
  const t = useTranslations('team');
  const {
    members,
    pendingInvites,
    loading,
    inviteMember,
    removeMember,
    updateRole,
    resendInvite,
    revokeInvite,
  } = useTeam();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteError('');
    try {
      await inviteMember({ email: inviteEmail, role: inviteRole });
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, role: string) => {
    try {
      await updateRole(memberId, role);
    } catch {
      // ignore
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm(t('confirmRemove'))) return;
    try {
      await removeMember(memberId);
    } catch {
      // ignore
    }
  };

  const handleResend = async (inviteId: string) => {
    try {
      await resendInvite(inviteId);
    } catch {
      // ignore
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite(inviteId);
    } catch {
      // ignore
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

      {/* Invite Form */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-dark-navy mb-4">{t('inviteMember')}</h2>
        <form onSubmit={handleInvite} className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('email')}
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
              {t('role')}
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ROLES.filter((r) => r !== 'owner').map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviteLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {inviteLoading ? '...' : t('sendInvite')}
          </button>
        </form>
        {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
      </section>

      {/* Members Table */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-dark-navy mb-4">
          {t('members')} ({members.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 font-medium">{t('member')}</th>
                <th className="pb-2 font-medium">{t('role')}</th>
                <th className="pb-2 font-medium">{t('joined')}</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-gray-100">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                        {(member.user?.name || member.invite_email || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.user?.name || member.invite_email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {member.user?.email || member.invite_email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    {member.role === 'owner' ? (
                      <span className="text-gray-700 font-medium">{t('roles.owner')}</span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        {ROLES.filter((r) => r !== 'owner').map((r) => (
                          <option key={r} value={r}>
                            {t(`roles.${r}`)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-3 text-gray-500">
                    {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-3 text-right">
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        {t('remove')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-dark-navy mb-4">
            {t('pendingInvites')} ({pendingInvites.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">{t('email')}</th>
                  <th className="pb-2 font-medium">{t('role')}</th>
                  <th className="pb-2 font-medium">{t('expires')}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-700">{invite.invite_email}</td>
                    <td className="py-3 text-gray-500">{t(`roles.${invite.role}`)}</td>
                    <td className="py-3 text-gray-500">
                      {invite.invite_expires_at
                        ? new Date(invite.invite_expires_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleResend(invite.id)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          {t('resend')}
                        </button>
                        <button
                          onClick={() => handleRevoke(invite.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          {t('revoke')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

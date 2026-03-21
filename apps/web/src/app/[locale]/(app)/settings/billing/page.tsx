'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface PlanLimits {
  max_data_sources: number;
  max_dashboards: number;
  max_team_members: number;
  max_ai_queries_monthly: number;
  max_alerts: number;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly_eur: number;
  price_annual_eur: number;
  limits: PlanLimits;
  features: string[];
}

interface UsageItem {
  used: number;
  limit: number;
}

interface Usage {
  dataSources: UsageItem;
  dashboards: UsageItem;
  teamMembers: UsageItem;
  aiQueries: UsageItem;
  alerts: UsageItem;
}

interface Subscription {
  id: string;
  status: string;
  billing_period: string;
  trial_ends_at: string | null;
  current_period_end: string;
  plan: Plan;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount_paid: number;
  currency: string;
  created: number;
  hosted_invoice_url: string;
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = !isUnlimited && pct >= 80;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className={isNearLimit ? 'text-red-600 font-medium' : 'text-gray-500'}>
          {used} / {isUnlimited ? '\u221E' : limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: isUnlimited ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const t = useTranslations('billing');
  const { currentOrgId } = useOrgStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (!currentOrgId) return;

    const load = async () => {
      try {
        const [billingRes, plansRes, invoicesRes] = await Promise.all([
          apiClient<{ data: { subscription: Subscription; usage: Usage } }>(
            `/organizations/${currentOrgId}/billing`,
          ),
          apiClient<{ data: Plan[] }>(`/organizations/${currentOrgId}/billing/plans`),
          apiClient<{ data: Invoice[] }>(`/organizations/${currentOrgId}/billing/invoices`),
        ]);
        setSubscription(billingRes.data.subscription);
        setUsage(billingRes.data.usage);
        setPlans(plansRes.data);
        setInvoices(invoicesRes.data);
      } catch {
        // silently handle — page will show loading
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentOrgId]);

  const handleSubscribe = async (planId: string) => {
    setActionLoading(planId);
    try {
      const res = await apiClient<{ data: { url: string } }>(
        `/organizations/${currentOrgId}/billing/subscribe`,
        {
          method: 'POST',
          body: JSON.stringify({
            planId,
            billingPeriod: isAnnual ? 'annual' : 'monthly',
          }),
        },
      );
      window.location.href = res.data.url;
    } catch {
      setActionLoading('');
    }
  };

  const handleCancel = async () => {
    if (!confirm(t('cancelConfirm'))) return;
    setActionLoading('cancel');
    try {
      await apiClient(`/organizations/${currentOrgId}/billing/cancel`, { method: 'POST' });
      window.location.reload();
    } catch {
      setActionLoading('');
    }
  };

  const handlePortal = async () => {
    try {
      const res = await apiClient<{ data: { url: string } }>(
        `/organizations/${currentOrgId}/billing/portal`,
      );
      window.location.href = res.data.url;
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

  const currentPlanName = subscription?.plan?.name || 'starter';

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-dark-navy">{t('title')}</h1>

      {/* Current Plan Card */}
      {subscription && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-dark-navy">
                {subscription.plan?.display_name || 'Starter'}
              </h2>
              <div className="mt-1 flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    subscription.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : subscription.status === 'trialing'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {subscription.status === 'trialing' ? t('trial') : subscription.status}
                </span>
                <span className="text-sm text-gray-500">
                  {subscription.billing_period === 'annual' ? t('annual') : t('monthly')}
                </span>
              </div>
              {subscription.trial_ends_at && (
                <p className="mt-2 text-sm text-amber-600">
                  {t('trialEnds')}: {new Date(subscription.trial_ends_at).toLocaleDateString()}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                {t('nextBilling')}: {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-dark-navy">
                &euro;
                {isAnnual
                  ? subscription.plan?.price_annual_eur
                  : subscription.plan?.price_monthly_eur}
              </p>
              <p className="text-xs text-gray-400">/{isAnnual ? t('year') : t('month')}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handlePortal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('managePayment')}
            </button>
            {subscription.status !== 'canceled' && (
              <button
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {t('cancelPlan')}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Usage Meters */}
      {usage && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-dark-navy mb-4">{t('usage')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UsageMeter
              label={t('dataSources')}
              used={usage.dataSources.used}
              limit={usage.dataSources.limit}
            />
            <UsageMeter
              label={t('dashboards')}
              used={usage.dashboards.used}
              limit={usage.dashboards.limit}
            />
            <UsageMeter
              label={t('teamMembers')}
              used={usage.teamMembers.used}
              limit={usage.teamMembers.limit}
            />
            <UsageMeter
              label={t('aiQueries')}
              used={usage.aiQueries.used}
              limit={usage.aiQueries.limit}
            />
            <UsageMeter label={t('alerts')} used={usage.alerts.used} limit={usage.alerts.limit} />
          </div>
        </section>
      )}

      {/* Plan Comparison */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-dark-navy">{t('plans')}</h2>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                !isAnnual ? 'bg-white shadow text-dark-navy' : 'text-gray-500'
              }`}
            >
              {t('monthly')}
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isAnnual ? 'bg-white shadow text-dark-navy' : 'text-gray-500'
              }`}
            >
              {t('annual')}
              <span className="ml-1 text-xs text-green-600">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.name === currentPlanName;
            const price = isAnnual ? plan.price_annual_eur : plan.price_monthly_eur;

            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 p-6 ${
                  isCurrent ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'
                }`}
              >
                <h3 className="text-lg font-bold text-dark-navy">{plan.display_name}</h3>
                <p className="mt-2">
                  <span className="text-3xl font-bold text-dark-navy">&euro;{price}</span>
                  <span className="text-sm text-gray-400">
                    /{isAnnual ? t('year') : t('month')}
                  </span>
                </p>

                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li>
                    {plan.limits.max_data_sources === -1
                      ? t('unlimited')
                      : plan.limits.max_data_sources}{' '}
                    {t('dataSources')}
                  </li>
                  <li>
                    {plan.limits.max_dashboards === -1
                      ? t('unlimited')
                      : plan.limits.max_dashboards}{' '}
                    {t('dashboards')}
                  </li>
                  <li>
                    {plan.limits.max_team_members === -1
                      ? t('unlimited')
                      : plan.limits.max_team_members}{' '}
                    {t('teamMembers')}
                  </li>
                  <li>
                    {plan.limits.max_ai_queries_monthly} {t('aiQueriesMonth')}
                  </li>
                  <li>
                    {plan.limits.max_alerts === -1 ? t('unlimited') : plan.limits.max_alerts}{' '}
                    {t('alerts')}
                  </li>
                </ul>

                <div className="mt-4 space-y-1">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="text-green-500">&#10003;</span>
                      {f.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500"
                    >
                      {t('currentPlan')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={actionLoading === plan.id}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === plan.id
                        ? '...'
                        : t('upgradeTo', { plan: plan.display_name })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Invoices */}
      {invoices.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-dark-navy mb-4">{t('invoices')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">{t('invoiceNumber')}</th>
                  <th className="pb-2 font-medium">{t('date')}</th>
                  <th className="pb-2 font-medium">{t('amount')}</th>
                  <th className="pb-2 font-medium">{t('status')}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-700">{inv.number}</td>
                    <td className="py-3 text-gray-500">
                      {new Date(inv.created * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-700">
                      &euro;{(inv.amount_paid / 100).toFixed(2)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {t('view')}
                        </a>
                      )}
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

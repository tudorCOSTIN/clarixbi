'use client';

import { useTranslations } from 'next-intl';

export default function CookiesPage() {
  const t = useTranslations('legal.cookies');

  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-2xl font-bold text-dark-navy">{t('title')}</h1>
      <p className="text-sm text-gray-500">{t('lastUpdated')}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('whatAreCookies.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('whatAreCookies.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('necessary.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('necessary.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('analytics.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('analytics.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('manage.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('manage.content')}</p>
      </section>
    </article>
  );
}

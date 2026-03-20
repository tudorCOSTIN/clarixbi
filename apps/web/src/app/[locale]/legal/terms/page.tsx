'use client';

import { useTranslations } from 'next-intl';

export default function TermsPage() {
  const t = useTranslations('legal.terms');

  return (
    <article className="prose prose-gray max-w-none">
      <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-800">{t('draft')}</p>
      </div>

      <h1 className="text-2xl font-bold text-dark-navy">{t('title')}</h1>
      <p className="text-sm text-gray-500">{t('lastUpdated')}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('definitions.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('definitions.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('services.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('services.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('userObligations.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('userObligations.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('intellectualProperty.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">
          {t('intellectualProperty.content')}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('limitation.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('limitation.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('termination.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('termination.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('governingLaw.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('governingLaw.content')}</p>
      </section>
    </article>
  );
}

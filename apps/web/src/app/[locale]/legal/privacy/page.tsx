'use client';

import { useTranslations } from 'next-intl';

export default function PrivacyPage() {
  const t = useTranslations('legal.privacy');

  return (
    <article className="prose prose-gray max-w-none">
      <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-800">{t('draft')}</p>
      </div>

      <h1 className="text-2xl font-bold text-dark-navy">{t('title')}</h1>
      <p className="text-sm text-gray-500">{t('lastUpdated')}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('controller.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('controller.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('dataCollected.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('dataCollected.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('legalBasis.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('legalBasis.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('retention.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('retention.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('rights.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('rights.intro')}</p>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>{t('rights.access')}</li>
          <li>{t('rights.rectification')}</li>
          <li>{t('rights.erasure')}</li>
          <li>{t('rights.portability')}</li>
          <li>{t('rights.restriction')}</li>
          <li>{t('rights.objection')}</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('transfers.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('transfers.content')}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark-navy">{t('contact.title')}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t('contact.content')}</p>
      </section>
    </article>
  );
}

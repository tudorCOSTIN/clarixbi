import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('common');

  return (
    <main className="flex min-h-screen items-center justify-center bg-dark-navy">
      <h1 className="text-4xl font-bold text-white">{t('comingSoon')}</h1>
    </main>
  );
}

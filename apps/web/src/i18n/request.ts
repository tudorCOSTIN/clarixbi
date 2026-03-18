import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

const messageImports = {
  ro: () => import('../../messages/ro.json'),
  en: () => import('../../messages/en.json'),
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as 'ro' | 'en')) {
    locale = routing.defaultLocale;
  }

  const validLocale = locale as keyof typeof messageImports;

  return {
    locale,
    messages: (await messageImports[validLocale]()).default,
  };
});

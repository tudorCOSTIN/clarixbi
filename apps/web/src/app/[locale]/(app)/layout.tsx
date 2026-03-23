'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Home,
  LayoutDashboard,
  Database,
  Sparkles,
  FileText,
  Bell,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { AiUsageBadge } from '@/components/ai/AiUsageBadge';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const navLinks = [
  { href: '/', labelKey: 'home', icon: Home },
  { href: '/dashboards', labelKey: 'dashboards', icon: LayoutDashboard },
  { href: '/data-sources', labelKey: 'dataSources', icon: Database },
  { href: '/reports', labelKey: 'reports', icon: FileText },
  { href: '/alerts', labelKey: 'alerts', icon: Bell },
  { href: '/ai', labelKey: 'aiAssistant', icon: Sparkles },
  { href: '/settings', labelKey: 'settings', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Strip locale prefix for comparison
  const currentPath = pathname.replace(/^\/[a-z]{2}/, '') || '/';

  const navContent = navLinks.map((link) => {
    const Icon = link.icon;
    const isActive = link.href === '/' ? currentPath === '/' : currentPath.startsWith(link.href);

    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          isActive
            ? 'text-primary-blue font-semibold bg-blue-50'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon className="h-4 w-4" />
        {link.labelKey === 'aiAssistant' ? (
          <>
            <span>{t('aiAssistant')}</span>
            <AiUsageBadge />
          </>
        ) : (
          t(link.labelKey)
        )}
      </Link>
    );
  });

  const tA11y = useTranslations('a11y');

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-primary-blue focus:underline focus:rounded"
      >
        {tA11y('skipToContent')}
      </a>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
          <Link href="/" className="text-lg font-bold text-dark-navy mr-8">
            ClarixBI
          </Link>
          <nav className="hidden md:flex items-center gap-1 flex-1">{navContent}</nav>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
            <button
              className="md:hidden p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t('close') : t('menu')}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-gray-100 px-4 py-2 space-y-1">{navContent}</nav>
        )}
      </header>
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-4 sm:flex-row sm:justify-between">
          <span className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} ClarixBI SRL
          </span>
          <div className="flex items-center gap-6">
            <Link
              href="/legal/terms"
              className="text-xs text-gray-500 hover:text-gray-600 transition-colors"
            >
              {t('terms')}
            </Link>
            <Link
              href="/legal/privacy"
              className="text-xs text-gray-500 hover:text-gray-600 transition-colors"
            >
              {t('privacy')}
            </Link>
            <Link
              href="/legal/cookies"
              className="text-xs text-gray-500 hover:text-gray-600 transition-colors"
            >
              {t('cookies')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

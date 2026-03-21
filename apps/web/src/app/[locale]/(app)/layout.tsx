'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Database, Sparkles, FileText, Bell, Settings } from 'lucide-react';
import { AiUsageBadge } from '@/components/ai/AiUsageBadge';

const navLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/data-sources', label: 'Data Sources', icon: Database },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/ai', label: 'AI Assistant', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Strip locale prefix for comparison
  const currentPath = pathname.replace(/^\/[a-z]{2}/, '') || '/';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
          <Link href="/" className="text-lg font-bold text-dark-navy mr-8">
            ClarixBI
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === '/' ? currentPath === '/' : currentPath.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary-blue font-semibold bg-blue-50'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label === 'AI Assistant' ? (
                    <>
                      <span>AI Assistant</span>
                      <AiUsageBadge />
                    </>
                  ) : (
                    link.label
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 px-4 py-4">
          <Link
            href="/legal/terms"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/legal/privacy"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/legal/cookies"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cookies
          </Link>
        </div>
      </footer>
    </div>
  );
}

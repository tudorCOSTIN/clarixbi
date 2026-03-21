'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, CreditCard, Users, Building2 } from 'lucide-react';

const settingsNav = [
  { href: '/settings', label: 'Profile', icon: User },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/team', label: 'Team', icon: Users },
  { href: '/settings/organization', label: 'Organization', icon: Building2 },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Strip locale prefix for matching
  const pathWithoutLocale = pathname.replace(/^\/(ro|en)/, '');

  return (
    <div className="flex gap-8">
      <nav className="w-48 shrink-0">
        <ul className="space-y-1">
          {settingsNav.map((item) => {
            const isActive =
              pathWithoutLocale === item.href ||
              (item.href !== '/settings' && pathWithoutLocale.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

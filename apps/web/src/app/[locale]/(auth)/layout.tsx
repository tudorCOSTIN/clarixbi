import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to ClarixBI to access your dashboards, reports, and AI-powered insights.',
  openGraph: {
    title: 'Sign In — ClarixBI',
    description: 'Sign in to access your business intelligence dashboards.',
    siteName: 'ClarixBI',
    type: 'website',
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-dark-navy via-slate-900 to-dark-navy">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}

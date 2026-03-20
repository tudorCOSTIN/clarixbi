import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Paths that don't require authentication
const publicPaths = ['/login', '/signup', '/callback', '/d/', '/legal'];

function isPublicPath(pathname: string): boolean {
  // Remove locale prefix (e.g., /ro/login → /login)
  const pathWithoutLocale = pathname.replace(/^\/(ro|en)/, '') || '/';
  return publicPaths.some((p) => pathWithoutLocale.startsWith(p));
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes and static assets
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Run intl middleware first
  const response = intlMiddleware(request);

  // Check auth for protected routes
  if (!isPublicPath(pathname)) {
    const accessToken = request.cookies.get('access_token')?.value;

    if (!accessToken) {
      const locale = pathname.match(/^\/(ro|en)/)?.[1] || 'ro';
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/(ro|en)/:path*'],
};

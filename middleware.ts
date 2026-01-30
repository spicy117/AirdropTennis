/**
 * Next.js middleware: extract subdomain for multi-tenant routing.
 * Use when serving the app from Next.js (e.g. *.servestream.com).
 *
 * Example: airdroptennis.servestream.com → subdomain = 'airdroptennis'
 * The subdomain is added to request headers so pages/API routes can read it.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROOT_HOSTS = ['localhost', '127.0.0.1', 'servestream.com'];

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? request.nextUrl.hostname;
  const subdomain = getSubdomain(host);

  const response = NextResponse.next();

  if (subdomain) {
    response.headers.set('x-subdomain', subdomain);
  }

  return response;
}

/**
 * Get subdomain from host.
 * Examples:
 *   airdroptennis.servestream.com → 'airdroptennis'
 *   www.servestream.com          → 'www'
 *   localhost                    → null
 */
export function getSubdomain(host: string): string | null {
  if (!host) return null;

  const lower = host.split(':')[0].toLowerCase();
  if (ROOT_HOSTS.some((h) => lower === h || lower.endsWith('.' + h))) {
    return null;
  }

  const parts = lower.split('.');
  if (parts.length >= 2) {
    return parts[0]; // first label is subdomain when host is e.g. sub.domain.com
  }

  return null;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};

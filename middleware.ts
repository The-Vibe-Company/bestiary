import { NextRequest, NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';

/**
 * Safely fetch the current session from Neon Auth.
 * Returns null when NEON_AUTH_BASE_URL is not configured so the app
 * can still boot (public pages remain accessible).
 */
async function getSession() {
  if (!process.env.NEON_AUTH_BASE_URL) {
    return null;
  }
  try {
    const { session } = await neonAuth();
    return session;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const isPublicRoute = pathname === '/' || pathname === '/sign-in' || pathname === '/sign-up';

  if (isPublicRoute) {
    // Check if user is already authenticated on auth pages
    if (pathname === '/sign-in' || pathname === '/sign-up') {
      const session = await getSession();
      if (session) {
        return NextResponse.redirect(new URL('/place', request.url));
      }
    }
    return NextResponse.next();
  }

  // Protected routes - check authentication
  const session = await getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};

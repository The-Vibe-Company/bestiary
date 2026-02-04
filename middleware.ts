import { NextRequest, NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const isPublicRoute = pathname === '/' || pathname === '/sign-in' || pathname === '/sign-up';

  if (isPublicRoute) {
    // Check if user is already authenticated on auth pages
    if (pathname === '/sign-in' || pathname === '/sign-up') {
      const { session } = await neonAuth();
      if (session) {
        return NextResponse.redirect(new URL('/village', request.url));
      }
    }
    return NextResponse.next();
  }

  // Protected routes - check authentication
  const { session } = await neonAuth();

  if (!session) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};

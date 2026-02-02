import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await getSession()

  // Protège /home
  if (pathname.startsWith('/home') && !session) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // Redirect si déjà connecté
  if ((pathname === '/sign-in' || pathname === '/sign-up') && session) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)']
}

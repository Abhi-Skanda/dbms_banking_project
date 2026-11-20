import { NextRequest, NextResponse } from 'next/server';

// Runs before every page request. Only checks that a session cookie EXISTS so
// signed-out visitors are sent to /login instantly. The real security check
// (is the session valid? which role?) happens in every API route.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api') || pathname === '/login') return NextResponse.next();
  if (!req.cookies.has('bank_session')) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

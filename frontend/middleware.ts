
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();

  console.log('Middleware executed for:', url.pathname);

  if (url.pathname === '/') {
    url.pathname = '/login';
    console.log('Redirecting to:', url.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
  ],
};

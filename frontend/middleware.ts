import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const accessToken = request.cookies.get('access_token');

  const protectedRoutes = ['/request', '/account', '/deals', '/mail']; // Add all protected routes here
  const authRoutes = ['/login', '/register'];

  // Redirect root to /request if authenticated, otherwise to /login
  if (url.pathname === '/') {
    if (accessToken) {
      url.pathname = '/request';
      return NextResponse.redirect(url);
    } else {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // If no access token and trying to access a protected route, redirect to login
  if (!accessToken && protectedRoutes.some(route => url.pathname.startsWith(route))) {
    url.pathname = '/login';
    // Optionally, add a 'next' query parameter to redirect back after login
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If access token exists and trying to access login or register page, redirect to /request
  if (accessToken && authRoutes.includes(url.pathname)) {
    url.pathname = '/request';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/request/:path*',
    '/account/:path*',
    '/deals/:path*',
    '/mail/:path*',
  ],
};
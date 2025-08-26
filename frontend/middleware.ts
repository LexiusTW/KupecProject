import { NextRequest, NextResponse } from 'next/server';

const publicPaths = ['/login', '/register', '/search', '/request', '/account'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;

  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));

  if (token && isPublicPath) {
    return NextResponse.redirect(new URL('/search', request.url));
  }

  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|images|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)',
  ],
};

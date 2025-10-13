import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_URL = "/api-proxy";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api-proxy")) {
    return NextResponse.next();
  }

  // Разрешаем всегда ходить на статику и иконки
  if (path.startsWith("/_next") || path.startsWith("/favicon.ico")) {
    return NextResponse.next();
  }

  // Проверяем access токен через бэкенд
  let isValid = false;
  try {
    // Используем внутренний адрес Docker-сервиса
    const verifyUrl = "http://backend:8000/api/v1/auth/verify";
    const res = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        // Передаем куки из изначального запроса
        cookie: req.headers.get("cookie") || "",
      },
    });

    if (res.ok) {
      isValid = true;
    }
  } catch (e) {
    console.error("[Middleware] Error fetching verify endpoint:", e);
  }

  // === 1. Корень ===
  if (path === "/") {
    return NextResponse.redirect(
      new URL(isValid ? "/request" : "/auth", req.url)
    );
  }

  // === 2. Нет токена или он невалиден ===
  if (!isValid) {
    if (
      path.startsWith("/auth") ||
      /^\/request\/[^/]+$/.test(path)
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  // === 3. Есть валидный токен ===
  if (path.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/request", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images|favicon.ico).*)"],
};
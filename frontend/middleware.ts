import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_URL = "https://kupecbek.cloudpub.ru";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Разрешаем всегда ходить на статику и иконки
  if (path.startsWith("/_next") || path.startsWith("/favicon.ico")) {
    return NextResponse.next();
  }

  // Проверяем access токен через бэкенд
  let isValid = false;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/verify`, {
      method: "GET",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
      credentials: "include",
    });

    if (res.ok) {
      isValid = true;
    }
  } catch (e) {
    console.error("Ошибка проверки токена:", e);
  }

  // === 1. Корень ===
  if (path === "/") {
    return NextResponse.redirect(
      new URL(isValid ? "/request" : "/login", req.url)
    );
  }

  // === 2. Нет токена или он невалиден ===
  if (!isValid) {
    if (
      path.startsWith("/login") ||
      path.startsWith("/register") ||
      /^\/request\/[^/]+$/.test(path)
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // === 3. Есть валидный токен ===
  if (path.startsWith("/login") || path.startsWith("/register")) {
    return NextResponse.redirect(new URL("/request", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images|favicon.ico).*)"],
};
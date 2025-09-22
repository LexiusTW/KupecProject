"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Container } from "../Container/Container";
import { Button } from "../../ui/Button/Button";

import css from "./Header.module.css";

const API_BASE_URL = "https://ekbmetal.cloudpub.ru";

const LINKS = [
  {
    href: "/search",
    text: "Поиск",
  },
  {
    href: "/account",
    text: "Личный кабинет",
  },
  {
    href: "/mail",
    text: "Почта",
  },
  {
    href: "/request",
    text: "Оставить заявку",
  },
].map((link, index) => ({ ...link, id: index + 1 }));

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isAuthPage =
    pathname?.startsWith("/login") || pathname?.startsWith("/register");

  // const isAuthPage = false;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch(`${API_BASE_URL}/api/v1/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
    } finally {
      setIsLoggingOut(false);
      router.push("/login");
    }
  };

  return (
    <header className={css.box}>
      <Container>
        <div className={css.inner}>
          <div className={css.img}>
            <Image src="/images/logo.png" alt="PromTrade Logo" fill priority />
          </div>

          {!isAuthPage ? (
            <div className={css.menu}>
              <nav className={css.links}>
                {LINKS.map((link) => (
                  <Link href={link.href} key={link.id} className={css.link}>
                    {link.text}
                  </Link>
                ))}
              </nav>

              <div className={css.btns}>
                <Button
                  type="button"
                  variant='outline'
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  text={isLoggingOut ? "Выходим…" : "Выйти"}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Container>
    </header>
  );
}

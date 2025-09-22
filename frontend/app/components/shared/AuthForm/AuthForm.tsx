"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import type { AuthFormData } from "../../types";

import { Input } from "../../base/Input/Input";
import { Button } from "../../ui/Button/Button";

import css from "./AuthForm.module.css";

const API_BASE_URL = "https://ekbmetal.cloudpub.ru";

export default function AuthForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const checkingRef = useRef(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormData>();

  useEffect(() => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/v1/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (r.ok) {
          const nextUrl = searchParams.get("next") || "/search";
          router.replace(nextUrl);
        }
      } catch {}
    })();
  }, [router]);

  const onSubmit: SubmitHandler<AuthFormData> = async (data) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login: data.login, password: data.password }),
      });

      if (!response.ok) {
        const er = await response.json().catch(() => ({}));
        throw new Error(er.detail || "Неверный логин или пароль");
      }

      const nextUrl = searchParams.get("next") || "/search";
      router.push(nextUrl);
    } catch (e: any) {
      setError(e.message || "Ошибка входа. Попробуйте снова.");
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className={css.box}>
      <form onSubmit={handleSubmit(onSubmit)} className={css.form}>
        <div className={css.inputs}>
          <Input<AuthFormData>
            label="Логин"
            name="login"
            type="text"
            placeholder="Введите логин"
            register={register}
            error={errors.login}
            required="Логин обязателен"
          />

          <Input<AuthFormData>
            label="Пароль"
            name="password"
            type="password"
            placeholder="Введите пароль"
            register={register}
            error={errors.password}
            required="Пароль обязателен"
          />
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <Button
          variant="orange"
          type="submit"
          disabled={isLoading}
          text={isLoading ? "Входим..." : "Войти"}
        />

        <footer className={css.footer}>
          <p className={css.p1}>
            Нет аккаунта?{" "}

            <Link
              href="/register"
              className={css.link}
            >
              Зарегистрироваться
            </Link>
          </p>
        </footer>
      </form>
    </div>
  );
}

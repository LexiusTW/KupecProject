"use client";

import RegisterForm from "../components/shared/RegisterForm/RegisterForm";
import { Container } from "../components/base/Container/Container";

import { rc } from "../utils/rc";

import css from "./page.module.css";

export default function RegisterPage() {
  return (
    <section className={css.section}>
      <Container>
        <div className={css.inner}>
          <div className={css.box}>
            <h1 className="h1">Регистрация</h1>

            <p className={rc(['p1', css.p1])}>
              Создайте новый аккаунт покупателя или продавца
            </p>
          </div>

          <RegisterForm />
        </div>
      </Container>
    </section>
  );
}

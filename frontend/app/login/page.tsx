"use client";

import AuthForm from "../components/shared/AuthForm/AuthForm";
import Footer from "../components/base/Footer/Footer";
import Header from "../components/base/Header/Header";
import { Container } from "../components/base/Container/Container";

import { rc } from "../utils/rc";

import css from "./page.module.css";

export default function LoginPage() {
  return (
    <section className={css.section}>
      <Container className={css["container-auth"]}>
        <div className={css.inner}>
          <h1 className={rc(["h1", css["text-center"]])}>Вход в систему</h1>

          <AuthForm />
        </div>
      </Container>
    </section>
  );
}

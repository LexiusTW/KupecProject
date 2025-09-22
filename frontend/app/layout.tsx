// ✅ ОБНОВЛЁННЫЙ ФАЙЛ layout.tsx — переименован в "PromTrade"

import type { Metadata } from "next";
import { Geist, Geist_Mono, Pacifico } from "next/font/google";

import Header from "./components/base/Header/Header";
import Footer from "./components/base/Footer/Footer";

import "./globals.css";
import css from './layout.module.css'

const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pacifico",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Купец",
  description: "Поиск металлоконструкций по параметрам",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pacifico.variable} antialiased`}
      >
        <div className={css.wrapper}>
          <Header />

          <div className={css.main}>{children}</div>

          <Footer />
        </div>
      </body>
    </html>
  );
}

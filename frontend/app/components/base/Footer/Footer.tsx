"use client";

import Link from "next/link";

import { rc } from "@/app/utils/rc";

import { Container } from "../Container/Container";

import css from "./Footer.module.css";

const LINKS = [
  {
    title: 'ООО "Купец"',
    items: [
      {
        text: "ИНН: 1234567890",
      },
      {
        text: "ОГРН: 1234567890123",
      },
      {
        text: "г. Екатеринбург, ул. Металлургов, д. 1",
      },
    ],
  },
  {
    title: "Документация",
    items: [
      {
        text: "ГОСТы и ТУ",
        link: "/gosts",
      },
      {
        text: "Шаблонные договоры",
        link: "/contracts",
      },
    ],
  },
  {
    title: "Информация",
    items: [
      {
        text: `© ${new Date().getFullYear()} Купец. Все права защищены.`,
      },
    ],
  },
].map((link, index) => ({ ...link, id: index + 1 }));

export default function Footer() {
  return (
    <footer className={css.box}>
      <Container>
        <div className={css.inner}>
          {LINKS.map((box) => (
            <div className={css.block} key={box.id}>
              <p className={rc(["p1", css["text-head"]])}>{box.title}</p>

              {box.items.length > 0 && (
                <ul className={css.list}>
                  {box.items.map((item, index) => (
                    <li className={css.link} key={index}>
                      {"link" in item ? (
                        <Link href={item.link} className={css['link-href']}>
                          {item.text}
                        </Link>
                      ) : (
                        <span className={css.text}>{item.text}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Container>
    </footer>
  );
}

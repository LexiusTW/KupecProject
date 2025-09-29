"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PasswordSnakeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function PasswordSnakeInput({ value, onChange, placeholder }: PasswordSnakeInputProps) {
  const [show, setShow] = useState(false);

  const toggleShow = () => setShow((prev) => !prev);

  return (
    <div className="relative flex items-center w-full">
      {/* Сам input */}
      <input
        type="text" // всегда text, чтобы работал курсор
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-10 rounded-md border border-gray-300 shadow-sm font-mono text-lg bg-white relative z-10 tracking-widest text-transparent caret-black selection:bg-blue-300 focus:ring-amber-500 focus:border-amber-500"
      />

      {/* Анимационный слой поверх текста */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-0.5 font-mono text-lg pointer-events-none z-20">
        {value.split("").map((char, i) => (
          <span
            key={i}
            className="relative w-4 h-6 overflow-hidden flex justify-center"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={show ? char + i : "*" + i}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{
                  duration: 0.25,
                  delay: i * 0.04,
                }}
                className="absolute"
              >
                {show ? char : "•"}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}

        {value.length === 0 && (
          <span className="text-gray-400">{placeholder}</span>
        )}
      </div>

      {/* Кнопка-глаз */}
      {value && (
        <button
            type="button"
            onClick={toggleShow}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 z-30"
        >
            <i className={show ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
        </button>
      )}
    </div>
  );
}

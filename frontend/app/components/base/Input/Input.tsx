"use client";

import {
  UseFormRegister,
  FieldError,
  FieldValues,
  Path,
} from "react-hook-form";

import { rc } from "@/app/utils/rc";

import css from './Input.module.css';

type InputProps<T extends FieldValues> = {
  label: string;
  name: Path<T>;
  type?: string;
  register: UseFormRegister<T>;
  error?: FieldError;
  required?: boolean | string;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
};

export const Input = <T extends FieldValues>({
  label,
  name,
  type = "text",
  register,
  error,
  required = false,
  placeholder,
  className = "",
  labelClassName = "",
  inputClassName = "",
  errorClassName = "",
}: InputProps<T>) => {
  return (
    <div className={rc([className, css.box])}>
      <label htmlFor={name} className={rc([labelClassName, css.label])}>
        {label}
      </label>

      <input
        id={name}
        type={type}
        {...register(
          name,
          typeof required === "boolean"
            ? { required: required ? `${label} обязателен` : false }
            : { required }
        )}
        placeholder={placeholder}
        className={rc([inputClassName, css.input])}
      />

      {error && <p className={rc([errorClassName, css.error])}>{error.message}</p>}
    </div>
  );
};

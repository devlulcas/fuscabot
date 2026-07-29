import type { ComponentPropsWithoutRef } from "react";
import css from "./form.module.css";

export function Form({
  className,
  ...props
}: ComponentPropsWithoutRef<"form">) {
  return (
    <form
      {...props}
      className={`${css.form}${className ? ` ${className}` : ""}`}
    />
  );
}

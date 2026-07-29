import type { ComponentPropsWithoutRef } from "react";
import css from "./button.module.css";

type ButtonVariant = "secondary" | "primary" | "danger" | "ghost";

export function Button({
  variant = "secondary",
  size = "default",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: "default" | "compact";
}) {
  return (
    <button
      {...props}
      className={`${css.button} ${css[variant]}${
        size === "compact" ? ` ${css.compact}` : ""
      }${className ? ` ${className}` : ""}`}
    />
  );
}

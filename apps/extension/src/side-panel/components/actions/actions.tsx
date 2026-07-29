import type { ComponentPropsWithoutRef } from "react";
import css from "./actions.module.css";

export function Actions({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`${css.actions}${className ? ` ${className}` : ""}`}
    />
  );
}

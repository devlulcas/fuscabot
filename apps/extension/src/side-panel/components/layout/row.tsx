import type { ComponentPropsWithoutRef } from "react";
import css from "./row.module.css";

export function Row({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`${css.row}${className ? ` ${className}` : ""}`}
    />
  );
}

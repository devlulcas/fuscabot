import type { ComponentPropsWithoutRef } from "react";
import css from "./list.module.css";

export function List({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`${css.list}${className ? ` ${className}` : ""}`}
    />
  );
}

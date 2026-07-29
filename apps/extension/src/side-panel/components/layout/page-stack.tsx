import type { ComponentPropsWithoutRef } from "react";
import css from "./page-stack.module.css";

export function PageStack({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`${css.stack}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

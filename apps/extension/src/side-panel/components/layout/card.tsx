import type { HTMLAttributes, ReactNode } from "react";
import css from "./card.module.css";

export function Card({
  as = "div",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article";
  children: ReactNode;
}) {
  const Component = as;
  return (
    <Component
      {...props}
      className={`${css.card}${className ? ` ${className}` : ""}`}
    >
      {children}
    </Component>
  );
}

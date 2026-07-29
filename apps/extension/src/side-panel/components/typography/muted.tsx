import type { ReactNode } from "react";
import css from "./muted.module.css";

export function Muted({
  as = "p",
  children,
  className,
  href,
  target,
  rel,
}: {
  as?: "p" | "span" | "a";
  children: ReactNode;
  className?: string;
  href?: string;
  target?: string;
  rel?: string;
}) {
  const classNames = `${css.muted}${className ? ` ${className}` : ""}`;
  if (as === "a") {
    return (
      <a className={classNames} href={href} target={target} rel={rel}>
        {children}
      </a>
    );
  }
  if (as === "span") return <span className={classNames}>{children}</span>;
  return <p className={classNames}>{children}</p>;
}

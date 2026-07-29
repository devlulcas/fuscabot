import type { ReactNode } from "react";
import css from "./status-badge.module.css";

type StatusVariant = "default" | "ready" | "failed" | "public";

export function StatusBadge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: StatusVariant;
}) {
  return <span className={`${css.badge} ${css[variant]}`}>{children}</span>;
}

import type { ReactNode } from "react";
import css from "./eyebrow.module.css";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={css.eyebrow}>{children}</p>;
}

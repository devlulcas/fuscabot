import { Link, type LinkProps } from "react-router-dom";
import css from "./button-link.module.css";

export function ButtonLink(
  { className, size = "default", ...props }: LinkProps & {
    size?: "default" | "compact";
  },
) {
  return (
    <Link
      {...props}
      className={`${css.buttonLink}${
        size === "compact" ? ` ${css.compact}` : ""
      }${className ? ` ${className}` : ""}`}
    />
  );
}

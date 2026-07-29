import { NavLink, Outlet } from "react-router-dom";
import { DiamondIcon } from "../components/icons/icons.tsx";
import css from "./app-shell.module.css";

const links = [
  ["/capture", "Capture"],
  ["/library", "Library"],
  ["/channels", "Channels"],
  ["/tags", "Tags"],
  ["/settings", "Settings"],
] as const;

export function AppShell() {
  return (
    <>
      <a className={css.skipLink} href="#main">Skip to content</a>
      <header className={css.header}>
        <strong className={css.brand}>
          <DiamondIcon /> Fuscabot
        </strong>
        <nav aria-label="Main">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive ? css.active : undefined}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className={css.main}>
        <Outlet />
      </main>
    </>
  );
}

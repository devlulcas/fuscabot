import { NavLink, Outlet } from "react-router-dom";
import styles from "./app-shell.module.css";

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
      <a className={styles.skipLink} href="#main">Skip to content</a>
      <header className={styles.header}>
        <strong className={styles.brand}>
          <span aria-hidden="true">◆</span> Fuscabot
        </strong>
        <nav aria-label="Main">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive ? styles.active : undefined}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}

import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

import styles from "./Layout.module.css";
import { createCx } from "../styles";

const cx = createCx(styles);

type LayoutProps = {
  children: ReactNode;
  cartCount: number;
};

export function Layout({ children, cartCount }: LayoutProps) {
  return (
    <div className={cx("app-shell")}>
      <div className={cx("frame")}>
        <header className={cx("topbar")}>
          <NavLink className={cx("brand")} to="/catalog" aria-label="LampFactory Store">
            <span className={cx("brand-mark")} aria-hidden="true" />
            <span>LampFactory Store</span>
          </NavLink>
          <nav className={cx("nav-row")} aria-label="Основная навигация">
            <NavLink className={({ isActive }) => cx("pill", isActive && "active")} to="/catalog">
              Каталог
            </NavLink>
            <NavLink className={({ isActive }) => cx("icon-pill", isActive && "active")} to="/cart">
              Корзина <strong>{cartCount}</strong>
            </NavLink>
            <NavLink className={cx("pill")} to="/admin">
              Админка
            </NavLink>
          </nav>
        </header>
        <main className={cx("content")}>{children}</main>
      </div>
    </div>
  );
}

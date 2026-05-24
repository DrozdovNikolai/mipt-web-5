import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { logoutAdminApi } from "../api";
import { clearAdminSession, loadAdminSession } from "../adminSession";
import { cx } from "../styles";

type AdminLayoutProps = {
  children: ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const session = loadAdminSession();

  function handleLogout() {
    if (session) {
      void logoutAdminApi(session).catch(() => undefined);
    }
    clearAdminSession();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className={cx("app-shell")}>
      <div className={cx("frame", "admin-shell")}>
        <aside className={cx("sidebar")}>
          <NavLink className={cx("brand")} to="/admin" aria-label="LampFactory Admin">
            <span className={cx("brand-mark")} aria-hidden="true" />
            <span>Admin</span>
          </NavLink>
          <nav className={cx("admin-nav")} aria-label="Навигация панели управления">
            <NavLink className={({ isActive }) => cx("pill", isActive && "active")} end to="/admin">
              Обзор
            </NavLink>
            <NavLink className={({ isActive }) => cx("pill", isActive && "active")} to="/admin/products">
              Товары
            </NavLink>
            <NavLink className={({ isActive }) => cx("pill", isActive && "active")} to="/admin/orders">
              Заказы
            </NavLink>
            <NavLink className={cx("pill")} to="/catalog">
              Витрина
            </NavLink>
          </nav>
          <div className={cx("sidebar-footer")}>
            <span className={cx("tiny")}>{session?.user.username}</span>
            <button className={cx("btn-ghost")} type="button" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </aside>
        <main className={cx("admin-main")}>{children}</main>
      </div>
    </div>
  );
}

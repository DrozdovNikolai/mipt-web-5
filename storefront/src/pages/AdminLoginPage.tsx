import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { loginAdminApi } from "../api";
import { saveAdminSession } from "../adminSession";
import { cx } from "../styles";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("manager@lampfactory.local");
  const [password, setPassword] = useState("StrongPassword123");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const session = await loginAdminApi(username, password);
      saveAdminSession(session);
      const redirectTo = typeof location.state === "object" && location.state !== null
        ? (location.state as { from?: string }).from
        : undefined;
      navigate(redirectTo ?? "/admin", { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось войти");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cx("app-shell")}>
      <div className={cx("frame", "login-frame")}>
        <form className={cx("login-wrap")} onSubmit={handleSubmit}>
          <div className={cx("center")}>
            <div className={cx("brand", "center-brand")}>
              <span className={cx("brand-mark")} aria-hidden="true" />
              <span>LampFactory Admin</span>
            </div>
            <span className={cx("tag")}>Back-office</span>
            <h1>Вход в панель управления</h1>
            <p className={cx("muted")}>Доступ для администратора магазина.</p>
          </div>

          <div className={cx("form-grid", "single-column")}>
            <label className={cx("field")}>
              <span>Email</span>
              <input className={cx("input")} value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className={cx("field")}>
              <span>Пароль</span>
              <input
                className={cx("input")}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>

          {error ? <p className={cx("status", "danger")}>{error}</p> : null}

          <div className={cx("actions-inline", "center-actions")}>
            <button className={cx("btn")} type="submit" disabled={isLoading}>
              {isLoading ? "Входим..." : "Войти"}
            </button>
            <Link className={cx("btn-ghost")} to="/catalog">
              На витрину
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

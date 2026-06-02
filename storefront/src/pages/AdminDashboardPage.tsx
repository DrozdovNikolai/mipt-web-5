import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAdminDashboardApi } from "../api";
import { loadAdminSession } from "../adminSession";
import styles from "./AdminDashboardPage.module.css";
import { createCx } from "../styles";
import type { AdminDashboardSummary } from "../types";

const cx = createCx(styles);

export function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = loadAdminSession();
    if (!session) {
      return;
    }

    fetchAdminDashboardApi(session.accessToken)
      .then(setSummary)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить данные");
      });
  }, []);

  return (
    <>
      <div className={cx("page-title")}>
        <div>
          <h1>Панель управления</h1>
          <p className={cx("muted")}>Товары, заказы и статусы магазина.</p>
        </div>
        <div className={cx("actions-inline")}>
          <Link className={cx("btn")} to="/admin/products/new">
            Добавить товар
          </Link>
          <Link className={cx("btn-ghost")} to="/admin/orders">
            Открыть заказы
          </Link>
        </div>
      </div>

      {error ? <p className={cx("status", "danger")}>{error}</p> : null}

      <section className={cx("metrics-grid")}>
        <article className={cx("metric")}>
          <span>Активные товары</span>
          <strong>{summary?.activeProducts ?? "-"}</strong>
        </article>
        <article className={cx("metric")}>
          <span>Заказы сегодня</span>
          <strong>{summary?.ordersToday ?? "-"}</strong>
        </article>
        <article className={cx("metric")}>
          <span>Новые</span>
          <strong>{summary?.newOrders ?? "-"}</strong>
        </article>
        <article className={cx("metric")}>
          <span>Выручка</span>
          <strong>
            {summary
              ? new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(
                  summary.revenueTotal,
                )
              : "-"}
          </strong>
        </article>
      </section>

      <section className={cx("layout", "dashboard-grid")}>
        <div className={cx("panel")}>
          <h3>Последние заказы</h3>
          <ul className={cx("detail-list")}>
            {(summary?.recentOrders ?? []).map((order) => (
              <li key={order.id}>
                <span>{order.orderNumber}</span>
                <strong>{order.orderStatus}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className={cx("panel")}>
          <h3>Последние действия</h3>
          <ul className={cx("detail-list")}>
            {(summary?.recentActions ?? []).map((action) => (
              <li key={action.id}>
                <span>{action.action}</span>
                <strong>{action.responseCode}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

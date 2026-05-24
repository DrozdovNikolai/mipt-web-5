import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAdminOrdersApi, updateAdminOrderStatusApi } from "../api";
import { loadAdminSession } from "../adminSession";
import { cx } from "../styles";
import type { Order, OrderSummary } from "../types";

const statusLabels: Record<Order["orderStatus"], string> = {
  new: "Новый",
  confirmed: "Подтвержден",
  assembling: "Сборка",
  shipped: "Отправлен",
  delivered: "Доставлен",
  canceled: "Отменен",
};

const nextStatuses: Record<Order["orderStatus"], Order["orderStatus"][]> = {
  new: ["new", "confirmed", "canceled"],
  confirmed: ["confirmed", "assembling", "canceled"],
  assembling: ["assembling", "shipped"],
  shipped: ["shipped", "delivered"],
  delivered: ["delivered"],
  canceled: ["canceled"],
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Order["orderStatus"] | "">("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return orders;
    }
    return orders.filter((order) =>
      [order.orderNumber, order.customerName, order.customerEmail, order.customerPhone].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [orders, search]);

  async function loadOrders() {
    const session = loadAdminSession();
    if (!session) {
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await fetchAdminOrdersApi(session.accessToken, { status: statusFilter });
      setOrders(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить заказы");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(order: OrderSummary, status: Order["orderStatus"]) {
    const session = loadAdminSession();
    if (!session || status === order.orderStatus) {
      return;
    }
    setError("");
    setUpdatingOrderId(order.id);
    try {
      const updatedOrder = await updateAdminOrderStatusApi(session.accessToken, order.id, status);
      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                orderStatus: updatedOrder.orderStatus,
                paymentStatus: updatedOrder.paymentStatus,
                updatedAt: updatedOrder.updatedAt,
              }
            : item,
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось изменить статус");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [statusFilter]);

  return (
    <>
      <div className={cx("page-title")}>
        <div>
          <h1>Заказы</h1>
          <p className={cx("muted")}>Список клиентских заказов и обработка статусов.</p>
        </div>
        <div className={cx("actions-inline")}>
          <label className={cx("field", "compact-field")}>
            <span>Поиск</span>
            <input className={cx("input")} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className={cx("field", "compact-field")}>
            <span>Статус</span>
            <select
              className={cx("select")}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Order["orderStatus"] | "")}
            >
              <option value="">Все</option>
              {Object.entries(statusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <p className={cx("status", "danger")}>{error}</p> : null}

      <section className={cx("panel", "table-panel")}>
        <div className={cx("table-scroll")}>
          <table className={cx("table")}>
            <thead>
              <tr>
                <th>Номер</th>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Сумма</th>
                <th>Оплата</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/admin/orders/${order.id}`}>
                      <strong>{order.orderNumber}</strong>
                    </Link>
                    <span className={cx("tiny")}>{order.itemsCount} поз.</span>
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    <strong>{order.customerName}</strong>
                    <span className={cx("tiny")}>{order.customerPhone}</span>
                  </td>
                  <td>{formatMoney(order.totalAmount)}</td>
                  <td>
                    <span className={cx("status", order.paymentStatus === "paid" ? "success" : "warning")}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <select
                      className={cx("select", "status-select")}
                      value={order.orderStatus}
                      disabled={updatingOrderId === order.id}
                      onChange={(event) => void handleStatusChange(order, event.target.value as Order["orderStatus"])}
                    >
                      {nextStatuses[order.orderStatus].map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!isLoading && visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={6}>Заказы не найдены</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {isLoading ? <p className={cx("muted")}>Загрузка...</p> : null}
      </section>
    </>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  fetchAdminOrderApi,
  updateAdminOrderManagerCommentApi,
  updateAdminOrderPaymentStatusApi,
  updateAdminOrderStatusApi,
} from "../api";
import { loadAdminSession } from "../adminSession";
import styles from "./AdminOrderDetailsPage.module.css";
import { createCx } from "../styles";
import type { Order } from "../types";

const cx = createCx(styles);

const statusLabels: Record<Order["orderStatus"], string> = {
  new: "Новый",
  confirmed: "Подтвержден",
  assembling: "Сборка",
  shipped: "Отправлен",
  delivered: "Доставлен",
  canceled: "Отменен",
};

const paymentLabels: Record<Order["paymentStatus"], string> = {
  pending: "Ожидает",
  paid: "Оплачен",
  failed: "Ошибка",
  refunded: "Возврат",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

export function AdminOrderDetailsPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadOrder() {
    const session = loadAdminSession();
    if (!session || !orderId) {
      return;
    }
    setError("");
    try {
      const response = await fetchAdminOrderApi(session.accessToken, orderId);
      setOrder(response);
      setComment(response.managerComment ?? "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить заказ");
    }
  }

  async function updateOrderStatus(status: Order["orderStatus"]) {
    const session = loadAdminSession();
    if (!session || !order || status === order.orderStatus) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      setOrder(await updateAdminOrderStatusApi(session.accessToken, order.id, status));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось изменить статус");
    } finally {
      setIsSaving(false);
    }
  }

  async function updatePaymentStatus(paymentStatus: Order["paymentStatus"]) {
    const session = loadAdminSession();
    if (!session || !order || paymentStatus === order.paymentStatus) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      setOrder(await updateAdminOrderPaymentStatusApi(session.accessToken, order.id, paymentStatus));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось изменить оплату");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveComment() {
    const session = loadAdminSession();
    if (!session || !order) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      setOrder(await updateAdminOrderManagerCommentApi(session.accessToken, order.id, comment));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить комментарий");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  if (!order) {
    return (
      <section className={cx("panel", "empty-state")}>
        <p className={cx("muted")}>{error || "Загрузка заказа..."}</p>
        <Link className={cx("btn-ghost")} to="/admin/orders">
          К списку заказов
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className={cx("page-title")}>
        <div>
          <h1>Заказ {order.orderNumber}</h1>
          <p className={cx("muted")}>
            {order.customerName}, {order.customerPhone}
          </p>
        </div>
        <Link className={cx("btn-ghost")} to="/admin/orders">
          К списку заказов
        </Link>
      </div>

      {error ? <p className={cx("status", "danger")}>{error}</p> : null}

      <div className={cx("layout", "order-layout")}>
        <section className={cx("panel")}>
          <h3>Состав заказа</h3>
          <ul className={cx("detail-list")}>
            {order.items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.productNameSnapshot} x {item.quantity}
                </span>
                <strong>{formatMoney(item.lineTotal)}</strong>
              </li>
            ))}
            <li>
              <span>Доставка</span>
              <strong>{formatMoney(order.deliveryAmount)}</strong>
            </li>
            <li>
              <span>Итого</span>
              <strong>{formatMoney(order.totalAmount)}</strong>
            </li>
          </ul>
        </section>

        <section className={cx("panel", "admin-form")}>
          <h3>Обработка</h3>
          <label className={cx("field")}>
            <span>Статус заказа</span>
            <select
              className={cx("select")}
              value={order.orderStatus}
              disabled={isSaving}
              onChange={(event) => void updateOrderStatus(event.target.value as Order["orderStatus"])}
            >
              {Object.entries(statusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={cx("field")}>
            <span>Оплата</span>
            <select
              className={cx("select")}
              value={order.paymentStatus}
              disabled={isSaving}
              onChange={(event) => void updatePaymentStatus(event.target.value as Order["paymentStatus"])}
            >
              {Object.entries(paymentLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={cx("field")}>
            <span>Комментарий менеджера</span>
            <textarea className={cx("textarea")} value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          <button className={cx("btn")} type="button" disabled={isSaving} onClick={() => void saveComment()}>
            Сохранить комментарий
          </button>
        </section>
      </div>

      <section className={cx("panel", "history-panel")}>
        <h3>История статусов</h3>
        <ul className={cx("detail-list")}>
          {(order.statusHistory ?? []).map((item) => (
            <li key={item.id}>
              <span>
                {item.oldStatus ?? "start"} {"->"} {item.newStatus}
              </span>
              <strong>{item.changedBy}</strong>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

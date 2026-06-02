import { Link, useParams } from "react-router-dom";

import { formatMoney, loadLastOrder } from "../cart";
import styles from "./SuccessPage.module.css";
import { createCx } from "../styles";

const cx = createCx(styles);

export function SuccessPage() {
  const { orderNumber } = useParams();
  const order = loadLastOrder();
  const isCurrentOrder = order?.orderNumber === orderNumber;

  if (!order || !isCurrentOrder) {
    return (
      <div className={cx("panel", "empty-state")}>
        <h1>Заказ {orderNumber}</h1>
        <p className={cx("muted")}>Данные подтверждения не найдены в этом браузере.</p>
        <Link className={cx("btn")} to="/catalog">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  return (
    <>
      <section className={cx("success-banner")}>
        <span className={cx("status", "success")}>Заказ успешно создан</span>
        <h1>Заказ {order.orderNumber}</h1>
        <p className={cx("muted")}>
          Статус: <strong>{order.orderStatus}</strong>. Менеджер свяжется с клиентом для подтверждения деталей доставки.
        </p>
      </section>

      <div className={cx("order-layout")}>
        <section className={cx("panel")}>
          <h3>Состав заказа</h3>
          {order.items.map((item) => (
            <div className={cx("cart-row")} key={item.id}>
              <span className={cx("muted")}>
                {item.productNameSnapshot} x{item.quantity}
              </span>
              <strong>{formatMoney(item.lineTotal)}</strong>
            </div>
          ))}
          <div className={cx("summary-row", "total-row")}>
            <span>Итого</span>
            <strong>{formatMoney(order.totalAmount)}</strong>
          </div>
        </section>

        <section className={cx("panel")}>
          <h3>Контакты и доставка</h3>
          <ul className={cx("detail-list")}>
            <li>
              <span>Покупатель</span>
              <strong>{order.customerName}</strong>
            </li>
            <li>
              <span>Телефон</span>
              <strong>{order.customerPhone}</strong>
            </li>
            <li>
              <span>Email</span>
              <strong>{order.customerEmail}</strong>
            </li>
            <li>
              <span>Адрес</span>
              <strong>
                {order.deliveryCity}, {order.deliveryAddress}
              </strong>
            </li>
            <li>
              <span>Доставка</span>
              <strong>{order.deliveryMethod === "courier" ? "Курьер" : "Самовывоз"}</strong>
            </li>
          </ul>
        </section>
      </div>

      <div className={cx("actions-inline", "success-actions")}>
        <Link className={cx("btn")} to="/catalog">
          Вернуться в каталог
        </Link>
        <Link className={cx("btn-ghost")} to="/product/led-a60-7w-e27-3000k">
          Посмотреть похожие товары
        </Link>
      </div>
    </>
  );
}

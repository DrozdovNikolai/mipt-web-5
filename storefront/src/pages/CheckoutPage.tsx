import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { DELIVERY_PRICE, formatMoney } from "../cart";
import { cx } from "../styles";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearCart } from "../store/cartSlice";
import { createOrder } from "../store/ordersSlice";
import { loadProducts } from "../store/productsSlice";
import type { CheckoutForm } from "../types";

const initialForm: CheckoutForm = {
  customerName: "Иван Петров",
  customerPhone: "+7 999 123-45-67",
  customerEmail: "ivan.petrov@example.com",
  deliveryCity: "Москва",
  deliveryAddress: "ул. Академика Королева, д. 12, кв. 45",
  deliveryMethod: "courier",
  paymentMethod: "card_online",
  customerComment: "Позвоните за час до доставки.",
  personalDataAccepted: true,
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.cart.items);
  const productsById = useAppSelector((state) => state.products.byId);
  const orderStatus = useAppSelector((state) => state.orders.status);
  const orderError = useAppSelector((state) => state.orders.error);
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const hasMissingProducts = items.some((item) => !productsById[item.productId]);

  useEffect(() => {
    if (items.length > 0 && hasMissingProducts) {
      dispatch(loadProducts({ pageSize: 100 }));
    }
  }, [dispatch, items.length, hasMissingProducts]);

  const rows = useMemo(
    () =>
      items
        .map((item) => {
          const product = productsById[item.productId];
          return product ? { product, quantity: item.quantity, lineTotal: product.price * item.quantity } : null;
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [items, productsById],
  );

  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  if (rows.length === 0) {
    return <div className={cx("panel", "empty-state")}>Загрузка состава заказа...</div>;
  }

  const subtotal = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  const delivery = form.deliveryMethod === "pickup" ? 0 : DELIVERY_PRICE;
  const total = subtotal + delivery;

  const updateField = <T extends keyof CheckoutForm>(field: T, value: CheckoutForm[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.personalDataAccepted) return;

    try {
      const order = await dispatch(createOrder({ form, items })).unwrap();
      dispatch(clearCart());
      navigate(`/checkout/success/${order.orderNumber}`);
    } catch {
      // The rejected thunk stores a user-facing error in the orders slice.
    }
  };

  return (
    <>
      <div className={cx("page-title")}>
        <div>
          <h1>Оформление заказа</h1>
          <p className={cx("muted")}>Контакты, доставка, оплата и состав заказа</p>
        </div>
        <span className={cx("tag")}>Шаг 2 из 2</span>
      </div>

      <form className={cx("checkout-layout")} onSubmit={submitOrder}>
        <section className={cx("panel")}>
          <div className={cx("form-grid")}>
            <label className={cx("field")}>
              <span>Имя</span>
              <input
                className={cx("input")}
                required
                value={form.customerName}
                onChange={(event) => updateField("customerName", event.target.value)}
              />
            </label>
            <label className={cx("field")}>
              <span>Телефон</span>
              <input
                className={cx("input")}
                required
                value={form.customerPhone}
                onChange={(event) => updateField("customerPhone", event.target.value)}
              />
            </label>
            <label className={cx("field", "full")}>
              <span>Email</span>
              <input
                className={cx("input")}
                required
                type="email"
                value={form.customerEmail}
                onChange={(event) => updateField("customerEmail", event.target.value)}
              />
            </label>
            <label className={cx("field")}>
              <span>Город</span>
              <input
                className={cx("input")}
                required
                value={form.deliveryCity}
                onChange={(event) => updateField("deliveryCity", event.target.value)}
              />
            </label>
            <label className={cx("field")}>
              <span>Способ доставки</span>
              <select
                className={cx("select")}
                value={form.deliveryMethod}
                onChange={(event) =>
                  updateField("deliveryMethod", event.target.value as CheckoutForm["deliveryMethod"])
                }
              >
                <option value="courier">Курьер</option>
                <option value="pickup">Самовывоз</option>
              </select>
            </label>
            <label className={cx("field", "full")}>
              <span>Адрес доставки</span>
              <input
                className={cx("input")}
                required
                value={form.deliveryAddress}
                onChange={(event) => updateField("deliveryAddress", event.target.value)}
              />
            </label>
            <label className={cx("field")}>
              <span>Способ оплаты</span>
              <select
                className={cx("select")}
                value={form.paymentMethod}
                onChange={(event) =>
                  updateField("paymentMethod", event.target.value as CheckoutForm["paymentMethod"])
                }
              >
                <option value="card_online">Оплата картой онлайн</option>
                <option value="cash_on_delivery">Наличными при получении</option>
              </select>
            </label>
            <label className={cx("field", "checkbox-field")}>
              <span>Согласие</span>
              <span className={cx("checkbox-row", "input-like")}>
                <input
                  type="checkbox"
                  checked={form.personalDataAccepted}
                  onChange={(event) => updateField("personalDataAccepted", event.target.checked)}
                />
                <span>Согласен на обработку данных</span>
              </span>
            </label>
            <label className={cx("field", "full")}>
              <span>Комментарий</span>
              <textarea
                className={cx("textarea")}
                value={form.customerComment}
                onChange={(event) => updateField("customerComment", event.target.value)}
              />
            </label>
          </div>
        </section>

        <aside className={cx("panel", "summary-panel")}>
          <h3>Ваш заказ</h3>
          {rows.map(({ product, quantity, lineTotal }) => (
            <div className={cx("cart-row")} key={product.id}>
              <span className={cx("muted")}>
                {product.name} x{quantity}
              </span>
              <strong>{formatMoney(lineTotal)}</strong>
            </div>
          ))}
          <hr />
          <div className={cx("summary-row")}>
            <span className={cx("muted")}>Товары</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          <div className={cx("summary-row")}>
            <span className={cx("muted")}>Доставка</span>
            <strong>{formatMoney(delivery)}</strong>
          </div>
          <div className={cx("summary-row", "total-row")}>
            <span>Итого</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div className={cx("actions-inline")}>
            <button
              className={cx("btn")}
              type="submit"
              disabled={!form.personalDataAccepted || orderStatus === "loading"}
            >
              {orderStatus === "loading" ? "Создаем заказ..." : "Подтвердить заказ"}
            </button>
            <Link className={cx("btn-ghost")} to="/cart">
              Вернуться в корзину
            </Link>
          </div>
          {orderError ? <p className={cx("status", "danger")}>{orderError}</p> : null}
        </aside>
      </form>
    </>
  );
}

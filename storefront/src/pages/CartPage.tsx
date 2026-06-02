import { Link } from "react-router-dom";
import { useEffect } from "react";

import { DELIVERY_PRICE, formatMoney } from "../cart";
import { QuantityControl } from "../components/QuantityControl";
import styles from "./CartPage.module.css";
import { createCx } from "../styles";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { removeFromCart, updateQuantity } from "../store/cartSlice";
import { loadProducts } from "../store/productsSlice";

const cx = createCx(styles);

export function CartPage() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.cart.items);
  const productsById = useAppSelector((state) => state.products.byId);
  const hasMissingProducts = items.some((item) => !productsById[item.productId]);

  useEffect(() => {
    if (items.length > 0 && hasMissingProducts) {
      dispatch(loadProducts({ pageSize: 100 }));
    }
  }, [dispatch, items.length, hasMissingProducts]);

  const rows = items
    .map((item) => {
      const product = productsById[item.productId];
      return product ? { product, quantity: item.quantity, lineTotal: product.price * item.quantity } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const subtotal = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  const delivery = rows.length > 0 ? DELIVERY_PRICE : 0;
  const total = subtotal + delivery;

  if (rows.length === 0) {
    return (
      <div className={cx("panel", "empty-state")}>
        <h1>Корзина</h1>
        <p className={cx("muted")}>Корзина пока пустая.</p>
        <Link className={cx("btn")} to="/catalog">
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={cx("page-title")}>
        <div>
          <h1>Корзина</h1>
          <p className={cx("muted")}>Проверьте состав заказа перед оформлением</p>
        </div>
      </div>

      <div className={cx("cart-layout")}>
        <section className={cx("panel", "cart-panel")}>
          <div className={cx("cart-table")} role="table" aria-label="Состав корзины">
            <div className={cx("cart-table-head")} role="row">
              <span>Товар</span>
              <span>Цена</span>
              <span>Количество</span>
              <span>Сумма</span>
              <span />
            </div>
            {rows.map(({ product, quantity, lineTotal }) => (
              <div className={cx("cart-line")} role="row" key={product.id}>
                <div>
                  <Link className={cx("product-title")} to={`/product/${product.slug}`}>
                    {product.name}
                  </Link>
                  <span className={cx("tiny")}>{product.sku}</span>
                </div>
                <span>{formatMoney(product.price)}</span>
                <QuantityControl
                  value={quantity}
                  max={product.stockQty}
                  onChange={(value) =>
                    dispatch(updateQuantity({ productId: product.id, quantity: value, stockQty: product.stockQty }))
                  }
                />
                <strong>{formatMoney(lineTotal)}</strong>
                <button
                  className={cx("btn-ghost", "compact-button")}
                  type="button"
                  onClick={() => dispatch(removeFromCart(product.id))}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </section>

        <aside className={cx("panel", "summary-panel")}>
          <h3>Итог заказа</h3>
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
            <Link className={cx("btn")} to="/checkout">
              Оформить заказ
            </Link>
            <Link className={cx("btn-ghost")} to="/catalog">
              В каталог
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

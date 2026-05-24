import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { QuantityControl } from "../components/QuantityControl";
import { formatMoney } from "../cart";
import { cx } from "../styles";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addToCart } from "../store/cartSlice";
import { loadProductBySlug } from "../store/productsSlice";

export function ProductPage() {
  const { slug } = useParams();
  const dispatch = useAppDispatch();
  const { currentProduct, byId, detailStatus, error } = useAppSelector((state) => state.products);
  const [quantity, setQuantity] = useState(1);
  const product =
    currentProduct?.slug === slug
      ? currentProduct
      : Object.values(byId).find((item) => item.slug === slug) ?? null;

  useEffect(() => {
    if (slug) {
      dispatch(loadProductBySlug(slug));
      setQuantity(1);
    }
  }, [dispatch, slug]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return Object.values(byId)
      .filter((item) => item.id !== product.id && item.categorySlug === product.categorySlug)
      .slice(0, 3);
  }, [product, byId]);

  if (detailStatus === "loading" && !product) {
    return <div className={cx("panel", "empty-state")}>Загрузка товара...</div>;
  }

  if (!product || detailStatus === "failed") {
    return (
      <div className={cx("panel", "empty-state")}>
        <h1>Товар не найден</h1>
        {error ? <p className={cx("muted")}>{error}</p> : null}
        <Link className={cx("btn")} to="/catalog">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={cx("breadcrumbs")}>
        <Link to="/catalog">Каталог</Link>
        <span>/</span>
        <span>{product.category}</span>
        <span>/</span>
        <span>{product.name}</span>
      </div>

      <div className={cx("product-layout")}>
        <div className={cx("gallery")}>
          <div className={cx("gallery-image")}>
            <span>{product.socketType}</span>
          </div>
          <div className={cx("gallery-strip")}>
            <div className={cx("mini-image")} />
            <div className={cx("mini-image")} />
            <div className={cx("mini-image")} />
          </div>
        </div>

        <section className={cx("panel", "product-panel")}>
          <div className={cx("inline-row")}>
            <span className={cx("tag")}>{product.category}</span>
            <span className={cx("status", product.stockQty <= 10 ? "warning" : "success")}>
              В наличии: {product.stockQty}
            </span>
          </div>
          <h1>{product.name}</h1>
          <p className={cx("muted")}>SKU: {product.sku}</p>
          <div className={cx("price-row")}>
            <span>
              <span className={cx("price")}>{formatMoney(product.price)}</span>
              {product.oldPrice ? <span className={cx("old-price")}>{formatMoney(product.oldPrice)}</span> : null}
            </span>
            <span className={cx("tag")}>{product.colorTemperature}</span>
          </div>
          <p className={cx("muted")}>{product.description}</p>

          <ul className={cx("detail-list")}>
            <li>
              <span>Мощность</span>
              <strong>{product.powerWatts}W</strong>
            </li>
            <li>
              <span>Цоколь</span>
              <strong>{product.socketType}</strong>
            </li>
            <li>
              <span>Температура</span>
              <strong>{product.colorTemperature}</strong>
            </li>
            <li>
              <span>Световой поток</span>
              <strong>{product.luminousFlux} lm</strong>
            </li>
            <li>
              <span>Ресурс</span>
              <strong>{product.lifetimeHours.toLocaleString("ru-RU")} часов</strong>
            </li>
            <li>
              <span>Диммирование</span>
              <strong>{product.isDimmable ? "Да" : "Нет"}</strong>
            </li>
          </ul>

          <div className={cx("buy-row")}>
            <QuantityControl value={quantity} max={product.stockQty} onChange={setQuantity} />
            <button
              className={cx("btn")}
              type="button"
              onClick={() => dispatch(addToCart({ productId: product.id, quantity, stockQty: product.stockQty }))}
            >
              Добавить в корзину
            </button>
            <Link className={cx("btn-ghost")} to="/catalog">
              Назад в каталог
            </Link>
          </div>
        </section>
      </div>

      <section className={cx("related-grid")} aria-label="Похожие товары">
        {relatedProducts.map((item) => (
          <article className={cx("panel", "related-card")} key={item.id}>
            <span className={cx("tag")}>Похожие товары</span>
            <h3>{item.name}</h3>
            <p className={cx("muted")}>{formatMoney(item.price)}</p>
            <Link className={cx("btn-ghost")} to={`/product/${item.slug}`}>
              Открыть
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}

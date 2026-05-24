import { Link } from "react-router-dom";

import { formatMoney } from "../cart";
import { cx } from "../styles";
import type { Product } from "../types";

type ProductCardProps = {
  product: Product;
  onAdd: (product: Product) => void;
};

export function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <article className={cx("product-card")}>
      <Link className={cx("product-image")} to={`/product/${product.slug}`} aria-label={product.name}>
        <span>{product.socketType}</span>
      </Link>
      <div className={cx("product-body")}>
        <span className={cx("tag")}>{product.category}</span>
        <div>
          <Link className={cx("product-title")} to={`/product/${product.slug}`}>
            {product.name}
          </Link>
          <div className={cx("tiny")}>SKU: {product.sku}</div>
        </div>
        <div className={cx("price-row")}>
          <span>
            <span className={cx("price")}>{formatMoney(product.price)}</span>
            {product.oldPrice ? <span className={cx("old-price")}>{formatMoney(product.oldPrice)}</span> : null}
          </span>
          <span className={cx("status", product.stockQty <= 10 ? "warning" : "success")}>
            {product.stockQty > 10 ? `В наличии: ${product.stockQty}` : `Осталось: ${product.stockQty}`}
          </span>
        </div>
        <div className={cx("actions-inline")}>
          <button className={cx("btn")} type="button" onClick={() => onAdd(product)}>
            В корзину
          </button>
          <Link className={cx("btn-ghost")} to={`/product/${product.slug}`}>
            Подробнее
          </Link>
        </div>
      </div>
    </article>
  );
}

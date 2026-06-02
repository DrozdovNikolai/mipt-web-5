import { useEffect, useMemo, useState } from "react";

import { ProductCard } from "../components/ProductCard";
import styles from "./CatalogPage.module.css";
import { createCx } from "../styles";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addToCart } from "../store/cartSlice";
import { loadProducts } from "../store/productsSlice";
import type { Product } from "../types";

const cx = createCx(styles);

type SortValue = "price_asc" | "price_desc" | "name_asc" | "name_desc";

export function CatalogPage() {
  const dispatch = useAppDispatch();
  const { items, byId, categories, total, status, error } = useAppSelector((state) => state.products);
  const [category, setCategory] = useState("all");
  const [socket, setSocket] = useState("all");
  const [temperature, setTemperature] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("price_asc");

  const allKnownProducts = useMemo(() => Object.values(byId), [byId]);
  const sockets = useMemo(
    () => Array.from(new Set(allKnownProducts.map((product) => product.socketType))).sort(),
    [allKnownProducts],
  );
  const temperatures = useMemo(
    () => Array.from(new Set(allKnownProducts.map((product) => product.colorTemperature))).sort(),
    [allKnownProducts],
  );

  useEffect(() => {
    dispatch(
      loadProducts({
        category: category === "all" ? undefined : category,
        socket: socket === "all" ? undefined : socket,
        colorTemperature: temperature === "all" ? undefined : temperature,
        inStock: inStockOnly ? true : undefined,
        search: search.trim() || undefined,
        sort,
        page: 1,
        pageSize: 100,
      }),
    );
  }, [category, socket, temperature, inStockOnly, search, sort, dispatch]);

  const handleAddToCart = (product: Product) => {
    dispatch(addToCart({ productId: product.id, stockQty: product.stockQty }));
  };

  const productsCount = status === "succeeded" ? total : items.length;

  const content = useMemo(() => {
    if (status === "loading") {
      return <div className={cx("panel", "empty-state")}>Загрузка каталога...</div>;
    }

    if (status === "failed") {
      return <div className={cx("panel", "empty-state")}>{error ?? "Не удалось загрузить каталог"}</div>;
    }

    if (items.length === 0) {
      return <div className={cx("panel", "empty-state")}>Товары не найдены.</div>;
    }

    return items.map((product) => {
      return <ProductCard key={product.id} product={product} onAdd={handleAddToCart} />;
    });
  }, [items, status, error, handleAddToCart]);

  return (
    <>
      <div className={cx("page-title")}>
        <div>
          <h1>Каталог лампочек</h1>
          <p className={cx("muted")}>20 позиций завода LampFactory</p>
        </div>
        <div className={cx("actions-inline")}>
          <span className={cx("tag")}>Найдено: {productsCount}</span>
          <label className={cx("field", "compact-field")}>
            <span>Сортировка</span>
            <select className={cx("select")} value={sort} onChange={(event) => setSort(event.target.value as SortValue)}>
              <option value="price_asc">Сначала дешевле</option>
              <option value="price_desc">Сначала дороже</option>
              <option value="name_asc">Название А-Я</option>
              <option value="name_desc">Название Я-А</option>
            </select>
          </label>
        </div>
      </div>

      <div className={cx("layout", "catalog-layout")}>
        <aside className={cx("panel", "filters-panel")}>
          <h3>Фильтры</h3>
          <label className={cx("field")}>
            <span>Поиск</span>
            <input
              className={cx("input")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="SKU или название"
            />
          </label>

          <label className={cx("field")}>
            <span>Категория</span>
            <select className={cx("select")} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Все категории</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className={cx("field")}>
            <span>Цоколь</span>
            <select className={cx("select")} value={socket} onChange={(event) => setSocket(event.target.value)}>
              <option value="all">Любой</option>
              {sockets.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className={cx("field")}>
            <span>Температура</span>
            <select
              className={cx("select")}
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
            >
              <option value="all">Любая</option>
              {temperatures.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className={cx("checkbox-row")}>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.target.checked)}
            />
            <span>Только в наличии</span>
          </label>
        </aside>

        <section className={cx("products-grid")} aria-label="Товары">
          {content}
        </section>
      </div>
    </>
  );
}

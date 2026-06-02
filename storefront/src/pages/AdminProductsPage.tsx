import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { deleteAdminProductApi, fetchAdminCategoriesApi, fetchAdminProductsApi } from "../api";
import { loadAdminSession } from "../adminSession";
import styles from "./AdminProductsPage.module.css";
import { createCx } from "../styles";
import type { AdminProduct, Category } from "../types";

const cx = createCx(styles);

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

export function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [product.name, product.sku, product.category, product.slug].some((value) => value.toLowerCase().includes(query));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.isActive) ||
        (statusFilter === "inactive" && !product.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  async function loadProducts() {
    const session = loadAdminSession();
    if (!session) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetchAdminProductsApi(session.accessToken, { category, pageSize: 100 });
      setProducts(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить товары");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(product: AdminProduct) {
    const session = loadAdminSession();
    if (!session || !window.confirm(`Удалить товар "${product.name}"?`)) {
      return;
    }
    setError("");
    try {
      await deleteAdminProductApi(session.accessToken, product.id);
      setProducts((currentProducts) => currentProducts.filter((item) => item.id !== product.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить товар");
    }
  }

  useEffect(() => {
    void loadProducts();
  }, [category]);

  useEffect(() => {
    const session = loadAdminSession();
    if (!session) {
      return;
    }
    fetchAdminCategoriesApi(session.accessToken)
      .then(setCategories)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить категории");
      });
  }, []);

  return (
    <>
      <div className={cx("page-title")}>
        <div>
          <h1>Товары</h1>
          <p className={cx("muted")}>Каталог магазина и остатки.</p>
        </div>
        <div className={cx("actions-inline")}>
          <label className={cx("field", "compact-field")}>
            <span>Поиск</span>
            <input className={cx("input")} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className={cx("field", "compact-field")}>
            <span>Категория</span>
            <select className={cx("select")} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Все</option>
              {categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={cx("field", "compact-field")}>
            <span>Статус</span>
            <select className={cx("select")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Скрытые</option>
            </select>
          </label>
          <Link className={cx("btn")} to="/admin/products/new">
            Добавить товар
          </Link>
        </div>
      </div>

      {error ? <p className={cx("status", "danger")}>{error}</p> : null}

      <section className={cx("panel", "table-panel")}>
        <div className={cx("table-scroll")}>
          <table className={cx("table")}>
            <thead>
              <tr>
                <th>Название</th>
                <th>SKU</th>
                <th>Категория</th>
                <th>Цена</th>
                <th>Остаток</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <span className={cx("tiny")}>{product.slug}</span>
                  </td>
                  <td>{product.sku}</td>
                  <td>{product.category}</td>
                  <td>{formatMoney(product.price)}</td>
                  <td>{product.stockQty}</td>
                  <td>
                    <span className={cx("status", product.isActive ? "success" : "warning")}>
                      {product.isActive ? "active" : "inactive"}
                    </span>
                  </td>
                  <td>
                    <div className={cx("actions-inline", "table-actions")}>
                      <Link className={cx("btn-ghost", "compact-button")} to={`/admin/products/${product.id}/edit`}>
                        Редактировать
                      </Link>
                      <button
                        className={cx("btn-ghost", "compact-button", "danger-button")}
                        type="button"
                        onClick={() => void handleDelete(product)}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7}>Товары не найдены</td>
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

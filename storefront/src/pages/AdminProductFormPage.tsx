import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  createAdminProductApi,
  fetchAdminCategoriesApi,
  fetchAdminProductApi,
  updateAdminProductApi,
} from "../api";
import { loadAdminSession } from "../adminSession";
import styles from "./AdminProductFormPage.module.css";
import { createCx } from "../styles";
import type { AdminProduct, Category, ProductAttribute } from "../types";

const cx = createCx(styles);

type ProductFormState = {
  categoryId: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  basePrice: string;
  discountPrice: string;
  stockQty: string;
  powerWatts: string;
  socketType: string;
  colorTemperature: string;
  luminousFlux: string;
  voltage: string;
  lifetimeHours: string;
  imageUrl: string;
  isDimmable: boolean;
  isActive: boolean;
};

const emptyForm: ProductFormState = {
  categoryId: "",
  sku: "",
  name: "",
  slug: "",
  shortDescription: "",
  description: "",
  basePrice: "",
  discountPrice: "",
  stockQty: "0",
  powerWatts: "",
  socketType: "E27",
  colorTemperature: "3000K",
  luminousFlux: "",
  voltage: "220-240V",
  lifetimeHours: "30000",
  imageUrl: "/images/lamp-placeholder.jpg",
  isDimmable: false,
  isActive: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toForm(product: AdminProduct): ProductFormState {
  return {
    categoryId: product.categoryId,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? "",
    description: product.description,
    basePrice: String(product.basePrice),
    discountPrice: product.discountPrice ? String(product.discountPrice) : "",
    stockQty: String(product.stockQty),
    powerWatts: String(product.powerWatts),
    socketType: product.socketType,
    colorTemperature: product.colorTemperature,
    luminousFlux: String(product.luminousFlux),
    voltage: product.voltage,
    lifetimeHours: String(product.lifetimeHours),
    imageUrl: product.images[0]?.imageUrl ?? "/images/lamp-placeholder.jpg",
    isDimmable: product.isDimmable,
    isActive: product.isActive,
  };
}

function toNumber(value: string) {
  return Number(value.replace(",", "."));
}

export function AdminProductFormPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(productId));
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(productId);

  function updateField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handleNameChange(value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      name: value,
      slug: isEditing || currentForm.slug ? currentForm.slug : slugify(value),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadAdminSession();
    if (!session) {
      return;
    }
    setError("");
    setIsSaving(true);
    const imageUrl = form.imageUrl.trim();
    const payload = {
      categoryId: form.categoryId,
      sku: form.sku.trim(),
      name: form.name.trim(),
      slug: form.slug.trim(),
      shortDescription: form.shortDescription.trim() || null,
      description: form.description.trim() || null,
      basePrice: toNumber(form.basePrice),
      discountPrice: form.discountPrice.trim() ? toNumber(form.discountPrice) : null,
      stockQty: toNumber(form.stockQty),
      powerWatts: toNumber(form.powerWatts),
      socketType: form.socketType.trim(),
      colorTemperature: form.colorTemperature.trim(),
      luminousFlux: toNumber(form.luminousFlux),
      voltage: form.voltage.trim() || null,
      lifetimeHours: form.lifetimeHours.trim() ? toNumber(form.lifetimeHours) : null,
      isDimmable: form.isDimmable,
      isActive: form.isActive,
      images: imageUrl
        ? [{ imageUrl, altText: form.name.trim(), sortOrder: 0, isMain: true }]
        : [],
      attributes: attributes.map(({ attributeName, attributeValue, sortOrder }) => ({
        attributeName,
        attributeValue,
        sortOrder,
      })),
    };

    try {
      if (productId) {
        await updateAdminProductApi(session.accessToken, productId, payload);
      } else {
        await createAdminProductApi(session.accessToken, payload);
      }
      navigate("/admin/products");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить товар");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    const session = loadAdminSession();
    if (!session) {
      return;
    }
    fetchAdminCategoriesApi(session.accessToken)
      .then((items) => {
        setCategories(items);
        setForm((currentForm) => ({ ...currentForm, categoryId: currentForm.categoryId || items[0]?.id || "" }));
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить категории");
      });

    if (productId) {
      fetchAdminProductApi(session.accessToken, productId)
        .then((product) => {
          setForm(toForm(product));
          setAttributes(product.attributes);
        })
        .catch((requestError) => {
          setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить товар");
        })
        .finally(() => setIsLoading(false));
    }
  }, [productId]);

  return (
    <>
      <div className={cx("page-title")}>
        <div>
          <h1>{isEditing ? "Редактирование товара" : "Новый товар"}</h1>
          <p className={cx("muted")}>Карточка каталога и складской остаток.</p>
        </div>
        <Link className={cx("btn-ghost")} to="/admin/products">
          К списку товаров
        </Link>
      </div>

      {error ? <p className={cx("status", "danger")}>{error}</p> : null}

      <form className={cx("panel", "admin-form")} onSubmit={handleSubmit}>
        {isLoading ? <p className={cx("muted")}>Загрузка...</p> : null}
        <div className={cx("form-grid")}>
          <label className={cx("field")}>
            <span>Название</span>
            <input className={cx("input")} required value={form.name} onChange={(event) => handleNameChange(event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Slug</span>
            <input className={cx("input")} required value={form.slug} onChange={(event) => updateField("slug", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>SKU</span>
            <input className={cx("input")} required value={form.sku} onChange={(event) => updateField("sku", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Категория</span>
            <select className={cx("select")} required value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className={cx("field")}>
            <span>Цена</span>
            <input className={cx("input")} required inputMode="decimal" value={form.basePrice} onChange={(event) => updateField("basePrice", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Цена со скидкой</span>
            <input className={cx("input")} inputMode="decimal" value={form.discountPrice} onChange={(event) => updateField("discountPrice", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Остаток</span>
            <input className={cx("input")} required inputMode="numeric" value={form.stockQty} onChange={(event) => updateField("stockQty", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Мощность, W</span>
            <input className={cx("input")} required inputMode="numeric" value={form.powerWatts} onChange={(event) => updateField("powerWatts", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Цоколь</span>
            <input className={cx("input")} required value={form.socketType} onChange={(event) => updateField("socketType", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Температура</span>
            <input className={cx("input")} required value={form.colorTemperature} onChange={(event) => updateField("colorTemperature", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Световой поток</span>
            <input className={cx("input")} required inputMode="numeric" value={form.luminousFlux} onChange={(event) => updateField("luminousFlux", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Ресурс, часов</span>
            <input className={cx("input")} inputMode="numeric" value={form.lifetimeHours} onChange={(event) => updateField("lifetimeHours", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Напряжение</span>
            <input className={cx("input")} value={form.voltage} onChange={(event) => updateField("voltage", event.target.value)} />
          </label>
          <label className={cx("field")}>
            <span>Главное изображение</span>
            <input className={cx("input")} value={form.imageUrl} onChange={(event) => updateField("imageUrl", event.target.value)} />
          </label>
          <label className={cx("field", "full")}>
            <span>Короткое описание</span>
            <input className={cx("input")} value={form.shortDescription} onChange={(event) => updateField("shortDescription", event.target.value)} />
          </label>
          <label className={cx("field", "full")}>
            <span>Описание</span>
            <textarea className={cx("textarea")} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
          </label>
        </div>

        <div className={cx("inline-row", "form-flags")}>
          <label className={cx("checkbox-row")}>
            <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
            Активен
          </label>
          <label className={cx("checkbox-row")}>
            <input type="checkbox" checked={form.isDimmable} onChange={(event) => updateField("isDimmable", event.target.checked)} />
            Диммируемый
          </label>
        </div>

        <div className={cx("actions-inline")}>
          <button className={cx("btn")} type="submit" disabled={isSaving}>
            {isSaving ? "Сохраняем..." : "Сохранить"}
          </button>
          <Link className={cx("btn-ghost")} to="/admin/products">
            Отмена
          </Link>
        </div>
      </form>
    </>
  );
}

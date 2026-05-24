import type { CartItem, Order } from "./types";

export const CART_STORAGE_KEY = "lampfactory.cart";
export const LAST_ORDER_STORAGE_KEY = "lampfactory.lastOrder";
export const DELIVERY_PRICE = 300;

export function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item?.productId === "string" &&
        Number.isInteger(item?.quantity) &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function saveLastOrder(order: Order) {
  localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(order));
}

export function loadLastOrder(): Order | null {
  try {
    const raw = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}


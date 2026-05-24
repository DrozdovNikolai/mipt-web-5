import seed from "./catalog-seed.json";
import type { Product } from "../types";

type SeedProduct = {
  sku: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  stock_qty: number;
};

const categorySlugs: Record<string, string> = {
  "LED стандарт": "led-standard",
  "Декоративные filament": "filament",
  "Свечи и шарики": "candles-balls",
  "Споты и трубчатые": "spots-tubes",
  Промышленные: "industrial",
  "Smart лампы": "smart",
};

const discountPrices: Record<string, number> = {
  "led-a60-12w-e27-2700k-dim": 1590,
  "smart-a60-9w-e27-rgbcw": 2590,
};

const descriptions: Record<string, string> = {
  "led-a60-7w-e27-3000k":
    "Универсальная светодиодная лампа для дома, кухни и коридора. Теплый свет подходит для ежедневного использования.",
  "filament-st64-8w-e27-2200k":
    "Декоративная filament-лампа с вытянутой колбой для открытых светильников, бра и интерьерных подвесов.",
  "smart-a60-9w-e27-rgbcw":
    "Умная лампа с регулировкой теплого, холодного и цветного света для сценариев освещения в комнате.",
};

function extractPower(name: string, sku: string) {
  const match = `${name} ${sku}`.match(/(\d+)W/i);
  return match ? Number(match[1]) : 7;
}

function extractSocket(name: string, sku: string) {
  const match = `${name} ${sku}`.match(/\b(E27|E14|GU10|G13|E40)\b/i);
  return match ? match[1].toUpperCase() : "E27";
}

function extractTemperature(name: string, sku: string) {
  const match = `${name} ${sku}`.match(/(\d{4}K|RGBCW)/i);
  return match ? match[1].toUpperCase() : "4000K";
}

function luminousFlux(powerWatts: number, category: string) {
  if (category === "Промышленные") return powerWatts * 110;
  if (category === "Декоративные filament") return powerWatts * 85;
  return powerWatts * 100;
}

export const products: Product[] = (seed as SeedProduct[]).map((item) => {
  const powerWatts = extractPower(item.name, item.sku);
  const socketType = extractSocket(item.name, item.sku);
  const colorTemperature = extractTemperature(item.name, item.sku);
  const discountPrice = discountPrices[item.slug];

  return {
    id: item.slug,
    categoryId: categorySlugs[item.category] ?? item.category,
    sku: item.sku,
    slug: item.slug,
    name: item.name,
    category: item.category,
    categorySlug: categorySlugs[item.category] ?? "catalog",
    price: discountPrice ?? item.price,
    oldPrice: discountPrice ? item.price : undefined,
    stockQty: item.stock_qty,
    powerWatts,
    socketType,
    colorTemperature,
    luminousFlux: luminousFlux(powerWatts, item.category),
    voltage: "220-240V",
    lifetimeHours: item.category === "Промышленные" ? 40000 : 30000,
    isDimmable: item.sku.includes("DIM") || item.name.toLowerCase().includes("dimmable"),
    description:
      descriptions[item.slug] ??
      `${item.name} из линейки LampFactory подходит для стабильного повседневного освещения и рассчитана на работу в сетях 220-240V.`,
  };
});

export const categories = Array.from(
  new Map(products.map((product) => [product.categorySlug, product.category])).entries(),
).map(([slug, name]) => ({ slug, name }));

export const sockets = Array.from(new Set(products.map((product) => product.socketType))).sort();
export const temperatures = Array.from(new Set(products.map((product) => product.colorTemperature))).sort();

export function getProductBySlug(slug: string | undefined) {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string) {
  return products.find((product) => product.id === id);
}

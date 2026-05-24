from __future__ import annotations

import json
import re
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Category, Product, ProductAttribute, ProductImage


ROOT_DIR = Path(__file__).resolve().parents[2]
CATALOG_SEED_PATH = ROOT_DIR / "06-appendices" / "catalog-seed.json"

CATEGORY_DATA = {
    "LED стандарт": {
        "id": "cf1dd6cb-61e5-4cf4-8187-12735f614c0c",
        "slug": "led-standard",
        "description": "Классические светодиодные лампы для дома и офиса.",
        "sort_order": 10,
    },
    "Декоративные filament": {
        "id": "997d0693-5b7e-5972-a66e-28033887a5a1",
        "slug": "filament",
        "description": "Декоративные filament-лампы с теплым светом.",
        "sort_order": 20,
    },
    "Свечи и шарики": {
        "id": "afce209b-a694-59c5-8b51-d78f59d27eb0",
        "slug": "candles-balls",
        "description": "Компактные лампы для бра, люстр и декоративных светильников.",
        "sort_order": 30,
    },
    "Споты и трубчатые": {
        "id": "8d609da1-332d-53e9-95b4-ad1404c03756",
        "slug": "spots-tubes",
        "description": "Лампы для точечного и линейного освещения.",
        "sort_order": 40,
    },
    "Промышленные": {
        "id": "2f6b95a9-6334-5551-9b7f-446771bfb32b",
        "slug": "industrial",
        "description": "Лампы повышенной мощности для производственных помещений.",
        "sort_order": 50,
    },
    "Smart лампы": {
        "id": "2c481402-b2e4-5cde-b518-048ff55d835a",
        "slug": "smart",
        "description": "Умные лампы с управлением цветом и яркостью.",
        "sort_order": 60,
    },
}

PRODUCT_ID_OVERRIDES = {
    "led-a60-7w-e27-3000k": "4f39fa77-4d60-4385-b7ce-3352678af18a",
    "filament-a60-8w-e27-2200k": "f29516b0-7c58-4564-a30e-d7dd8ab1ef1a",
}


def _uuid_for(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"lampfactory:{value}"))


def _extract_power(name: str, sku: str) -> int:
    match = re.search(r"(\d+)W", f"{name} {sku}", re.IGNORECASE)
    return int(match.group(1)) if match else 7


def _extract_socket(name: str, sku: str) -> str:
    match = re.search(r"\b(E27|E14|GU10|G13|E40)\b", f"{name} {sku}", re.IGNORECASE)
    return match.group(1).upper() if match else "E27"


def _extract_temperature(name: str, sku: str) -> str:
    text = f"{name} {sku}"
    match = re.search(r"(\d{4}K|RGBCW)", text, re.IGNORECASE)
    return match.group(1).upper() if match else "4000K"


def _estimate_luminous_flux(power_watts: int, category: str) -> int:
    if category == "Декоративные filament":
        return power_watts * 85
    if category == "Промышленные":
        return power_watts * 110
    return power_watts * 100


def seed_catalog(db: Session) -> None:
    has_products = db.scalar(select(Product.id).limit(1))
    if has_products:
        return

    categories: dict[str, Category] = {}
    for name, data in CATEGORY_DATA.items():
        category = Category(
            id=data["id"],
            name=name,
            slug=data["slug"],
            description=data["description"],
            sort_order=data["sort_order"],
        )
        db.add(category)
        categories[name] = category

    seed_items = json.loads(CATALOG_SEED_PATH.read_text(encoding="utf-8"))
    for item in seed_items:
        power_watts = _extract_power(item["name"], item["sku"])
        socket_type = _extract_socket(item["name"], item["sku"])
        color_temperature = _extract_temperature(item["name"], item["sku"])
        is_dimmable = "DIM" in item["sku"].upper() or "DIMMABLE" in item["name"].upper()
        product_id = PRODUCT_ID_OVERRIDES.get(item["slug"], _uuid_for(item["slug"]))

        product = Product(
            id=product_id,
            category=categories[item["category"]],
            sku=item["sku"],
            name=item["name"],
            slug=item["slug"],
            short_description=f"{item['name']} из линейки LampFactory.",
            description=(
                f"{item['name']} подходит для стабильного повседневного освещения. "
                "Корпус рассчитан на бытовые и коммерческие сценарии эксплуатации."
            ),
            base_price=item["price"],
            discount_price=None,
            stock_qty=item["stock_qty"],
            power_watts=power_watts,
            socket_type=socket_type,
            color_temperature=color_temperature,
            luminous_flux=_estimate_luminous_flux(power_watts, item["category"]),
            voltage="220-240V",
            lifetime_hours=30000,
            is_dimmable=is_dimmable,
            is_active=True,
        )
        product.images.append(
            ProductImage(
                image_url=f"https://example.com/images/{item['slug']}.jpg",
                alt_text=item["name"],
                sort_order=0,
                is_main=True,
            )
        )
        product.attributes.extend(
            [
                ProductAttribute(
                    attribute_name="Мощность", attribute_value=f"{power_watts} Вт", sort_order=0
                ),
                ProductAttribute(attribute_name="Цоколь", attribute_value=socket_type, sort_order=1),
                ProductAttribute(
                    attribute_name="Цветовая температура",
                    attribute_value=color_temperature,
                    sort_order=2,
                ),
                ProductAttribute(
                    attribute_name="Световой поток",
                    attribute_value=f"{_estimate_luminous_flux(power_watts, item['category'])} лм",
                    sort_order=3,
                ),
            ]
        )
        db.add(product)

    db.commit()


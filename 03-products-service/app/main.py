from __future__ import annotations

import warnings
from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal
from math import ceil
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic.warnings import UnsupportedFieldAttributeWarning
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .auth import LoginRequest, login_admin, optional_admin, require_admin, require_admin_or_service
from .database import SessionLocal, get_db, init_db
from .models import Category, Product, ProductAttribute, ProductImage, utcnow
from .schemas import ProductCreate, ProductUpdate, StockDecrease, StockDecreaseBatch, StockUpdate
from .seed import seed_catalog


warnings.filterwarnings("ignore", category=UnsupportedFieldAttributeWarning)

NON_NULL_UPDATE_FIELDS = {
    "category_id",
    "sku",
    "name",
    "slug",
    "base_price",
    "stock_qty",
    "power_watts",
    "socket_type",
    "color_temperature",
    "luminous_flux",
    "is_dimmable",
    "is_active",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with SessionLocal() as db:
        seed_catalog(db)
    yield


app = FastAPI(title="LampFactory Products Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _decimal_to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _dt(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _main_image(product: Product) -> str | None:
    for image in product.images:
        if image.is_main:
            return image.image_url
    return product.images[0].image_url if product.images else None


def _category_to_dict(category: Category) -> dict[str, object]:
    return {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "sortOrder": category.sort_order,
        "createdAt": _dt(category.created_at),
        "updatedAt": _dt(category.updated_at),
    }


def _product_to_dict(product: Product) -> dict[str, object]:
    current_price = product.discount_price if product.discount_price is not None else product.base_price
    return {
        "id": product.id,
        "categoryId": product.category_id,
        "category": _category_to_dict(product.category),
        "sku": product.sku,
        "name": product.name,
        "slug": product.slug,
        "shortDescription": product.short_description,
        "description": product.description,
        "basePrice": _decimal_to_float(product.base_price),
        "discountPrice": _decimal_to_float(product.discount_price),
        "currentPrice": _decimal_to_float(current_price),
        "currencyCode": product.currency_code,
        "stockQty": product.stock_qty,
        "inStock": product.stock_qty > 0,
        "powerWatts": product.power_watts,
        "socketType": product.socket_type,
        "colorTemperature": product.color_temperature,
        "luminousFlux": product.luminous_flux,
        "voltage": product.voltage,
        "lifetimeHours": product.lifetime_hours,
        "isDimmable": product.is_dimmable,
        "isActive": product.is_active,
        "mainImageUrl": _main_image(product),
        "images": [
            {
                "id": image.id,
                "imageUrl": image.image_url,
                "altText": image.alt_text,
                "sortOrder": image.sort_order,
                "isMain": image.is_main,
                "createdAt": _dt(image.created_at),
            }
            for image in product.images
        ],
        "attributes": [
            {
                "id": attribute.id,
                "attributeName": attribute.attribute_name,
                "attributeValue": attribute.attribute_value,
                "sortOrder": attribute.sort_order,
                "createdAt": _dt(attribute.created_at),
            }
            for attribute in product.attributes
        ],
        "createdAt": _dt(product.created_at),
        "updatedAt": _dt(product.updated_at),
        "deletedAt": _dt(product.deleted_at),
    }


def _get_product_or_404(db: Session, product_id: str, include_deleted: bool = False) -> Product:
    stmt = (
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.attributes),
        )
    )
    if not include_deleted:
        stmt = stmt.where(Product.deleted_at.is_(None))
    product = db.scalars(stmt).first()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def _validate_active_product_images(product: Product) -> None:
    if product.is_active and not product.images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active product must have at least one image",
        )
    if product.images and not any(image.is_main for image in product.images):
        product.images[0].is_main = True


def _validate_product_prices(product: Product) -> None:
    if product.discount_price is not None and product.discount_price > product.base_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="discountPrice must not exceed basePrice",
        )


def _check_unique_product_fields(
    db: Session,
    *,
    sku: str | None = None,
    slug: str | None = None,
    exclude_product_id: str | None = None,
) -> None:
    filters = []
    if sku:
        filters.append(Product.sku == sku)
    if slug:
        filters.append(Product.slug == slug)
    if not filters:
        return
    stmt = select(Product.id).where(or_(*filters))
    if exclude_product_id:
        stmt = stmt.where(Product.id != exclude_product_id)
    if db.scalar(stmt):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product with this sku or slug already exists",
        )


def _replace_images(product: Product, images: list[dict[str, object]]) -> None:
    product.images.clear()
    for image in images:
        product.images.append(
            ProductImage(
                image_url=str(image["image_url"]),
                alt_text=image.get("alt_text"),
                sort_order=int(image.get("sort_order") or 0),
                is_main=bool(image.get("is_main")),
            )
        )


def _replace_attributes(product: Product, attributes: list[dict[str, object]]) -> None:
    product.attributes.clear()
    for attribute in attributes:
        product.attributes.append(
            ProductAttribute(
                attribute_name=str(attribute["attribute_name"]),
                attribute_value=str(attribute["attribute_value"]),
                sort_order=int(attribute.get("sort_order") or 0),
            )
        )


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/auth/login")
def login(payload: LoginRequest) -> dict[str, object]:
    return login_admin(payload)


@app.get("/api/v1/categories")
def list_categories(db: Annotated[Session, Depends(get_db)]) -> list[dict[str, object]]:
    categories = db.scalars(select(Category).order_by(Category.sort_order, Category.name)).all()
    return [_category_to_dict(category) for category in categories]


@app.get("/api/v1/products")
def list_products(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[dict[str, object] | None, Depends(optional_admin)],
    category: str | None = None,
    category_id: Annotated[str | None, Query(alias="categoryId")] = None,
    socket: str | None = None,
    socket_type: Annotated[str | None, Query(alias="socketType")] = None,
    color_temperature: Annotated[str | None, Query(alias="colorTemperature")] = None,
    in_stock: Annotated[bool | None, Query(alias="inStock")] = None,
    search: str | None = None,
    q: str | None = None,
    sort: str = "name_asc",
    include_inactive: Annotated[bool, Query(alias="includeInactive")] = False,
    page: int = Query(1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 12,
) -> dict[str, object]:
    if include_inactive and admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin token is required")

    filters = [Product.deleted_at.is_(None)]
    if not include_inactive:
        filters.append(Product.is_active.is_(True))
    if category:
        filters.append(Category.slug == category)
    if category_id:
        filters.append(Product.category_id == category_id)
    selected_socket = socket_type or socket
    if selected_socket:
        filters.append(Product.socket_type == selected_socket)
    if color_temperature:
        filters.append(Product.color_temperature == color_temperature)
    if in_stock is True:
        filters.append(Product.stock_qty > 0)
    elif in_stock is False:
        filters.append(Product.stock_qty == 0)
    query_text = search or q
    if query_text:
        like = f"%{query_text}%"
        filters.append(
            or_(
                Product.name.ilike(like),
                Product.sku.ilike(like),
                Product.short_description.ilike(like),
            )
        )

    price_expr = func.coalesce(Product.discount_price, Product.base_price)
    sort_map = {
        "price_asc": price_expr.asc(),
        "price_desc": price_expr.desc(),
        "name_asc": Product.name.asc(),
        "name_desc": Product.name.desc(),
        "stock_desc": Product.stock_qty.desc(),
        "created_desc": Product.created_at.desc(),
    }
    order_by = sort_map.get(sort)
    if order_by is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported sort value",
        )

    base_stmt = select(Product).join(Product.category).where(*filters)
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    products = db.scalars(
        base_stmt.options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.attributes),
        )
        .order_by(order_by, Product.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [_product_to_dict(product) for product in products],
        "page": page,
        "pageSize": page_size,
        "total": total,
        "pages": ceil(total / page_size) if total else 0,
    }


@app.get("/api/v1/products/slug/{slug}")
def get_product_by_slug(slug: str, db: Annotated[Session, Depends(get_db)]) -> dict[str, object]:
    product = db.scalars(
        select(Product)
        .where(Product.slug == slug, Product.deleted_at.is_(None), Product.is_active.is_(True))
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.attributes),
        )
    ).first()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return _product_to_dict(product)


@app.get("/api/v1/products/{product_id}")
def get_product_by_id(
    product_id: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[dict[str, object] | None, Depends(optional_admin)],
    include_inactive: Annotated[bool, Query(alias="includeInactive")] = False,
) -> dict[str, object]:
    if include_inactive and admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin token is required")

    product = _get_product_or_404(db, product_id)
    if not include_inactive and not product.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return _product_to_dict(product)


@app.post("/api/v1/products", status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
) -> dict[str, object]:
    category = db.get(Category, payload.category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")
    _check_unique_product_fields(db, sku=payload.sku, slug=payload.slug)

    product = Product(
        category=category,
        sku=payload.sku,
        name=payload.name,
        slug=payload.slug,
        short_description=payload.short_description,
        description=payload.description,
        base_price=payload.base_price,
        discount_price=payload.discount_price,
        stock_qty=payload.stock_qty,
        power_watts=payload.power_watts,
        socket_type=payload.socket_type,
        color_temperature=payload.color_temperature,
        luminous_flux=payload.luminous_flux,
        voltage=payload.voltage,
        lifetime_hours=payload.lifetime_hours,
        is_dimmable=payload.is_dimmable,
        is_active=payload.is_active,
    )
    _replace_images(product, [image.model_dump() for image in payload.images])
    _replace_attributes(product, [attribute.model_dump() for attribute in payload.attributes])
    _validate_active_product_images(product)
    _validate_product_prices(product)

    db.add(product)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product with this sku or slug already exists",
        ) from exc
    db.refresh(product)
    return _product_to_dict(_get_product_or_404(db, product.id))


@app.patch("/api/v1/products/{product_id}")
def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
) -> dict[str, object]:
    product = _get_product_or_404(db, product_id)
    data = payload.model_dump(exclude_unset=True)
    for field in NON_NULL_UPDATE_FIELDS:
        if field in data and data[field] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field} cannot be null",
            )

    if "category_id" in data and data["category_id"] is not None:
        category = db.get(Category, data["category_id"])
        if category is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")
        product.category = category
    _check_unique_product_fields(
        db,
        sku=data.get("sku"),
        slug=data.get("slug"),
        exclude_product_id=product_id,
    )

    for field in (
        "sku",
        "name",
        "slug",
        "short_description",
        "description",
        "base_price",
        "discount_price",
        "stock_qty",
        "power_watts",
        "socket_type",
        "color_temperature",
        "luminous_flux",
        "voltage",
        "lifetime_hours",
        "is_dimmable",
        "is_active",
    ):
        if field in data:
            setattr(product, field, data[field])

    if "images" in data and data["images"] is not None:
        _replace_images(product, data["images"])
    if "attributes" in data and data["attributes"] is not None:
        _replace_attributes(product, data["attributes"])

    _validate_active_product_images(product)
    _validate_product_prices(product)
    product.updated_at = utcnow()
    db.commit()
    return _product_to_dict(_get_product_or_404(db, product.id))


@app.patch("/api/v1/products/{product_id}/stock")
def update_product_stock(
    product_id: str,
    payload: StockUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
) -> dict[str, object]:
    product = _get_product_or_404(db, product_id)
    product.stock_qty = payload.stock_qty
    product.updated_at = utcnow()
    db.commit()
    return _product_to_dict(_get_product_or_404(db, product.id))


@app.patch("/api/v1/products/{product_id}/stock/decrement")
def decrement_product_stock(
    product_id: str,
    payload: StockDecrease,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin_or_service)],
) -> dict[str, object]:
    product = db.scalars(
        select(Product)
        .where(
            Product.id == product_id,
            Product.deleted_at.is_(None),
            Product.is_active.is_(True),
        )
        .with_for_update()
    ).first()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if product.stock_qty < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product has only {product.stock_qty} items in stock",
        )

    product.stock_qty -= payload.quantity
    product.updated_at = utcnow()
    db.commit()
    return _product_to_dict(_get_product_or_404(db, product.id))


@app.post("/api/v1/products/stock/decrement-batch")
def decrement_products_stock_batch(
    payload: StockDecreaseBatch,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin_or_service)],
) -> dict[str, object]:
    quantities: dict[str, int] = {}
    for item in payload.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    products = db.scalars(
        select(Product)
        .where(
            Product.id.in_(quantities.keys()),
            Product.deleted_at.is_(None),
            Product.is_active.is_(True),
        )
        .with_for_update()
    ).all()
    products_by_id = {product.id: product for product in products}

    missing_ids = [product_id for product_id in quantities if product_id not in products_by_id]
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Products not found: {', '.join(missing_ids)}",
        )

    for product_id, quantity in quantities.items():
        product = products_by_id[product_id]
        if product.stock_qty < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product {product_id} has only {product.stock_qty} items in stock",
            )

    for product_id, quantity in quantities.items():
        product = products_by_id[product_id]
        product.stock_qty -= quantity
        product.updated_at = utcnow()

    db.commit()
    updated_products = [_product_to_dict(_get_product_or_404(db, product_id)) for product_id in quantities]
    return {"items": updated_products}


@app.delete("/api/v1/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
) -> Response:
    product = _get_product_or_404(db, product_id)
    product.deleted_at = utcnow()
    product.is_active = False
    product.updated_at = utcnow()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

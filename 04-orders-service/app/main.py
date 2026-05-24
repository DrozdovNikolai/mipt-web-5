from __future__ import annotations

import os
import secrets
import warnings
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from math import ceil
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic.warnings import UnsupportedFieldAttributeWarning
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from .auth import LoginRequest, create_access_token, login_admin, require_admin
from .database import get_db, init_db
from .models import Order, OrderItem, OrderStatusHistory, utcnow
from .schemas import ManagerCommentUpdate, OrderCreate, OrderStatusUpdate, PaymentStatusUpdate


PRODUCTS_SERVICE_URL = os.getenv("PRODUCTS_SERVICE_URL", "http://127.0.0.1:8001").rstrip("/")
DELIVERY_PRICE = Decimal(os.getenv("COURIER_DELIVERY_PRICE", "300.00"))

ORDER_STATUSES = {"new", "confirmed", "assembling", "shipped", "delivered", "canceled"}
PAYMENT_STATUSES = {"pending", "paid", "failed", "refunded"}
ALLOWED_TRANSITIONS = {
    "new": {"confirmed", "canceled"},
    "confirmed": {"assembling", "canceled"},
    "assembling": {"shipped"},
    "shipped": {"delivered"},
    "delivered": set(),
    "canceled": set(),
}


warnings.filterwarnings("ignore", category=UnsupportedFieldAttributeWarning)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="LampFactory Orders Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _decimal(value: object) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _money(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _dt(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _parse_date(value: str, field_name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be a date in YYYY-MM-DD format",
        ) from exc


def _generate_order_number(db: Session) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"LF-{today}-"
    latest = db.scalar(
        select(Order.order_number)
        .where(Order.order_number.like(f"{prefix}%"))
        .order_by(Order.order_number.desc())
        .limit(1)
    )
    sequence = int(latest.rsplit("-", 1)[-1]) + 1 if latest else 1
    return f"{prefix}{sequence:04d}"


def _products_service_auth_headers() -> dict[str, str]:
    token = os.getenv("PRODUCTS_SERVICE_TOKEN") or create_access_token("orders-service", role="service")
    return {"Authorization": f"Bearer {token}"}


def _decrement_products_stock(items: dict[str, int]) -> dict[str, dict[str, object]]:
    url = f"{PRODUCTS_SERVICE_URL}/api/v1/products/stock/decrement-batch"
    try:
        response = httpx.post(
            url,
            json={
                "items": [
                    {"productId": product_id, "quantity": quantity}
                    for product_id, quantity in items.items()
                ]
            },
            headers=_products_service_auth_headers(),
            timeout=3.0,
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Products service is unavailable",
        ) from exc
    if response.status_code == 400:
        detail = "Product stock is not available"
        try:
            payload = response.json()
            if isinstance(payload.get("detail"), str):
                detail = payload["detail"]
        except ValueError:
            pass
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Products service returned an error while updating stock",
        )

    payload = response.json()
    products = payload.get("items", [])
    return {str(product["id"]): product for product in products}


def _product_attributes_snapshot(product: dict[str, object]) -> dict[str, object]:
    attributes = product.get("attributes") or []
    if not isinstance(attributes, list):
        return {}
    return {
        str(attribute.get("attributeName")): attribute.get("attributeValue")
        for attribute in attributes
        if isinstance(attribute, dict) and attribute.get("attributeName")
    }


def _order_item_to_dict(item: OrderItem) -> dict[str, object]:
    return {
        "id": item.id,
        "productId": item.product_id,
        "skuSnapshot": item.sku_snapshot,
        "productNameSnapshot": item.product_name_snapshot,
        "productSlugSnapshot": item.product_slug_snapshot,
        "unitPrice": _money(item.unit_price),
        "quantity": item.quantity,
        "lineTotal": _money(item.line_total),
        "attributesSnapshot": item.attributes_snapshot,
        "createdAt": _dt(item.created_at),
    }


def _history_to_dict(event: OrderStatusHistory) -> dict[str, object]:
    return {
        "id": event.id,
        "oldStatus": event.old_status,
        "newStatus": event.new_status,
        "changedBy": event.changed_by,
        "source": event.source,
        "comment": event.comment,
        "createdAt": _dt(event.created_at),
    }


def _order_to_dict(order: Order, *, include_public_token: bool = False) -> dict[str, object]:
    data = {
        "id": order.id,
        "orderNumber": order.order_number,
        "customerName": order.customer_name,
        "customerPhone": order.customer_phone,
        "customerEmail": order.customer_email,
        "deliveryCity": order.delivery_city,
        "deliveryAddress": order.delivery_address,
        "deliveryMethod": order.delivery_method,
        "paymentMethod": order.payment_method,
        "orderStatus": order.order_status,
        "paymentStatus": order.payment_status,
        "customerComment": order.customer_comment,
        "managerComment": order.manager_comment,
        "subtotalAmount": _money(order.subtotal_amount),
        "deliveryAmount": _money(order.delivery_amount),
        "totalAmount": _money(order.total_amount),
        "currencyCode": order.currency_code,
        "items": [_order_item_to_dict(item) for item in order.items],
        "statusHistory": [_history_to_dict(event) for event in order.status_history],
        "createdAt": _dt(order.created_at),
        "updatedAt": _dt(order.updated_at),
    }
    if include_public_token:
        data["publicToken"] = order.public_token
    return data


def _order_summary(order: Order) -> dict[str, object]:
    return {
        "id": order.id,
        "orderNumber": order.order_number,
        "customerName": order.customer_name,
        "customerPhone": order.customer_phone,
        "customerEmail": order.customer_email,
        "deliveryCity": order.delivery_city,
        "orderStatus": order.order_status,
        "paymentStatus": order.payment_status,
        "totalAmount": _money(order.total_amount),
        "currencyCode": order.currency_code,
        "itemsCount": sum(item.quantity for item in order.items),
        "createdAt": _dt(order.created_at),
        "updatedAt": _dt(order.updated_at),
    }


def _get_order_or_404(db: Session, order_id: str) -> Order:
    order = db.scalars(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.status_history))
    ).first()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/auth/login")
def login(payload: LoginRequest) -> dict[str, object]:
    return login_admin(payload)


@app.post("/api/v1/orders", status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Annotated[Session, Depends(get_db)]) -> dict[str, object]:
    aggregated_items: dict[str, int] = defaultdict(int)
    for item in payload.items:
        aggregated_items[item.product_id] += item.quantity

    products_by_id = _decrement_products_stock(aggregated_items)
    order_items: list[OrderItem] = []
    subtotal = Decimal("0.00")
    for product_id, quantity in aggregated_items.items():
        product = products_by_id[product_id]
        unit_price = _decimal(product.get("currentPrice") or product.get("basePrice"))
        line_total = unit_price * quantity
        subtotal += line_total
        order_items.append(
            OrderItem(
                product_id=str(product["id"]),
                sku_snapshot=str(product["sku"]),
                product_name_snapshot=str(product["name"]),
                product_slug_snapshot=str(product["slug"]),
                unit_price=unit_price,
                quantity=quantity,
                line_total=line_total,
                attributes_snapshot=_product_attributes_snapshot(product),
            )
        )

    delivery_amount = Decimal("0.00") if payload.delivery_method == "pickup" else DELIVERY_PRICE
    total_amount = subtotal + delivery_amount

    order = Order(
        order_number=_generate_order_number(db),
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        delivery_city=payload.delivery_city,
        delivery_address=payload.delivery_address,
        delivery_method=payload.delivery_method,
        payment_method=payload.payment_method,
        order_status="new",
        payment_status="pending",
        customer_comment=payload.customer_comment,
        subtotal_amount=subtotal,
        delivery_amount=delivery_amount,
        total_amount=total_amount,
        public_token=secrets.token_urlsafe(32),
    )
    order.items.extend(order_items)
    order.status_history.append(
        OrderStatusHistory(
            old_status=None,
            new_status="new",
            changed_by="system",
            source="system",
            comment="Заказ создан",
        )
    )

    db.add(order)
    db.commit()
    return _order_to_dict(_get_order_or_404(db, order.id), include_public_token=True)


@app.get("/api/v1/orders/public/{order_number}")
def get_public_order(
    order_number: str,
    token: str,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    order = db.scalars(
        select(Order)
        .where(Order.order_number == order_number)
        .options(selectinload(Order.items), selectinload(Order.status_history))
    ).first()
    if order is None or not secrets.compare_digest(order.public_token, token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    data = _order_to_dict(order)
    data.pop("managerComment", None)
    data.pop("statusHistory", None)
    return data


@app.get("/api/v1/orders")
def list_orders(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
    order_status: Annotated[str | None, Query(alias="status")] = None,
    payment_status: Annotated[str | None, Query(alias="paymentStatus")] = None,
    date_from: Annotated[str | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[str | None, Query(alias="dateTo")] = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> dict[str, object]:
    filters = []
    if order_status:
        if order_status not in ORDER_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported order status")
        filters.append(Order.order_status == order_status)
    if payment_status:
        if payment_status not in PAYMENT_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported payment status")
        filters.append(Order.payment_status == payment_status)
    if date_from:
        filters.append(
            Order.created_at
            >= datetime.combine(_parse_date(date_from, "dateFrom"), time.min, tzinfo=timezone.utc)
        )
    if date_to:
        filters.append(
            Order.created_at
            < datetime.combine(
                _parse_date(date_to, "dateTo") + timedelta(days=1),
                time.min,
                tzinfo=timezone.utc,
            )
        )
    if search:
        like = f"%{search}%"
        filters.append(
            or_(
                Order.order_number.ilike(like),
                Order.customer_name.ilike(like),
                Order.customer_phone.ilike(like),
                Order.customer_email.ilike(like),
            )
        )

    base_stmt = select(Order).where(*filters)
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    orders = db.scalars(
        base_stmt.options(selectinload(Order.items))
        .order_by(Order.created_at.desc(), Order.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [_order_summary(order) for order in orders],
        "page": page,
        "pageSize": page_size,
        "total": total,
        "pages": ceil(total / page_size) if total else 0,
    }


@app.get("/api/v1/orders/{order_id}")
def get_order(
    order_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
) -> dict[str, object]:
    return _order_to_dict(_get_order_or_404(db, order_id), include_public_token=True)


@app.patch("/api/v1/orders/{order_id}/status")
def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
) -> dict[str, object]:
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported order status")
    order = _get_order_or_404(db, order_id)
    old_status = order.order_status
    if payload.status != old_status:
        allowed = ALLOWED_TRANSITIONS.get(old_status, set())
        if payload.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transition {old_status} -> {payload.status} is not allowed",
            )
        order.order_status = payload.status
        order.status_history.append(
            OrderStatusHistory(
                old_status=old_status,
                new_status=payload.status,
                changed_by=payload.changed_by,
                source="admin",
                comment=payload.comment,
            )
        )
    order.updated_at = utcnow()
    db.commit()
    return _order_to_dict(_get_order_or_404(db, order.id), include_public_token=True)


@app.patch("/api/v1/orders/{order_id}/payment-status")
def update_payment_status(
    order_id: str,
    payload: PaymentStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
) -> dict[str, object]:
    if payload.payment_status not in PAYMENT_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported payment status")
    order = _get_order_or_404(db, order_id)
    order.payment_status = payload.payment_status
    order.updated_at = utcnow()
    db.commit()
    return _order_to_dict(_get_order_or_404(db, order.id), include_public_token=True)


@app.patch("/api/v1/orders/{order_id}/manager-comment")
def update_manager_comment(
    order_id: str,
    payload: ManagerCommentUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[dict[str, object], Depends(require_admin)],
) -> dict[str, object]:
    order = _get_order_or_404(db, order_id)
    order.manager_comment = payload.manager_comment
    order.updated_at = utcnow()
    db.commit()
    return _order_to_dict(_get_order_or_404(db, order.id), include_public_token=True)

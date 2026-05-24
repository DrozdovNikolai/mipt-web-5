from __future__ import annotations

import os
import warnings
from contextlib import asynccontextmanager
from datetime import datetime, time, timezone
from math import ceil
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic.warnings import UnsupportedFieldAttributeWarning
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .auth import (
    CurrentAdmin,
    JWT_EXPIRES_SECONDS,
    create_access_token,
    hash_refresh_token,
    issue_refresh_session,
    require_admin,
    revoke_refresh_token,
    verify_password,
)
from .database import SessionLocal, get_db, init_db
from .models import AdminSession, AdminUser, AuditLog, utcnow
from .schemas import (
    LoginRequest,
    LogoutRequest,
    ManagerCommentProxyUpdate,
    OrderStatusProxyUpdate,
    PaymentStatusProxyUpdate,
    RefreshRequest,
)
from .seed import seed_admin


warnings.filterwarnings("ignore", category=UnsupportedFieldAttributeWarning)

PRODUCTS_SERVICE_URL = os.getenv("PRODUCTS_SERVICE_URL", "http://127.0.0.1:8001").rstrip("/")
ORDERS_SERVICE_URL = os.getenv("ORDERS_SERVICE_URL", "http://127.0.0.1:8002").rstrip("/")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with SessionLocal() as db:
        seed_admin(db)
    yield


app = FastAPI(title="LampFactory Admin Panel Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _dt(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _is_expired(value: datetime) -> bool:
    selected = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return selected < datetime.now(timezone.utc)


def _admin_user_to_dict(user: AdminUser) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "fullName": user.full_name,
        "role": user.role.code,
        "isActive": user.is_active,
        "lastLoginAt": _dt(user.last_login_at),
    }


def _audit_to_dict(audit_log: AuditLog) -> dict[str, object]:
    return {
        "id": audit_log.id,
        "adminUserId": audit_log.admin_user_id,
        "adminEmail": audit_log.admin_user.email,
        "action": audit_log.action,
        "entityType": audit_log.entity_type,
        "entityId": audit_log.entity_id,
        "requestPayload": audit_log.request_payload,
        "responseCode": audit_log.response_code,
        "createdAt": _dt(audit_log.created_at),
    }


def _token_response(db: Session, user: AdminUser, request: Request) -> dict[str, object]:
    refresh_token = issue_refresh_session(db, user, request)
    access_token = create_access_token(user.email, role=user.role.code)
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "tokenType": "bearer",
        "expiresIn": JWT_EXPIRES_SECONDS,
        "user": _admin_user_to_dict(user),
    }


def _record_audit(
    db: Session,
    admin: CurrentAdmin,
    *,
    action: str,
    entity_type: str,
    entity_id: str | None,
    request_payload: dict[str, object] | list[object] | None,
    response_code: int,
) -> None:
    db.add(
        AuditLog(
            admin_user=admin.user,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            request_payload=request_payload,
            response_code=response_code,
        )
    )
    db.commit()


def _auth_headers(admin: CurrentAdmin) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin.access_token}"}


def _proxy_response_payload(response: httpx.Response) -> object:
    if response.status_code == status.HTTP_204_NO_CONTENT or not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text


def _raise_or_return(response: httpx.Response) -> object:
    payload = _proxy_response_payload(response)
    if response.status_code >= 400:
        detail = payload
        if isinstance(payload, dict) and "detail" in payload:
            detail = payload["detail"]
        raise HTTPException(status_code=response.status_code, detail=detail)
    return payload


def _proxy_request(
    method: str,
    base_url: str,
    path: str,
    admin: CurrentAdmin,
    *,
    params: dict[str, object | None] | None = None,
    json_payload: dict[str, object] | None = None,
) -> httpx.Response:
    selected_params = {key: value for key, value in (params or {}).items() if value not in (None, "")}
    try:
        return httpx.request(
            method,
            f"{base_url}{path}",
            params=selected_params,
            json=json_payload,
            headers=_auth_headers(admin),
            timeout=5.0,
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Profile service is unavailable") from exc


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/auth/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    user = db.scalars(
        select(AdminUser)
        .where(AdminUser.email == payload.email, AdminUser.is_active.is_(True), AdminUser.deleted_at.is_(None))
        .options(selectinload(AdminUser.role))
    ).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user.last_login_at = utcnow()
    user.updated_at = utcnow()
    response = _token_response(db, user, request)
    db.add(
        AuditLog(
            admin_user=user,
            action="login",
            entity_type="auth",
            entity_id=user.id,
            request_payload={"email": payload.email},
            response_code=status.HTTP_200_OK,
        )
    )
    db.commit()
    return response


@app.post("/api/v1/auth/refresh")
def refresh_token(
    payload: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    token_hash = hash_refresh_token(payload.refresh_token)
    session = db.scalars(
        select(AdminSession)
        .where(AdminSession.refresh_token_hash == token_hash, AdminSession.revoked_at.is_(None))
        .options(selectinload(AdminSession.admin_user).selectinload(AdminUser.role))
    ).first()
    if session is None or _is_expired(session.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = session.admin_user
    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user is inactive")

    return {
        "accessToken": create_access_token(user.email, role=user.role.code),
        "refreshToken": payload.refresh_token,
        "tokenType": "bearer",
        "expiresIn": JWT_EXPIRES_SECONDS,
        "user": _admin_user_to_dict(user),
    }


@app.post("/api/v1/auth/logout")
def logout(
    payload: LogoutRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> dict[str, str]:
    if payload.refresh_token:
        revoke_refresh_token(db, payload.refresh_token)
    _record_audit(
        db,
        admin,
        action="logout",
        entity_type="auth",
        entity_id=admin.user.id,
        request_payload=None,
        response_code=status.HTTP_200_OK,
    )
    return {"status": "ok"}


@app.get("/api/v1/auth/me")
def get_me(admin: Annotated[CurrentAdmin, Depends(require_admin)]) -> dict[str, object]:
    return _admin_user_to_dict(admin.user)


@app.get("/api/v1/dashboard/summary")
def dashboard_summary(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> dict[str, object]:
    products_response = _proxy_request(
        "GET",
        PRODUCTS_SERVICE_URL,
        "/api/v1/products",
        admin,
        params={"includeInactive": True, "page": 1, "pageSize": 100},
    )
    orders_response = _proxy_request(
        "GET",
        ORDERS_SERVICE_URL,
        "/api/v1/orders",
        admin,
        params={"page": 1, "pageSize": 100},
    )
    products_payload = _raise_or_return(products_response)
    orders_payload = _raise_or_return(orders_response)
    products = products_payload.get("items", []) if isinstance(products_payload, dict) else []
    orders = orders_payload.get("items", []) if isinstance(orders_payload, dict) else []
    today = datetime.now(timezone.utc).date()
    recent_actions = db.scalars(
        select(AuditLog)
        .options(selectinload(AuditLog.admin_user))
        .order_by(AuditLog.created_at.desc())
        .limit(10)
    ).all()
    return {
        "activeProducts": sum(1 for product in products if product.get("isActive")),
        "newOrders": sum(1 for order in orders if order.get("orderStatus") == "new"),
        "ordersToday": sum(
            1
            for order in orders
            if order.get("createdAt") and datetime.fromisoformat(order["createdAt"]).date() == today
        ),
        "revenueTotal": sum(float(order.get("totalAmount") or 0) for order in orders),
        "recentOrders": orders[:5],
        "recentActions": [_audit_to_dict(item) for item in recent_actions],
    }


@app.get("/api/v1/admin/products")
def list_admin_products(
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
    search: str | None = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> dict[str, object]:
    response = _proxy_request(
        "GET",
        PRODUCTS_SERVICE_URL,
        "/api/v1/products",
        admin,
        params={
            "includeInactive": True,
            "search": search,
            "category": category,
            "page": page,
            "pageSize": page_size,
        },
    )
    payload = _raise_or_return(response)
    if isinstance(payload, dict) and status_filter in {"active", "inactive"}:
        expected = status_filter == "active"
        items = [product for product in payload.get("items", []) if bool(product.get("isActive")) is expected]
        payload = {
            **payload,
            "items": items,
            "total": len(items),
            "pages": ceil(len(items) / page_size) if items else 0,
        }
    return payload if isinstance(payload, dict) else {"items": []}


@app.get("/api/v1/admin/categories")
def list_admin_categories(admin: Annotated[CurrentAdmin, Depends(require_admin)]) -> object:
    response = _proxy_request("GET", PRODUCTS_SERVICE_URL, "/api/v1/categories", admin)
    return _raise_or_return(response)


@app.get("/api/v1/admin/products/{product_id}")
def get_admin_product(
    product_id: str,
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> object:
    response = _proxy_request(
        "GET",
        PRODUCTS_SERVICE_URL,
        f"/api/v1/products/{product_id}",
        admin,
        params={"includeInactive": True},
    )
    return _raise_or_return(response)


def _normalize_product_payload(payload: dict[str, object]) -> dict[str, object]:
    normalized = dict(payload)
    normalized.setdefault("luminousFlux", 0)
    normalized.setdefault("discountPrice", None)
    normalized.setdefault("voltage", "220-240V")
    normalized.setdefault("lifetimeHours", 30000)
    normalized.setdefault("isDimmable", False)
    normalized.setdefault("attributes", [])
    if normalized.get("isActive", True) and not normalized.get("images"):
        normalized["images"] = [
            {
                "imageUrl": "/images/lamp-placeholder.jpg",
                "altText": str(normalized.get("name") or "Lamp"),
                "sortOrder": 0,
                "isMain": True,
            }
        ]
    return normalized


@app.post("/api/v1/admin/products", status_code=status.HTTP_201_CREATED)
def create_admin_product(
    payload: dict[str, object],
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> object:
    response = _proxy_request(
        "POST",
        PRODUCTS_SERVICE_URL,
        "/api/v1/products",
        admin,
        json_payload=_normalize_product_payload(payload),
    )
    response_payload = _proxy_response_payload(response)
    entity_id = response_payload.get("id") if isinstance(response_payload, dict) else None
    _record_audit(
        db,
        admin,
        action="create_product",
        entity_type="product",
        entity_id=str(entity_id) if entity_id else None,
        request_payload=payload,
        response_code=response.status_code,
    )
    if response.status_code >= 400:
        _raise_or_return(response)
    return response_payload


@app.patch("/api/v1/admin/products/{product_id}")
def update_admin_product(
    product_id: str,
    payload: dict[str, object],
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> object:
    response = _proxy_request(
        "PATCH",
        PRODUCTS_SERVICE_URL,
        f"/api/v1/products/{product_id}",
        admin,
        json_payload=payload,
    )
    _record_audit(
        db,
        admin,
        action="update_product",
        entity_type="product",
        entity_id=product_id,
        request_payload=payload,
        response_code=response.status_code,
    )
    return _raise_or_return(response)


@app.delete("/api/v1/admin/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_product(
    product_id: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> Response:
    response = _proxy_request("DELETE", PRODUCTS_SERVICE_URL, f"/api/v1/products/{product_id}", admin)
    _record_audit(
        db,
        admin,
        action="delete_product",
        entity_type="product",
        entity_id=product_id,
        request_payload=None,
        response_code=response.status_code,
    )
    if response.status_code >= 400:
        _raise_or_return(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/v1/admin/orders")
def list_admin_orders(
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
    order_status: Annotated[str | None, Query(alias="status")] = None,
    payment_status: Annotated[str | None, Query(alias="paymentStatus")] = None,
    date_from: Annotated[str | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[str | None, Query(alias="dateTo")] = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> object:
    response = _proxy_request(
        "GET",
        ORDERS_SERVICE_URL,
        "/api/v1/orders",
        admin,
        params={
            "status": order_status,
            "paymentStatus": payment_status,
            "dateFrom": date_from,
            "dateTo": date_to,
            "search": search,
            "page": page,
            "pageSize": page_size,
        },
    )
    return _raise_or_return(response)


@app.get("/api/v1/admin/orders/{order_id}")
def get_admin_order(order_id: str, admin: Annotated[CurrentAdmin, Depends(require_admin)]) -> object:
    response = _proxy_request("GET", ORDERS_SERVICE_URL, f"/api/v1/orders/{order_id}", admin)
    return _raise_or_return(response)


@app.patch("/api/v1/admin/orders/{order_id}/status")
def update_admin_order_status(
    order_id: str,
    payload: OrderStatusProxyUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> object:
    request_payload = {
        "status": payload.status,
        "comment": payload.comment,
        "changedBy": admin.user.email,
    }
    response = _proxy_request(
        "PATCH",
        ORDERS_SERVICE_URL,
        f"/api/v1/orders/{order_id}/status",
        admin,
        json_payload=request_payload,
    )
    _record_audit(
        db,
        admin,
        action="update_order_status",
        entity_type="order",
        entity_id=order_id,
        request_payload=request_payload,
        response_code=response.status_code,
    )
    return _raise_or_return(response)


@app.patch("/api/v1/admin/orders/{order_id}/payment-status")
def update_admin_payment_status(
    order_id: str,
    payload: PaymentStatusProxyUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> object:
    request_payload = payload.model_dump(by_alias=True)
    response = _proxy_request(
        "PATCH",
        ORDERS_SERVICE_URL,
        f"/api/v1/orders/{order_id}/payment-status",
        admin,
        json_payload=request_payload,
    )
    _record_audit(
        db,
        admin,
        action="update_payment_status",
        entity_type="order",
        entity_id=order_id,
        request_payload=request_payload,
        response_code=response.status_code,
    )
    return _raise_or_return(response)


@app.patch("/api/v1/admin/orders/{order_id}/manager-comment")
def update_admin_manager_comment(
    order_id: str,
    payload: ManagerCommentProxyUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[CurrentAdmin, Depends(require_admin)],
) -> object:
    request_payload = payload.model_dump(by_alias=True)
    response = _proxy_request(
        "PATCH",
        ORDERS_SERVICE_URL,
        f"/api/v1/orders/{order_id}/manager-comment",
        admin,
        json_payload=request_payload,
    )
    _record_audit(
        db,
        admin,
        action="update_manager_comment",
        entity_type="order",
        entity_id=order_id,
        request_payload=request_payload,
        response_code=response.status_code,
    )
    return _raise_or_return(response)


@app.get("/api/v1/audit-logs")
def list_audit_logs(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[CurrentAdmin, Depends(require_admin)],
    page: int = Query(1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> dict[str, object]:
    total = db.scalar(select(func.count()).select_from(AuditLog)) or 0
    logs = db.scalars(
        select(AuditLog)
        .options(selectinload(AuditLog.admin_user))
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [_audit_to_dict(item) for item in logs],
        "page": page,
        "pageSize": page_size,
        "total": total,
        "pages": ceil(total / page_size) if total else 0,
    }

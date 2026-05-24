from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class LoginRequest(CamelModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1)


class RefreshRequest(CamelModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(CamelModel):
    refresh_token: str | None = None


class OrderStatusProxyUpdate(CamelModel):
    status: str
    comment: str | None = None


class PaymentStatusProxyUpdate(CamelModel):
    payment_status: str


class ManagerCommentProxyUpdate(CamelModel):
    manager_comment: str | None = None

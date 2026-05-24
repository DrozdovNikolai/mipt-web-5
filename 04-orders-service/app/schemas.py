from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class OrderItemIn(CamelModel):
    product_id: str = Field(min_length=1)
    quantity: int = Field(ge=1)


class OrderCreate(CamelModel):
    customer_name: str = Field(min_length=1, max_length=255)
    customer_phone: str = Field(min_length=3, max_length=32)
    customer_email: str = Field(min_length=3, max_length=255)
    delivery_city: str = Field(min_length=1, max_length=120)
    delivery_address: str = Field(min_length=1, max_length=255)
    delivery_method: str
    payment_method: str
    customer_comment: str | None = None
    items: list[OrderItemIn] = Field(min_length=1)

    @field_validator("customer_email")
    @classmethod
    def email_must_look_valid(cls, value: str) -> str:
        if "@" not in value or "." not in value.rsplit("@", 1)[-1]:
            raise ValueError("customerEmail must be a valid email")
        return value

    @field_validator("delivery_method")
    @classmethod
    def delivery_method_must_be_supported(cls, value: str) -> str:
        allowed = {"courier", "pickup"}
        if value not in allowed:
            raise ValueError(f"deliveryMethod must be one of: {', '.join(sorted(allowed))}")
        return value

    @field_validator("payment_method")
    @classmethod
    def payment_method_must_be_supported(cls, value: str) -> str:
        allowed = {"card_online", "cash_on_delivery"}
        if value not in allowed:
            raise ValueError(f"paymentMethod must be one of: {', '.join(sorted(allowed))}")
        return value


class OrderStatusUpdate(CamelModel):
    status: str
    comment: str | None = None
    changed_by: str = "admin"


class PaymentStatusUpdate(CamelModel):
    payment_status: str


class ManagerCommentUpdate(CamelModel):
    manager_comment: str | None = None


from __future__ import annotations

from decimal import Decimal

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


class ProductImageIn(CamelModel):
    image_url: str
    alt_text: str | None = None
    sort_order: int = 0
    is_main: bool = False


class ProductAttributeIn(CamelModel):
    attribute_name: str
    attribute_value: str
    sort_order: int = 0


class ProductCreate(CamelModel):
    category_id: str
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    short_description: str | None = Field(default=None, max_length=500)
    description: str | None = None
    base_price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    discount_price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    stock_qty: int = Field(ge=0)
    power_watts: int = Field(gt=0)
    socket_type: str = Field(min_length=1, max_length=32)
    color_temperature: str = Field(min_length=1, max_length=32)
    luminous_flux: int = Field(ge=0)
    voltage: str | None = Field(default=None, max_length=32)
    lifetime_hours: int | None = Field(default=None, ge=0)
    is_dimmable: bool = False
    is_active: bool = True
    images: list[ProductImageIn] = Field(default_factory=list)
    attributes: list[ProductAttributeIn] = Field(default_factory=list)

    @field_validator("discount_price")
    @classmethod
    def discount_must_not_exceed_base(
        cls, value: Decimal | None, info
    ) -> Decimal | None:
        base_price = info.data.get("base_price")
        if value is not None and base_price is not None and value > base_price:
            raise ValueError("discountPrice must not exceed basePrice")
        return value


class ProductUpdate(CamelModel):
    category_id: str | None = None
    sku: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(
        default=None, min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    short_description: str | None = Field(default=None, max_length=500)
    description: str | None = None
    base_price: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    discount_price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    stock_qty: int | None = Field(default=None, ge=0)
    power_watts: int | None = Field(default=None, gt=0)
    socket_type: str | None = Field(default=None, min_length=1, max_length=32)
    color_temperature: str | None = Field(default=None, min_length=1, max_length=32)
    luminous_flux: int | None = Field(default=None, ge=0)
    voltage: str | None = Field(default=None, max_length=32)
    lifetime_hours: int | None = Field(default=None, ge=0)
    is_dimmable: bool | None = None
    is_active: bool | None = None
    images: list[ProductImageIn] | None = None
    attributes: list[ProductAttributeIn] | None = None


class StockUpdate(CamelModel):
    stock_qty: int = Field(ge=0)


class StockDecrease(CamelModel):
    quantity: int = Field(ge=1)


class StockDecreaseItem(CamelModel):
    product_id: str = Field(min_length=1)
    quantity: int = Field(ge=1)


class StockDecreaseBatch(CamelModel):
    items: list[StockDecreaseItem] = Field(min_length=1)

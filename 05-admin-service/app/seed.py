from __future__ import annotations

import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import AdminUser, Role, utcnow


DEFAULT_EMAIL = os.getenv("ADMIN_USERNAME", "manager@lampfactory.local")
DEFAULT_PASSWORD = os.getenv("ADMIN_PASSWORD", "StrongPassword123")


def seed_admin(db: Session) -> None:
    roles = {
        "admin": "Администратор",
        "content_manager": "Контент-менеджер",
        "order_manager": "Менеджер заказов",
    }
    created_roles: dict[str, Role] = {}
    for code, name in roles.items():
        role = db.scalars(select(Role).where(Role.code == code)).first()
        if role is None:
            role = Role(code=code, name=name)
            db.add(role)
            db.flush()
        created_roles[code] = role

    user = db.scalars(select(AdminUser).where(AdminUser.email == DEFAULT_EMAIL)).first()
    if user is None:
        db.add(
            AdminUser(
                role=created_roles["admin"],
                full_name="LampFactory Manager",
                email=DEFAULT_EMAIL,
                password_hash=hash_password(DEFAULT_PASSWORD),
            )
        )
    else:
        user.role = created_roles["admin"]
        user.is_active = True
        user.deleted_at = None
        user.updated_at = utcnow()

    db.commit()

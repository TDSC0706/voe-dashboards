from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_admin, get_password_hash
from app.models.voe import AppUser

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_admin: bool = False


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


def _serialize(u: AppUser) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "is_admin": u.is_admin,
        "is_active": u.is_active,
        "created_at": u.created_at,
        "last_login": u.last_login,
    }


@router.get("", dependencies=[Depends(get_current_admin)])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppUser).order_by(AppUser.username))
    return [_serialize(u) for u in result.scalars().all()]


@router.post("", dependencies=[Depends(get_current_admin)], status_code=status.HTTP_201_CREATED)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(AppUser).where(AppUser.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username já existe")

    user = AppUser(
        username=data.username,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        email=data.email,
        is_admin=data.is_admin,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _serialize(user)


@router.put("/{user_id}", dependencies=[Depends(get_current_admin)])
async def update_user(user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppUser).where(AppUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password:
        user.password_hash = get_password_hash(data.password)

    await db.commit()
    await db.refresh(user)
    return _serialize(user)


@router.delete("/{user_id}", dependencies=[Depends(get_current_admin)])
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppUser).where(AppUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    await db.delete(user)
    await db.commit()
    return {"ok": True}

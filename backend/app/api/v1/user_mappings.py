from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/user-mappings", tags=["user-mappings"])


class MappingCreate(BaseModel):
    team_member_id: int
    fu_member_id: int
    fu_member_name: str | None = None


@router.get("")
async def list_mappings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT um.*, tm.full_name AS member_name, tm.email
            FROM user_mappings um
            JOIN team_members tm ON um.team_member_id = tm.id
            ORDER BY tm.full_name
        """)
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.post("")
async def create_mapping(data: MappingCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            INSERT INTO user_mappings (team_member_id, fu_member_id, fu_member_name, created_at)
            VALUES (:team_member_id, :fu_member_id, :fu_member_name, :now)
            ON CONFLICT (team_member_id) DO UPDATE SET
                fu_member_id = EXCLUDED.fu_member_id,
                fu_member_name = EXCLUDED.fu_member_name
            RETURNING id
        """),
        {**data.model_dump(), "now": datetime.utcnow()},
    )
    await db.commit()
    return {"id": result.scalar()}


@router.delete("/{mapping_id}")
async def delete_mapping(mapping_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM user_mappings WHERE id = :id"), {"id": mapping_id})
    await db.commit()
    return {"deleted": True}

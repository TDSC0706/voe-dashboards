import json
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


class DashboardCreate(BaseModel):
    name: str
    description: str | None = None
    layout: list[dict] = []


class DashboardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    layout: list[dict] | None = None


@router.get("")
async def list_dashboards(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM dashboards ORDER BY updated_at DESC"))
    rows = []
    for r in result.fetchall():
        d = dict(r._mapping)
        d["layout"] = json.loads(d["layout"]) if d["layout"] else []
        rows.append(d)
    return rows


@router.post("")
async def create_dashboard(data: DashboardCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            INSERT INTO dashboards (name, description, layout, created_at, updated_at)
            VALUES (:name, :description, :layout, :now, :now)
            RETURNING id
        """),
        {"name": data.name, "description": data.description,
         "layout": json.dumps(data.layout), "now": datetime.utcnow()},
    )
    await db.commit()
    return {"id": result.scalar(), "name": data.name}


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM dashboards WHERE id = :id"), {"id": dashboard_id}
    )
    row = result.first()
    if not row:
        return {"error": "Not found"}
    d = dict(row._mapping)
    d["layout"] = json.loads(d["layout"]) if d["layout"] else []
    return d


@router.put("/{dashboard_id}")
async def update_dashboard(dashboard_id: int, data: DashboardUpdate, db: AsyncSession = Depends(get_db)):
    updates = []
    params: dict = {"id": dashboard_id, "now": datetime.utcnow()}
    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name
    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description
    if data.layout is not None:
        updates.append("layout = :layout")
        params["layout"] = json.dumps(data.layout)
    updates.append("updated_at = :now")

    await db.execute(
        text(f"UPDATE dashboards SET {', '.join(updates)} WHERE id = :id"), params
    )
    await db.commit()
    return {"id": dashboard_id, "updated": True}


@router.delete("/{dashboard_id}")
async def delete_dashboard(dashboard_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM dashboards WHERE id = :id"), {"id": dashboard_id})
    await db.commit()
    return {"deleted": True}

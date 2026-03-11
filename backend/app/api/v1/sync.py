from datetime import datetime

from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.ws import notify_ws
from app.sync.odata_sync import sync_all_odata
from app.sync.flowup_sync import sync_flowup_members, sync_flowup_reports, sync_flowup_boards, sync_fu_boards

router = APIRouter(prefix="/sync", tags=["sync"])


class SyncConfigUpdate(BaseModel):
    odata_interval: int | None = None
    flowup_interval: int | None = None


@router.get("/status")
async def sync_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT DISTINCT ON (source, entity)
                source, entity, status, records_synced, error_message,
                started_at, completed_at
            FROM sync_log
            ORDER BY source, entity, started_at DESC
        """)
    )
    latest = [dict(row._mapping) for row in result.fetchall()]

    history = await db.execute(
        text("SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 50")
    )
    return {
        "latest": latest,
        "history": [dict(row._mapping) for row in history.fetchall()],
    }


@router.post("/trigger")
async def trigger_sync(background_tasks: BackgroundTasks):
    await notify_ws({"type": "sync_start"})
    background_tasks.add_task(sync_all_odata)
    background_tasks.add_task(sync_flowup_boards)
    background_tasks.add_task(sync_flowup_members)
    background_tasks.add_task(sync_flowup_reports)
    background_tasks.add_task(sync_fu_boards)
    return {"message": "Sync triggered"}


@router.post("/trigger/odata")
async def trigger_odata(background_tasks: BackgroundTasks):
    background_tasks.add_task(sync_all_odata)
    return {"message": "OData sync triggered"}


@router.post("/trigger/flowup")
async def trigger_flowup(background_tasks: BackgroundTasks):
    background_tasks.add_task(sync_flowup_reports)
    return {"message": "Flowup sync triggered"}


@router.get("/config")
async def get_sync_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT key, value FROM app_config WHERE key IN ('odata_sync_interval', 'flowup_sync_interval')")
    )
    rows = {row[0]: int(row[1]) for row in result.fetchall()}
    return {
        "odata_interval": rows.get("odata_sync_interval", settings.odata_sync_interval),
        "flowup_interval": rows.get("flowup_sync_interval", settings.flowup_sync_interval),
    }


@router.put("/config")
async def update_sync_config(body: SyncConfigUpdate, db: AsyncSession = Depends(get_db)):
    from app.sync.scheduler import scheduler

    now = datetime.utcnow()
    if body.odata_interval is not None:
        await db.execute(
            text("INSERT INTO app_config (key, value, updated_at) VALUES ('odata_sync_interval', :v, :now) ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = :now"),
            {"v": str(body.odata_interval), "now": now},
        )
        try:
            scheduler.reschedule_job("odata_sync", trigger="interval", seconds=body.odata_interval)
        except Exception:
            pass
    if body.flowup_interval is not None:
        await db.execute(
            text("INSERT INTO app_config (key, value, updated_at) VALUES ('flowup_sync_interval', :v, :now) ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = :now"),
            {"v": str(body.flowup_interval), "now": now},
        )
        try:
            scheduler.reschedule_job("flowup_sync", trigger="interval", seconds=body.flowup_interval)
        except Exception:
            pass
    await db.commit()
    return {"message": "Config updated"}

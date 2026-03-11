"""APScheduler setup for periodic sync jobs."""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session
from app.sync.odata_sync import sync_all_odata
from app.sync.flowup_sync import sync_flowup_reports, sync_fu_boards, sync_fu_board_tasks

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _get_intervals_from_db():
    """Read sync intervals from app_config, falling back to settings defaults."""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT key, value FROM app_config WHERE key IN ('odata_sync_interval', 'flowup_sync_interval')")
            )
            rows = {row[0]: int(row[1]) for row in result.fetchall()}
            return (
                rows.get("odata_sync_interval", settings.odata_sync_interval),
                rows.get("flowup_sync_interval", settings.flowup_sync_interval),
            )
    except Exception:
        return settings.odata_sync_interval, settings.flowup_sync_interval


MATERIALIZED_VIEWS = [
    "mv_project_health",
    "mv_team_workload",
    "mv_iteration_progress",
]


async def _refresh_materialized_views():
    try:
        async with async_session() as session:
            for view in MATERIALIZED_VIEWS:
                await session.execute(text(f"REFRESH MATERIALIZED VIEW {view}"))
            await session.commit()
        logger.info("Materialized views refreshed")
    except Exception as e:
        logger.warning(f"MV refresh failed: {e}")


async def _odata_sync_and_refresh():
    await sync_all_odata()
    await _refresh_materialized_views()


async def _flowup_sync_and_refresh():
    await sync_flowup_reports()
    await sync_fu_boards()
    await sync_fu_board_tasks()
    await _refresh_materialized_views()


async def start_scheduler():
    odata_interval, flowup_interval = await _get_intervals_from_db()

    scheduler.add_job(
        _odata_sync_and_refresh,
        "interval",
        seconds=odata_interval,
        id="odata_sync",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.add_job(
        _flowup_sync_and_refresh,
        "interval",
        seconds=flowup_interval,
        id="flowup_sync",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info(f"Scheduler started: OData every {odata_interval}s, Flowup every {flowup_interval}s")


def stop_scheduler():
    scheduler.shutdown()

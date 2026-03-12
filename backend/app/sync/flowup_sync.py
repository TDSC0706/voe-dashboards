"""Flowup MySQL sync — reads time reports from the Flowup replica database."""
import logging
import ssl
from datetime import datetime

import aiomysql
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session
from app.core.ws import notify_ws

logger = logging.getLogger(__name__)


def _make_ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def sync_flowup_boards():
    """Sync FlowUp projects/boards into fu_cost_centers (preserving existing project_id mappings)."""
    logger.info("Starting Flowup boards sync...")
    started = datetime.utcnow()

    try:
        conn = await aiomysql.connect(
            host=settings.flowup_host,
            port=settings.flowup_port,
            user=settings.flowup_user,
            password=settings.flowup_password,
            db=settings.flowup_db,
            ssl=_make_ssl_ctx(),
        )
        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute("SELECT Id AS fu_project_id, Name AS fu_project_name FROM costcenters ORDER BY Id")
                rows = await cursor.fetchall()
        finally:
            conn.close()

        async with async_session() as session:
            count = 0
            for row in rows:
                await session.execute(
                    text("""
                        INSERT INTO fu_cost_centers (fu_project_id, fu_project_name, synced_at)
                        VALUES (:fu_project_id, :fu_project_name, :synced_at)
                        ON CONFLICT (fu_project_id) WHERE fu_project_id IS NOT NULL DO UPDATE SET
                            fu_project_name = EXCLUDED.fu_project_name,
                            synced_at = EXCLUDED.synced_at
                    """),
                    {**row, "synced_at": datetime.utcnow()},
                )
                count += 1

            await session.execute(
                text("""INSERT INTO sync_log (source, entity, status, records_synced, started_at, completed_at)
                        VALUES ('flowup', 'boards', 'success', :count, :started, :completed)"""),
                {"count": count, "started": started, "completed": datetime.utcnow()},
            )
            await session.commit()

        logger.info(f"  Synced {count} Flowup boards")
        await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "boards", "status": "success", "records_synced": count})
        return {"status": "success", "count": count}

    except Exception as e:
        logger.error(f"  Flowup boards sync error: {e}")
        try:
            async with async_session() as session:
                await session.execute(
                    text("""INSERT INTO sync_log (source, entity, status, records_synced, error_message, started_at, completed_at)
                            VALUES ('flowup', 'boards', 'error', 0, :error, :started, :completed)"""),
                    {"error": str(e), "started": started, "completed": datetime.utcnow()},
                )
                await session.commit()
        except Exception:
            pass
        await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "boards", "status": "error"})
        return {"status": "error", "error": str(e)}


async def sync_flowup_members():
    """Full sync of FlowUp membro table into fu_members."""
    logger.info("Starting Flowup members sync...")
    started = datetime.utcnow()

    try:
        conn = await aiomysql.connect(
            host=settings.flowup_host,
            port=settings.flowup_port,
            user=settings.flowup_user,
            password=settings.flowup_password,
            db=settings.flowup_db,
            ssl=_make_ssl_ctx(),
        )
        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute("SELECT Id AS fu_member_id, Nome AS name FROM membro ORDER BY Id")
                rows = await cursor.fetchall()
        finally:
            conn.close()

        async with async_session() as session:
            count = 0
            for row in rows:
                await session.execute(
                    text("""
                        INSERT INTO fu_members (fu_member_id, name, synced_at)
                        VALUES (:fu_member_id, :name, :synced_at)
                        ON CONFLICT (fu_member_id) DO UPDATE SET
                            name = EXCLUDED.name,
                            synced_at = EXCLUDED.synced_at
                    """),
                    {**row, "synced_at": datetime.utcnow()},
                )
                count += 1

            await session.execute(
                text("""INSERT INTO sync_log (source, entity, status, records_synced, started_at, completed_at)
                        VALUES ('flowup', 'members', 'success', :count, :started, :completed)"""),
                {"count": count, "started": started, "completed": datetime.utcnow()},
            )
            await session.commit()

        logger.info(f"  Synced {count} Flowup members")
        await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "members", "status": "success", "records_synced": count})
        await notify_ws({"type": "sync_complete", "source": "flowup"})
        return {"status": "success", "count": count}

    except Exception as e:
        logger.error(f"  Flowup members sync error: {e}")
        try:
            async with async_session() as session:
                await session.execute(
                    text("""INSERT INTO sync_log (source, entity, status, records_synced, error_message, started_at, completed_at)
                            VALUES ('flowup', 'members', 'error', 0, :error, :started, :completed)"""),
                    {"error": str(e), "started": started, "completed": datetime.utcnow()},
                )
                await session.commit()
        except Exception:
            pass
        await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "members", "status": "error"})
        return {"status": "error", "error": str(e)}


async def sync_fu_boards():
    """Full sync of FlowUp boards table into fu_boards."""
    logger.info("Starting FlowUp fu_boards sync...")
    started = datetime.utcnow()

    try:
        conn = await aiomysql.connect(
            host=settings.flowup_host,
            port=settings.flowup_port,
            user=settings.flowup_user,
            password=settings.flowup_password,
            db=settings.flowup_db,
            ssl=_make_ssl_ctx(),
        )
        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute(
                    "SELECT Id AS fu_board_id, Name AS fu_board_name, CostCenterId AS fu_cost_center_id "
                    "FROM boards WHERE Active = 1 ORDER BY Id"
                )
                rows = await cursor.fetchall()
        finally:
            conn.close()

        async with async_session() as session:
            count = 0
            for row in rows:
                await session.execute(
                    text("""
                        INSERT INTO fu_boards (fu_board_id, fu_board_name, fu_cost_center_id, synced_at)
                        VALUES (:fu_board_id, :fu_board_name, :fu_cost_center_id, :synced_at)
                        ON CONFLICT (fu_board_id) DO UPDATE SET
                            fu_board_name = EXCLUDED.fu_board_name,
                            fu_cost_center_id = EXCLUDED.fu_cost_center_id,
                            synced_at = EXCLUDED.synced_at
                    """),
                    {**row, "synced_at": datetime.utcnow()},
                )
                count += 1

            await session.execute(
                text("""INSERT INTO sync_log (source, entity, status, records_synced, started_at, completed_at)
                        VALUES ('flowup', 'fu_boards', 'success', :count, :started, :completed)"""),
                {"count": count, "started": started, "completed": datetime.utcnow()},
            )
            await session.commit()

        logger.info(f"  Synced {count} FlowUp boards")
        await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "fu_boards", "status": "success", "records_synced": count})
        return {"status": "success", "count": count}

    except Exception as e:
        logger.error(f"  FlowUp fu_boards sync error: {e}")
        try:
            async with async_session() as session:
                await session.execute(
                    text("""INSERT INTO sync_log (source, entity, status, records_synced, error_message, started_at, completed_at)
                            VALUES ('flowup', 'fu_boards', 'error', 0, :error, :started, :completed)"""),
                    {"error": str(e), "started": started, "completed": datetime.utcnow()},
                )
                await session.commit()
        except Exception:
            pass
        return {"status": "error", "error": str(e)}


async def sync_fu_board_tasks():
    """Full sync of FlowUp tasks table into fu_board_tasks."""
    logger.info("Starting FlowUp fu_board_tasks sync...")
    started = datetime.utcnow()

    try:
        conn = await aiomysql.connect(
            host=settings.flowup_host,
            port=settings.flowup_port,
            user=settings.flowup_user,
            password=settings.flowup_password,
            db=settings.flowup_db,
            ssl=_make_ssl_ctx(),
        )
        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute(
                    "SELECT Id AS fu_task_id, BoardId AS fu_board_id FROM tasks WHERE Active = 1 ORDER BY Id"
                )
                rows = await cursor.fetchall()
        finally:
            conn.close()

        async with async_session() as session:
            count = 0
            for row in rows:
                await session.execute(
                    text("""
                        INSERT INTO fu_board_tasks (fu_task_id, fu_board_id, synced_at)
                        VALUES (:fu_task_id, :fu_board_id, :synced_at)
                        ON CONFLICT (fu_task_id) DO UPDATE SET
                            fu_board_id = EXCLUDED.fu_board_id,
                            synced_at = EXCLUDED.synced_at
                    """),
                    {**row, "synced_at": datetime.utcnow()},
                )
                count += 1

            await session.execute(
                text("""INSERT INTO sync_log (source, entity, status, records_synced, started_at, completed_at)
                        VALUES ('flowup', 'fu_board_tasks', 'success', :count, :started, :completed)"""),
                {"count": count, "started": started, "completed": datetime.utcnow()},
            )
            await session.commit()

        logger.info(f"  Synced {count} FlowUp board tasks")
        await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "fu_board_tasks", "status": "success", "records_synced": count})
        return {"status": "success", "count": count}

    except Exception as e:
        logger.error(f"  FlowUp fu_board_tasks sync error: {e}")
        try:
            async with async_session() as session:
                await session.execute(
                    text("""INSERT INTO sync_log (source, entity, status, records_synced, error_message, started_at, completed_at)
                            VALUES ('flowup', 'fu_board_tasks', 'error', 0, :error, :started, :completed)"""),
                    {"error": str(e), "started": started, "completed": datetime.utcnow()},
                )
                await session.commit()
        except Exception:
            pass
        return {"status": "error", "error": str(e)}


async def sync_flowup_reports():
    """Incremental sync of Flowup time reports from MySQL replica."""
    logger.info("Starting Flowup sync...")
    started = datetime.utcnow()

    try:
        # Get last synced fu_id
        async with async_session() as session:
            result = await session.execute(text("SELECT COALESCE(MAX(fu_id), 0) FROM flowup_reports"))
            last_id = result.scalar() or 0

        conn = await aiomysql.connect(
            host=settings.flowup_host,
            port=settings.flowup_port,
            user=settings.flowup_user,
            password=settings.flowup_password,
            db=settings.flowup_db,
            ssl=_make_ssl_ctx(),
        )

        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute(
                    """
                    SELECT
                        r.Id            AS fu_id,
                        r.Projeto_Id    AS fu_project_id,
                        r.Task_Id       AS fu_task_id,
                        r.Membro_Id     AS fu_member_id,
                        m.Nome          AS fu_member_name,
                        r.HorarioInicio AS start_datetime,
                        r.HorarioFim    AS end_datetime,
                        r.HorasTrabalhadas AS worked_hours,
                        r.Detalhes      AS description
                    FROM reportagem r
                    LEFT JOIN membro m ON r.Membro_Id = m.Id
                    WHERE r.Id > %s
                    ORDER BY r.Id
                    LIMIT 5000
                    """,
                    (last_id,),
                )
                rows = await cursor.fetchall()
        finally:
            conn.close()

        if not rows:
            logger.info("  No new Flowup reports")
            async with async_session() as session:
                await session.execute(
                    text("""INSERT INTO sync_log (source, entity, status, records_synced, started_at, completed_at)
                            VALUES ('flowup', 'reports', 'success', 0, :started, :completed)"""),
                    {"started": started, "completed": datetime.utcnow()},
                )
                await session.commit()
            await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "reports", "status": "success", "records_synced": 0})
            await notify_ws({"type": "sync_complete", "source": "flowup"})
            return {"status": "success", "count": 0}

        # Insert into PostgreSQL
        async with async_session() as session:
            count = 0
            for row in rows:
                await session.execute(
                    text("""
                        INSERT INTO flowup_reports
                            (fu_id, fu_project_id, fu_task_id, fu_member_id, fu_member_name,
                             start_datetime, end_datetime, worked_hours, description, synced_at)
                        VALUES
                            (:fu_id, :fu_project_id, :fu_task_id, :fu_member_id, :fu_member_name,
                             :start_datetime, :end_datetime, :worked_hours, :description, :synced_at)
                        ON CONFLICT (fu_id) DO UPDATE SET
                            fu_project_id = EXCLUDED.fu_project_id,
                            fu_task_id = EXCLUDED.fu_task_id,
                            fu_member_id = EXCLUDED.fu_member_id,
                            fu_member_name = EXCLUDED.fu_member_name,
                            start_datetime = EXCLUDED.start_datetime,
                            end_datetime = EXCLUDED.end_datetime,
                            worked_hours = EXCLUDED.worked_hours,
                            description = EXCLUDED.description,
                            synced_at = EXCLUDED.synced_at
                    """),
                    {**row, "synced_at": datetime.utcnow()},
                )
                count += 1

            await session.execute(
                text("""INSERT INTO sync_log (source, entity, status, records_synced, started_at, completed_at)
                        VALUES ('flowup', 'reports', 'success', :count, :started, :completed)"""),
                {"count": count, "started": started, "completed": datetime.utcnow()},
            )
            await session.commit()

        logger.info(f"  Synced {count} Flowup reports")
        await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "reports", "status": "success", "records_synced": count})
        await notify_ws({"type": "sync_complete", "source": "flowup"})
        return {"status": "success", "count": count}

    except Exception as e:
        logger.error(f"  Flowup sync error: {e}")
        try:
            async with async_session() as session:
                await session.execute(
                    text("""INSERT INTO sync_log (source, entity, status, records_synced, error_message, started_at, completed_at)
                            VALUES ('flowup', 'reports', 'error', 0, :error, :started, :completed)"""),
                    {"error": str(e), "started": started, "completed": datetime.utcnow()},
                )
                await session.commit()
        except Exception:
            pass
        await notify_ws({"type": "sync_progress", "source": "flowup", "entity": "reports", "status": "error"})
        return {"status": "error", "error": str(e)}

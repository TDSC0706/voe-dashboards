import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.database import engine, Base
from app.core.ws import ws_clients, notify_ws  # noqa: F401
from app.models.voe import *  # noqa: F401,F403
from app.sync.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MATERIALIZED_VIEWS_SQL = [
    """
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_project_health AS
    SELECT
        p.id AS project_id, p.voe_id, p.title, p.status, p.is_delayed,
        p.start_date, p.planned_end_date, p.actual_end_date,
        p.selling_price, p.profit_margin, p.extra_proj_cost,
        c.name AS customer_name,
        CASE WHEN p.is_delayed THEN 35 ELSE 0 END +
        CASE WHEN p.planned_end_date < NOW() AND p.actual_end_date IS NULL THEN 25 ELSE 0 END +
        CASE WHEN (
            SELECT COUNT(*) FILTER (WHERE a.status NOT IN ('COMPLETED', 'CANCELED'))::float /
                   NULLIF(COUNT(*), 0)
            FROM activities a
            JOIN backlog_items bi ON a.backlog_item_id = bi.id
            JOIN deliverables d ON bi.deliverable_id = d.id
            WHERE d.project_id = p.id
        ) > 0.5 AND p.planned_end_date IS NOT NULL
            AND (NOW() - p.start_date) > 0.75 * (p.planned_end_date - p.start_date)
        THEN 20 ELSE 0 END AS schedule_risk,
        COALESCE((SELECT SUM(r.cost) FROM resources r WHERE r.project_id = p.id), 0) AS total_cost,
        COALESCE(p.selling_price, 0) - COALESCE((SELECT SUM(r.cost) FROM resources r WHERE r.project_id = p.id), 0) - COALESCE(p.extra_proj_cost, 0) AS remaining_budget,
        (SELECT COUNT(*) FROM activities a JOIN backlog_items bi ON a.backlog_item_id = bi.id JOIN deliverables d ON bi.deliverable_id = d.id WHERE d.project_id = p.id AND a.status NOT IN ('COMPLETED', 'CANCELED')) AS open_activities,
        (SELECT COUNT(*) FROM backlog_items bi JOIN deliverables d ON bi.deliverable_id = d.id WHERE d.project_id = p.id AND bi.item_type = 'BUG_FIX') AS bug_count,
        (SELECT COUNT(*) FROM deliverables d WHERE d.project_id = p.id) AS deliverable_count
    FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.is_active = true
    """,
    """
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_team_workload AS
    SELECT
        tm.id AS team_member_id, tm.voe_id, tm.full_name, tm.name,
        pr.working_hours AS weekly_capacity, pr.id AS profile_id,
        (SELECT COUNT(*) FROM activities a WHERE a.profile_id = pr.id AND a.status IN ('ONGOING', 'TO_DO', 'PLANNED')) AS active_activities,
        COALESCE((SELECT SUM(a.estimation_hours - COALESCE(a.work_hours, 0)) FROM activities a WHERE a.profile_id = pr.id AND a.status NOT IN ('COMPLETED', 'CANCELED')), 0) AS pending_hours,
        CASE WHEN pr.working_hours > 0 THEN
            ROUND(COALESCE((SELECT SUM(a.estimation_hours - COALESCE(a.work_hours, 0)) FROM activities a WHERE a.profile_id = pr.id AND a.status NOT IN ('COMPLETED', 'CANCELED')), 0) / pr.working_hours * 100, 1)
        ELSE 0 END AS utilization_pct,
        CASE
            WHEN pr.working_hours > 0 AND COALESCE((SELECT SUM(a.estimation_hours - COALESCE(a.work_hours, 0)) FROM activities a WHERE a.profile_id = pr.id AND a.status NOT IN ('COMPLETED', 'CANCELED')), 0) / pr.working_hours > 2.0 THEN 'CRITICAL'
            WHEN pr.working_hours > 0 AND COALESCE((SELECT SUM(a.estimation_hours - COALESCE(a.work_hours, 0)) FROM activities a WHERE a.profile_id = pr.id AND a.status NOT IN ('COMPLETED', 'CANCELED')), 0) / pr.working_hours > 1.5 THEN 'OVERLOADED'
            ELSE 'OK'
        END AS overload_flag
    FROM team_members tm
    JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
    WHERE tm.active = true AND tm.is_active = true
    """,
    """
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_iteration_progress AS
    WITH health AS (
        SELECT
            i.id,
            COALESCE((
                SELECT SUM(ee.total_hours) FROM energy_entries ee
                WHERE ee.activity_id IN (
                    SELECT DISTINCT activity_id FROM activity_states
                    WHERE iteration_id = i.id AND status = 'COMPLETED')
            ), 0) AS completed_hours,
            COALESCE((
                SELECT SUM(a.estimation_hours) FROM activities a
                WHERE a.id IN (SELECT DISTINCT activity_id FROM activity_states WHERE iteration_id = i.id)
                  AND a.id NOT IN (SELECT DISTINCT activity_id FROM activity_states WHERE iteration_id = i.id AND status = 'COMPLETED')
            ), 0) AS remaining_hours,
            LEAST(EXTRACT(DAY FROM NOW() - i.start_date),
                  EXTRACT(DAY FROM i.end_date - i.start_date)) AS elapsed_days,
            GREATEST(0, EXTRACT(DAY FROM i.end_date - NOW())) AS days_remaining
        FROM iterations i WHERE i.is_active = true
    )
    SELECT
        i.id AS iteration_id, i.voe_id, i.code, i.status, i.state,
        i.start_date, i.end_date, i.goal,
        pr.title AS product_title, pr.code AS product_code,
        COALESCE((
            SELECT COUNT(DISTINCT ast.activity_id) FILTER (WHERE ast.status = 'COMPLETED')::float
                   / NULLIF(COUNT(DISTINCT ast.activity_id), 0) * 100
            FROM activity_states ast WHERE ast.iteration_id = i.id
        ), 0) AS completion_pct,
        COALESCE((
            SELECT SUM(ee.total_hours) FROM energy_entries ee
            WHERE ee.activity_id IN (SELECT activity_id FROM activity_states WHERE iteration_id = i.id)
        ), 0) AS hours_spent,
        GREATEST(0, EXTRACT(DAY FROM i.end_date - NOW())) AS days_remaining,
        (SELECT COUNT(DISTINCT ast.activity_id) FROM activity_states ast WHERE ast.iteration_id = i.id) AS total_activities,
        (SELECT COUNT(DISTINCT ast.activity_id) FROM activity_states ast WHERE ast.iteration_id = i.id AND ast.status = 'COMPLETED') AS completed_activities,
        CASE
            WHEN i.status IN ('COMPLETED', 'CANCELED') THEN i.status
            WHEN h.days_remaining = 0 AND h.remaining_hours > 0 THEN 'OVERDUE'
            WHEN h.days_remaining > 0 AND (
                h.completed_hours = 0
                OR h.remaining_hours / (h.completed_hours / GREATEST(h.elapsed_days, 1)) > h.days_remaining
            ) THEN 'AT_RISK'
            ELSE 'ON_TRACK'
        END AS health_status
    FROM iterations i
    LEFT JOIN products pr ON i.product_id = pr.id
    JOIN health h ON h.id = i.id
    WHERE i.is_active = true
    """,
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")

    # Schema migrations for existing databases
    async with engine.begin() as conn:
        for stmt in [
            "ALTER TABLE team_members ALTER COLUMN name DROP NOT NULL",
            "ALTER TABLE team_members ALTER COLUMN active DROP NOT NULL",
            "ALTER TABLE fu_cost_centers ALTER COLUMN voe_id DROP NOT NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS uix_fu_cost_centers_fu_project_id ON fu_cost_centers (fu_project_id) WHERE fu_project_id IS NOT NULL",
            # Recreate mv_iteration_progress to use energy_entries for hours_spent
            "DROP MATERIALIZED VIEW IF EXISTS mv_iteration_progress",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
    logger.info("Schema migrations applied")

    # Pre-seed app_config defaults
    async with engine.begin() as conn:
        try:
            await conn.execute(text("""
                INSERT INTO app_config (key, value) VALUES
                    ('odata_sync_interval', '300'),
                    ('flowup_sync_interval', '600')
                ON CONFLICT (key) DO NOTHING
            """))
        except Exception:
            pass

    # Seed default admin user
    from app.core.auth import get_password_hash
    async with engine.begin() as conn:
        try:
            await conn.execute(text("""
                INSERT INTO app_users (username, password_hash, full_name, is_admin, is_active)
                VALUES ('admin', :hash, 'Administrador', true, true)
                ON CONFLICT (username) DO NOTHING
            """), {"hash": get_password_hash("admin123")})
        except Exception:
            pass
    logger.info("Default admin user ensured (admin / admin123)")

    # Create materialized views
    async with engine.begin() as conn:
        for sql in MATERIALIZED_VIEWS_SQL:
            try:
                await conn.execute(text(sql))
            except Exception as e:
                logger.warning(f"MV creation note: {e}")
    logger.info("Materialized views ensured")

    await start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="VOE Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/updates")
async def websocket_updates(websocket: WebSocket):
    await websocket.accept()
    ws_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_clients.discard(websocket)



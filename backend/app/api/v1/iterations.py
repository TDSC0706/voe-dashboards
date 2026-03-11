from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/iterations", tags=["iterations"])


@router.get("")
async def list_iterations(
    status: str | None = Query(None),
    product_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("SELECT * FROM mv_iteration_progress ORDER BY start_date DESC"))
    rows = [dict(r._mapping) for r in result.fetchall()]
    if status:
        rows = [r for r in rows if r["status"] == status]
    if product_id:
        rows = [r for r in rows if r.get("product_id") == product_id]
    return rows


@router.get("/{iteration_id}")
async def get_iteration(iteration_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM mv_iteration_progress WHERE iteration_id = :id"),
        {"id": iteration_id},
    )
    row = result.first()
    if not row:
        return {"error": "Not found"}
    return dict(row._mapping)


@router.get("/{iteration_id}/burndown")
async def iteration_burndown(iteration_id: int, db: AsyncSession = Depends(get_db)):
    """Returns daily cumulative hours data for burndown chart."""
    result = await db.execute(
        text("""
            WITH iteration_info AS (
                SELECT start_date, end_date FROM iterations WHERE id = :id
            ),
            daily_work AS (
                SELECT
                    DATE(ee.start_date_time) AS work_date,
                    SUM(ee.total_hours) AS hours_worked
                FROM energy_entries ee
                JOIN activities a ON ee.activity_id = a.id
                JOIN activity_states ast ON ast.activity_id = a.id AND ast.iteration_id = :id
                WHERE ee.start_date_time IS NOT NULL
                GROUP BY DATE(ee.start_date_time)
                ORDER BY work_date
            )
            SELECT
                dw.work_date,
                dw.hours_worked,
                SUM(dw.hours_worked) OVER (ORDER BY dw.work_date) AS cumulative_hours,
                (SELECT SUM(a.estimation_hours)
                 FROM activities a
                 WHERE a.id IN (SELECT activity_id FROM activity_states WHERE iteration_id = :id)) AS total_estimated
            FROM daily_work dw
        """),
        {"id": iteration_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/{iteration_id}/forecast")
async def iteration_forecast(iteration_id: int, db: AsyncSession = Depends(get_db)):
    """Compute iteration completion forecast."""
    result = await db.execute(
        text("""
            SELECT
                i.start_date,
                i.end_date,
                LEAST(EXTRACT(DAY FROM NOW() - i.start_date), EXTRACT(DAY FROM i.end_date - i.start_date)) AS elapsed_days,
                GREATEST(0, EXTRACT(DAY FROM i.end_date - NOW())) AS days_remaining,
                COALESCE((
                    SELECT SUM(ee.total_hours)
                    FROM energy_entries ee
                    WHERE ee.activity_id IN (
                        SELECT DISTINCT activity_id FROM activity_states
                        WHERE iteration_id = i.id AND status = 'COMPLETED'
                    )
                ), 0) AS completed_hours,
                COALESCE((
                    SELECT SUM(a.estimation_hours)
                    FROM activities a
                    WHERE a.id IN (SELECT DISTINCT activity_id FROM activity_states WHERE iteration_id = i.id)
                ), 0) AS total_hours,
                COALESCE((
                    SELECT SUM(a.estimation_hours)
                    FROM activities a
                    WHERE a.id IN (SELECT DISTINCT activity_id FROM activity_states WHERE iteration_id = i.id)
                      AND a.id NOT IN (SELECT DISTINCT activity_id FROM activity_states WHERE iteration_id = i.id AND status = 'COMPLETED')
                ), 0) AS remaining_hours
            FROM iterations i
            WHERE i.id = :id
            GROUP BY i.id
        """),
        {"id": iteration_id},
    )
    row = result.first()
    if not row:
        return {"error": "Not found"}

    data = dict(row._mapping)
    elapsed = float(data["elapsed_days"] or 1)
    completed = float(data["completed_hours"] or 0)
    remaining = float(data["remaining_hours"] or 0)
    days_left = float(data["days_remaining"] or 0)

    velocity = completed / max(elapsed, 1)
    days_needed = remaining / velocity if velocity > 0 else float("inf")
    on_track = days_needed <= days_left if days_left > 0 else remaining == 0

    data["daily_velocity"] = round(velocity, 2)
    data["days_needed"] = round(days_needed, 1) if days_needed != float("inf") else None
    data["on_track"] = on_track
    return data


@router.get("/{iteration_id}/activities")
async def iteration_activities(iteration_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT DISTINCT ON (a.id)
                ast.*, a.title AS activity_title, a.domain, a.estimation_hours,
                p.description AS profile_name, tm.full_name AS member_name,
                (SELECT COALESCE(SUM(ee.total_hours), 0) FROM energy_entries ee WHERE ee.activity_id = a.id) AS activity_total_hours,
                proj.title AS project_name
            FROM activity_states ast
            JOIN activities a ON ast.activity_id = a.id
            LEFT JOIN profiles p ON ast.profile_id = p.id
            LEFT JOIN team_members tm ON p.team_member_id = tm.id
            LEFT JOIN backlog_items bi ON a.backlog_item_id = bi.id
            LEFT JOIN deliverables d ON bi.deliverable_id = d.id
            LEFT JOIN projects proj ON d.project_id = proj.id
            WHERE ast.iteration_id = :id
            ORDER BY a.id,
                CASE ast.status WHEN 'COMPLETED' THEN 1 WHEN 'ONGOING' THEN 2 WHEN 'IN_PROGRESS' THEN 3 ELSE 4 END,
                a.title
        """),
        {"id": iteration_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]

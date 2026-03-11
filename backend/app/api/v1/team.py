from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/team", tags=["team"])


@router.get("")
async def list_team(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM mv_team_workload ORDER BY full_name")
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/all")
async def list_all_members(db: AsyncSession = Depends(get_db)):
    """All team members directly from team_members table (no profile required)."""
    result = await db.execute(
        text("SELECT id, voe_id, full_name, name, email FROM team_members WHERE is_active = true ORDER BY full_name")
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/{member_id}")
async def get_member(member_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM mv_team_workload WHERE team_member_id = :id"),
        {"id": member_id},
    )
    row = result.first()
    if not row:
        return {"error": "Not found"}
    return dict(row._mapping)


@router.get("/{member_id}/timesheet")
async def member_timesheet(member_id: int, db: AsyncSession = Depends(get_db)):
    """Combined VOE energy + Flowup hours for a team member."""
    # VOE energy data
    voe_result = await db.execute(
        text("""
            SELECT
                DATE(ee.start_date_time) AS work_date,
                SUM(ee.total_hours) AS voe_hours,
                SUM(ee.total_cost) AS voe_cost
            FROM energy_entries ee
            JOIN profiles p ON ee.profile_id = p.id
            WHERE p.team_member_id = :id AND ee.start_date_time IS NOT NULL
            GROUP BY DATE(ee.start_date_time)
            ORDER BY work_date DESC
            LIMIT 90
        """),
        {"id": member_id},
    )
    voe_data = [dict(r._mapping) for r in voe_result.fetchall()]

    # Flowup data via user mapping
    fu_result = await db.execute(
        text("""
            SELECT
                DATE(fr.start_datetime) AS work_date,
                SUM(fr.worked_hours) AS flowup_hours
            FROM flowup_reports fr
            JOIN fu_users fu ON fr.fu_member_id = fu.fu_user_id
            WHERE fu.team_member_id = :id AND fr.start_datetime IS NOT NULL
            GROUP BY DATE(fr.start_datetime)
            ORDER BY work_date DESC
            LIMIT 90
        """),
        {"id": member_id},
    )
    fu_data = [dict(r._mapping) for r in fu_result.fetchall()]

    return {"voe_hours": voe_data, "flowup_hours": fu_data}


@router.get("/{member_id}/projects")
async def member_projects(member_id: int, db: AsyncSession = Depends(get_db)):
    """Projects where this member has activities."""
    result = await db.execute(
        text("""
            SELECT DISTINCT p.id, p.title, p.status,
                   COUNT(a.id) AS activity_count,
                   SUM(a.estimation_hours) AS total_estimated,
                   SUM(a.work_hours) AS total_worked
            FROM projects p
            JOIN deliverables d ON d.project_id = p.id
            JOIN backlog_items bi ON bi.deliverable_id = d.id
            JOIN activities a ON a.backlog_item_id = bi.id
            JOIN profiles pr ON a.profile_id = pr.id
            WHERE pr.team_member_id = :id
            GROUP BY p.id, p.title, p.status
            ORDER BY activity_count DESC
        """),
        {"id": member_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]

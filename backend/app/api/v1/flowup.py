from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/flowup", tags=["flowup"])


class BoardMapUpdate(BaseModel):
    project_id: int | None = None


class ProjectMappingUpdate(BaseModel):
    mapping_type: str  # 'cost_center' | 'board'
    fu_cost_center_id: int | None = None
    fu_board_id: int | None = None


@router.get("/reports")
async def flowup_reports(
    project_id: int | None = Query(None),
    member_id: int | None = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
):
    sql = """
        SELECT fr.*, fcc.fu_project_name, p.title AS project_title
        FROM flowup_reports fr
        LEFT JOIN fu_cost_centers fcc ON fr.fu_project_id = fcc.fu_project_id
        LEFT JOIN projects p ON fcc.project_id = p.id
        WHERE 1=1
    """
    params: dict = {"limit": limit}
    if project_id:
        sql += " AND fcc.project_id = :project_id"
        params["project_id"] = project_id
    if member_id:
        sql += " AND fr.fu_member_id IN (SELECT fu_user_id FROM fu_users WHERE team_member_id = :member_id)"
        params["member_id"] = member_id
    sql += " ORDER BY fr.start_datetime DESC LIMIT :limit"

    result = await db.execute(text(sql), params)
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/members")
async def flowup_members(db: AsyncSession = Depends(get_db)):
    """List all FlowUp members (from membro table) for use in user mapping."""
    result = await db.execute(
        text("SELECT fu_member_id, name FROM fu_members ORDER BY name")
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/hours-by-member")
async def hours_by_member(
    project_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Hours worked per VOE team member per project, via user_mappings."""
    sql = """
        SELECT
            tm.id           AS team_member_id,
            tm.full_name    AS member_name,
            p.id            AS project_id,
            p.title         AS project_title,
            SUM(fr.worked_hours) AS total_hours
        FROM flowup_reports fr
        JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
        JOIN team_members tm ON um.team_member_id = tm.id
        JOIN fu_cost_centers fcc ON fr.fu_project_id = fcc.fu_project_id
        JOIN projects p ON fcc.project_id = p.id
        WHERE fr.worked_hours IS NOT NULL
    """
    params: dict = {}
    if project_id:
        sql += " AND p.id = :project_id"
        params["project_id"] = project_id
    sql += " GROUP BY tm.id, tm.full_name, p.id, p.title ORDER BY tm.full_name, p.title"

    result = await db.execute(text(sql), params)
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/boards")
async def flowup_boards(db: AsyncSession = Depends(get_db)):
    """List FlowUp boards/projects synced into fu_cost_centers with their VOE project mappings."""
    result = await db.execute(
        text("""
            SELECT fcc.id, fcc.fu_project_id, fcc.fu_project_name,
                   fcc.fu_board_id, fcc.fu_board_name,
                   fcc.project_id, p.title AS project_title
            FROM fu_cost_centers fcc
            LEFT JOIN projects p ON fcc.project_id = p.id
            ORDER BY fcc.fu_project_name NULLS LAST
        """)
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/boards/{board_id}/map")
async def map_board(board_id: int, body: BoardMapUpdate, db: AsyncSession = Depends(get_db)):
    """Set the VOE project mapping for a FlowUp board."""
    await db.execute(
        text("UPDATE fu_cost_centers SET project_id = :project_id WHERE id = :id"),
        {"project_id": body.project_id, "id": board_id},
    )
    await db.commit()
    return {"message": "Mapped"}


@router.get("/fu-boards")
async def fu_boards(db: AsyncSession = Depends(get_db)):
    """List fu_boards joined with fu_cost_centers for display."""
    result = await db.execute(
        text("""
            SELECT fb.fu_board_id, fb.fu_board_name, fb.fu_cost_center_id,
                   fcc.fu_project_name AS cost_center_name
            FROM fu_boards fb
            LEFT JOIN fu_cost_centers fcc ON fb.fu_cost_center_id = fcc.fu_project_id
            ORDER BY fcc.fu_project_name NULLS LAST, fb.fu_board_name
        """)
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/project-mappings")
async def project_mappings(db: AsyncSession = Depends(get_db)):
    """List all project_flowup_mappings with names for display."""
    result = await db.execute(
        text("""
            SELECT pfm.*, p.title AS project_title,
                   fcc.fu_project_name AS cost_center_name,
                   fb.fu_board_name AS board_name
            FROM project_flowup_mappings pfm
            JOIN projects p ON pfm.project_id = p.id
            LEFT JOIN fu_cost_centers fcc ON pfm.fu_cost_center_id = fcc.fu_project_id
            LEFT JOIN fu_boards fb ON pfm.fu_board_id = fb.fu_board_id
            ORDER BY p.title
        """)
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/project-mapping/{project_id}")
async def upsert_project_mapping(
    project_id: int, body: ProjectMappingUpdate, db: AsyncSession = Depends(get_db)
):
    """Upsert a FlowUp mapping for a VOE project."""
    await db.execute(
        text("""
            INSERT INTO project_flowup_mappings
                (project_id, mapping_type, fu_cost_center_id, fu_board_id, created_at, updated_at)
            VALUES (:project_id, :mapping_type, :fu_cost_center_id, :fu_board_id, now(), now())
            ON CONFLICT (project_id) DO UPDATE SET
                mapping_type = EXCLUDED.mapping_type,
                fu_cost_center_id = EXCLUDED.fu_cost_center_id,
                fu_board_id = EXCLUDED.fu_board_id,
                updated_at = now()
        """),
        {
            "project_id": project_id,
            "mapping_type": body.mapping_type,
            "fu_cost_center_id": body.fu_cost_center_id,
            "fu_board_id": body.fu_board_id,
        },
    )
    await db.commit()
    return {"message": "Saved"}


@router.get("/user-hours")
async def user_hours(
    member_id: int | None = Query(None),
    group_by: str = Query("none"),  # "none" | "month" | "week"
    start_date: str | None = Query(None),  # YYYY-MM-DD
    end_date: str | None = Query(None),    # YYYY-MM-DD
    db: AsyncSession = Depends(get_db),
):
    """Hours per team member per project, optionally grouped by month or week."""
    # Resolve project using the same 3-tier mapping logic as flowup-cost:
    #   1. board mapping (fu_task_id -> fu_board_tasks -> fu_boards -> project_flowup_mappings)
    #   2. cost_center mapping (fu_project_id -> project_flowup_mappings)
    #   3. fallback direct (fu_project_id -> fu_cost_centers.project_id)
    base = """
        FROM flowup_reports fr
        JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
        JOIN team_members tm ON um.team_member_id = tm.id
        LEFT JOIN fu_board_tasks fbt ON fbt.fu_task_id = fr.fu_task_id
        LEFT JOIN fu_boards fb ON fb.fu_board_id = fbt.fu_board_id
        LEFT JOIN project_flowup_mappings pfm_b
               ON pfm_b.fu_board_id = fb.fu_board_id AND pfm_b.mapping_type = 'board'
        LEFT JOIN project_flowup_mappings pfm_cc
               ON pfm_cc.fu_cost_center_id = fr.fu_project_id AND pfm_cc.mapping_type = 'cost_center'
        LEFT JOIN fu_cost_centers fcc ON fcc.fu_project_id = fr.fu_project_id
        JOIN projects p ON p.id = COALESCE(pfm_b.project_id, pfm_cc.project_id, fcc.project_id)
        WHERE fr.worked_hours IS NOT NULL
    """
    params: dict = {}
    if member_id:
        base += " AND tm.id = :member_id"
        params["member_id"] = member_id
    if start_date:
        base += " AND fr.start_datetime >= :start_date"
        params["start_date"] = date_type.fromisoformat(start_date)
    if end_date:
        base += " AND fr.start_datetime < :end_date_excl"
        params["end_date_excl"] = date_type.fromisoformat(end_date) + timedelta(days=1)

    if group_by == "month":
        sql = f"""
            SELECT tm.id AS team_member_id, tm.full_name AS member_name,
                   p.id AS project_id, p.title AS project_title,
                   TO_CHAR(fr.start_datetime, 'MM/YYYY') AS period,
                   SUM(fr.worked_hours) AS total_hours
            {base}
            GROUP BY tm.id, tm.full_name, p.id, p.title,
                     TO_CHAR(fr.start_datetime, 'MM/YYYY'),
                     DATE_TRUNC('month', fr.start_datetime)
            ORDER BY tm.full_name, DATE_TRUNC('month', fr.start_datetime), total_hours DESC
        """
    elif group_by == "week":
        sql = f"""
            SELECT tm.id AS team_member_id, tm.full_name AS member_name,
                   p.id AS project_id, p.title AS project_title,
                   CONCAT(
                       ((EXTRACT(DAY FROM fr.start_datetime)::int - 1) / 7 + 1)::text,
                       ' ',
                       TO_CHAR(fr.start_datetime, 'MM/YYYY')
                   ) AS period,
                   SUM(fr.worked_hours) AS total_hours
            {base}
            GROUP BY tm.id, tm.full_name, p.id, p.title,
                     CONCAT(
                         ((EXTRACT(DAY FROM fr.start_datetime)::int - 1) / 7 + 1)::text,
                         ' ',
                         TO_CHAR(fr.start_datetime, 'MM/YYYY')
                     ),
                     DATE_TRUNC('month', fr.start_datetime),
                     ((EXTRACT(DAY FROM fr.start_datetime)::int - 1) / 7 + 1)
            ORDER BY tm.full_name,
                     DATE_TRUNC('month', fr.start_datetime),
                     ((EXTRACT(DAY FROM fr.start_datetime)::int - 1) / 7 + 1),
                     total_hours DESC
        """
    else:
        sql = f"""
            SELECT tm.id AS team_member_id, tm.full_name AS member_name,
                   p.id AS project_id, p.title AS project_title,
                   NULL::text AS period,
                   SUM(fr.worked_hours) AS total_hours
            {base}
            GROUP BY tm.id, tm.full_name, p.id, p.title
            ORDER BY tm.full_name, total_hours DESC
        """

    result = await db.execute(text(sql), params)
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/discrepancy")
async def flowup_discrepancy(db: AsyncSession = Depends(get_db)):
    """Compare VOE energy hours vs Flowup reported hours per project."""
    result = await db.execute(
        text("""
            WITH voe_hours AS (
                SELECT p.id AS project_id, p.title,
                       COALESCE(SUM(ee.total_hours), 0) AS voe_total
                FROM projects p
                JOIN deliverables d ON d.project_id = p.id
                JOIN backlog_items bi ON bi.deliverable_id = d.id
                JOIN activities a ON a.backlog_item_id = bi.id
                JOIN energy_entries ee ON ee.activity_id = a.id
                GROUP BY p.id, p.title
            ),
            fu_hours AS (
                SELECT fcc.project_id,
                       COALESCE(SUM(fr.worked_hours), 0) AS fu_total
                FROM flowup_reports fr
                JOIN fu_cost_centers fcc ON fr.fu_project_id = fcc.fu_project_id
                GROUP BY fcc.project_id
            )
            SELECT v.project_id, v.title, v.voe_total, COALESCE(f.fu_total, 0) AS fu_total,
                   v.voe_total - COALESCE(f.fu_total, 0) AS difference
            FROM voe_hours v
            LEFT JOIN fu_hours f ON v.project_id = f.project_id
            ORDER BY ABS(v.voe_total - COALESCE(f.fu_total, 0)) DESC
        """)
    )
    return [dict(row._mapping) for row in result.fetchall()]

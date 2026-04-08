from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def list_projects(
    status: str | None = Query(None),
    is_active: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    sql = """
        SELECT p.*, c.name AS customer_name, pr.title AS product_title,
               tm.full_name AS accountable_name
        FROM projects p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN products pr ON p.product_id = pr.id
        LEFT JOIN team_members tm ON p.accountable_id = tm.id
        WHERE p.is_active = :is_active
    """
    params: dict = {"is_active": is_active}
    if status:
        sql += " AND p.status = :status"
        params["status"] = status
    sql += " ORDER BY p.start_date DESC"

    result = await db.execute(text(sql), params)
    rows = [dict(row._mapping) for row in result.fetchall()]

    # Enrich with FlowUp cost (same logic as /health)
    flowup_result = await db.execute(text("""
        SELECT project_id, SUM(flowup_cost) AS flowup_total_cost
        FROM (
            SELECT pm.project_id, SUM(fr.worked_hours * COALESCE(r.hourly_rate, 0)) AS flowup_cost
            FROM flowup_reports fr
            JOIN project_flowup_mappings pm
                ON pm.mapping_type = 'cost_center' AND pm.fu_cost_center_id IS NOT NULL
                AND fr.fu_project_id = pm.fu_cost_center_id
            JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
            JOIN team_members tm ON um.team_member_id = tm.id
            LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
            LEFT JOIN resources r ON r.project_id = pm.project_id AND r.position_id = pr.position_id AND r.is_active = true
            WHERE fr.worked_hours IS NOT NULL
            GROUP BY pm.project_id

            UNION ALL

            SELECT pm.project_id, SUM(fr.worked_hours * COALESCE(r.hourly_rate, 0)) AS flowup_cost
            FROM flowup_reports fr
            JOIN fu_board_tasks fbt ON fr.fu_task_id = fbt.fu_task_id
            JOIN project_flowup_mappings pm
                ON pm.mapping_type = 'board' AND pm.fu_board_id = fbt.fu_board_id
            JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
            JOIN team_members tm ON um.team_member_id = tm.id
            LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
            LEFT JOIN resources r ON r.project_id = pm.project_id AND r.position_id = pr.position_id AND r.is_active = true
            WHERE fr.worked_hours IS NOT NULL
            GROUP BY pm.project_id

            UNION ALL

            SELECT fcc.project_id, SUM(fr.worked_hours * COALESCE(r.hourly_rate, 0)) AS flowup_cost
            FROM flowup_reports fr
            JOIN fu_cost_centers fcc ON fr.fu_project_id = fcc.fu_project_id
            JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
            JOIN team_members tm ON um.team_member_id = tm.id
            LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
            LEFT JOIN resources r ON r.project_id = fcc.project_id AND r.position_id = pr.position_id AND r.is_active = true
            WHERE fr.worked_hours IS NOT NULL
            AND fcc.project_id NOT IN (
                SELECT project_id FROM project_flowup_mappings WHERE project_id IS NOT NULL
            )
            GROUP BY fcc.project_id
        ) combined
        GROUP BY project_id
    """))
    flowup_costs: dict[int, float] = {
        r.project_id: float(r.flowup_total_cost or 0)
        for r in flowup_result.fetchall()
    }

    for row in rows:
        fc = flowup_costs.get(row["id"], 0.0)
        selling = float(row.get("selling_price") or 0)
        extra = float(row.get("extra_proj_cost") or 0)
        row["flowup_total_cost"] = fc
        row["flowup_balance"] = selling - fc - extra

    return rows


@router.get("/health")
async def projects_health(db: AsyncSession = Depends(get_db)):
    health_result = await db.execute(text("SELECT * FROM mv_project_health ORDER BY schedule_risk DESC"))
    health_rows = [dict(row._mapping) for row in health_result.fetchall()]

    # Aggregate FlowUp cost per project across all mapping types in one query
    flowup_result = await db.execute(text("""
        SELECT project_id, SUM(flowup_cost) AS flowup_total_cost
        FROM (
            SELECT pm.project_id, SUM(fr.worked_hours * COALESCE(r.hourly_rate, 0)) AS flowup_cost
            FROM flowup_reports fr
            JOIN project_flowup_mappings pm
                ON pm.mapping_type = 'cost_center' AND pm.fu_cost_center_id IS NOT NULL
                AND fr.fu_project_id = pm.fu_cost_center_id
            JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
            JOIN team_members tm ON um.team_member_id = tm.id
            LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
            LEFT JOIN resources r ON r.project_id = pm.project_id AND r.position_id = pr.position_id AND r.is_active = true
            WHERE fr.worked_hours IS NOT NULL
            GROUP BY pm.project_id

            UNION ALL

            SELECT pm.project_id, SUM(fr.worked_hours * COALESCE(r.hourly_rate, 0)) AS flowup_cost
            FROM flowup_reports fr
            JOIN fu_board_tasks fbt ON fr.fu_task_id = fbt.fu_task_id
            JOIN project_flowup_mappings pm
                ON pm.mapping_type = 'board' AND pm.fu_board_id = fbt.fu_board_id
            JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
            JOIN team_members tm ON um.team_member_id = tm.id
            LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
            LEFT JOIN resources r ON r.project_id = pm.project_id AND r.position_id = pr.position_id AND r.is_active = true
            WHERE fr.worked_hours IS NOT NULL
            GROUP BY pm.project_id

            UNION ALL

            SELECT fcc.project_id, SUM(fr.worked_hours * COALESCE(r.hourly_rate, 0)) AS flowup_cost
            FROM flowup_reports fr
            JOIN fu_cost_centers fcc ON fr.fu_project_id = fcc.fu_project_id
            JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
            JOIN team_members tm ON um.team_member_id = tm.id
            LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
            LEFT JOIN resources r ON r.project_id = fcc.project_id AND r.position_id = pr.position_id AND r.is_active = true
            WHERE fr.worked_hours IS NOT NULL
            AND fcc.project_id NOT IN (
                SELECT project_id FROM project_flowup_mappings WHERE project_id IS NOT NULL
            )
            GROUP BY fcc.project_id
        ) combined
        GROUP BY project_id
    """))
    flowup_costs: dict[int, float] = {
        r.project_id: float(r.flowup_total_cost or 0)
        for r in flowup_result.fetchall()
    }

    for row in health_rows:
        fc = flowup_costs.get(row["project_id"], 0.0)
        selling = float(row.get("selling_price") or 0)
        extra = float(row.get("extra_proj_cost") or 0)
        row["flowup_total_cost"] = fc
        row["flowup_balance"] = selling - fc - extra

    return health_rows


@router.get("/{project_id}")
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT p.*, c.name AS customer_name, pr.title AS product_title,
                   tm.full_name AS accountable_name
            FROM projects p
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN products pr ON p.product_id = pr.id
            LEFT JOIN team_members tm ON p.accountable_id = tm.id
            WHERE p.id = :id
        """),
        {"id": project_id},
    )
    row = result.first()
    if not row:
        return {"error": "Not found"}
    return dict(row._mapping)


@router.get("/{project_id}/health")
async def project_health(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM mv_project_health WHERE project_id = :id"),
        {"id": project_id},
    )
    row = result.first()
    if not row:
        return {"error": "Not found"}
    return dict(row._mapping)


@router.get("/{project_id}/deliverables")
async def project_deliverables(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT d.*,
                   (SELECT COUNT(*) FROM backlog_items bi WHERE bi.deliverable_id = d.id) AS total_items,
                   (SELECT COUNT(*) FROM backlog_items bi
                    WHERE bi.deliverable_id = d.id AND bi.status IN ('COMPLETED', 'IN_PRODUCTION', 'ACCEPTED')
                   ) AS completed_items
            FROM deliverables d
            WHERE d.project_id = :id AND d.is_active = true
            ORDER BY d.deadline
        """),
        {"id": project_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/{project_id}/deliverables-tree")
async def project_deliverables_tree(project_id: int, db: AsyncSession = Depends(get_db)):
    del_result = await db.execute(
        text("""
            SELECT d.id, d.title, d.status, d.deadline,
                   CASE WHEN d.deadline < NOW() AND d.status NOT IN ('COMPLETED', 'CANCELED') THEN true ELSE false END AS is_delayed_flag,
                   (SELECT COUNT(*) FROM backlog_items bi WHERE bi.deliverable_id = d.id AND bi.is_active = true) AS total_items,
                   (SELECT COUNT(*) FROM backlog_items bi
                    WHERE bi.deliverable_id = d.id AND bi.is_active = true
                    AND bi.status IN ('COMPLETED', 'IN_PRODUCTION', 'ACCEPTED')) AS completed_items
            FROM deliverables d
            WHERE d.project_id = :pid AND d.is_active = true
            ORDER BY d.deadline
        """),
        {"pid": project_id},
    )
    deliverables = {row.id: {**dict(row._mapping), "backlog_items": []} for row in del_result.fetchall()}

    if not deliverables:
        return []

    bi_result = await db.execute(
        text("""
            SELECT bi.id, bi.code, bi.title, bi.status, bi.planned_end_date, bi.deliverable_id,
                   (SELECT COUNT(*) FROM activities a WHERE a.backlog_item_id = bi.id AND a.is_active = true) AS total_activities,
                   (SELECT COUNT(*) FROM activities a WHERE a.backlog_item_id = bi.id AND a.is_active = true
                    AND a.status IN ('COMPLETED', 'ACCEPTED')) AS completed_activities
            FROM backlog_items bi
            JOIN deliverables d ON bi.deliverable_id = d.id
            WHERE d.project_id = :pid AND bi.is_active = true
            ORDER BY bi.code
        """),
        {"pid": project_id},
    )
    backlog_items = {row.id: {**dict(row._mapping), "activities": []} for row in bi_result.fetchall()}

    act_result = await db.execute(
        text("""
            SELECT a.id, a.title, a.status, a.estimation_hours, a.work_hours, a.backlog_item_id,
                   tm.full_name AS member_name
            FROM activities a
            JOIN backlog_items bi ON a.backlog_item_id = bi.id
            JOIN deliverables d ON bi.deliverable_id = d.id
            LEFT JOIN profiles pr ON a.profile_id = pr.id
            LEFT JOIN team_members tm ON pr.team_member_id = tm.id
            WHERE d.project_id = :pid AND a.is_active = true
            ORDER BY a.status, a.title
        """),
        {"pid": project_id},
    )
    for row in act_result.fetchall():
        a = dict(row._mapping)
        bi_id = a.pop("backlog_item_id")
        if bi_id in backlog_items:
            backlog_items[bi_id]["activities"].append(a)

    for bi in backlog_items.values():
        d_id = bi.pop("deliverable_id")
        if d_id in deliverables:
            deliverables[d_id]["backlog_items"].append(bi)

    return list(deliverables.values())


@router.get("/{project_id}/backlog")
async def project_backlog(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT bi.*, d.title AS deliverable_title
            FROM backlog_items bi
            JOIN deliverables d ON bi.deliverable_id = d.id
            WHERE d.project_id = :id AND bi.is_active = true
            ORDER BY bi.code
        """),
        {"id": project_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/{project_id}/activities")
async def project_activities(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT a.*, bi.title AS backlog_item_title, p.description AS profile_name,
                   tm.full_name AS member_name
            FROM activities a
            JOIN backlog_items bi ON a.backlog_item_id = bi.id
            JOIN deliverables d ON bi.deliverable_id = d.id
            LEFT JOIN profiles p ON a.profile_id = p.id
            LEFT JOIN team_members tm ON p.team_member_id = tm.id
            WHERE d.project_id = :id AND a.is_active = true
            ORDER BY a.status, a.title
        """),
        {"id": project_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/{project_id}/flowup-hours")
async def project_flowup_hours(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT tm.full_name AS member_name, SUM(fr.worked_hours) AS hours
            FROM flowup_reports fr
            JOIN fu_cost_centers fcc ON fr.fu_project_id = fcc.fu_project_id
            JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
            JOIN team_members tm ON um.team_member_id = tm.id
            WHERE fcc.project_id = :project_id AND fr.worked_hours IS NOT NULL
            GROUP BY tm.id, tm.full_name
            ORDER BY hours DESC
        """),
        {"project_id": project_id},
    )
    rows = result.fetchall()
    by_member = [{"member_name": r.member_name, "hours": float(r.hours or 0)} for r in rows]
    total_hours = sum(m["hours"] for m in by_member)
    return {"total_hours": total_hours, "by_member": by_member}


@router.get("/{project_id}/flowup-cost")
async def project_flowup_cost(project_id: int, db: AsyncSession = Depends(get_db)):
    """Compute FlowUp spend per project using user_mappings and Resource.hourly_rate."""
    # Determine hours filter from project_flowup_mappings (or fall back to fu_cost_centers)
    mapping_result = await db.execute(
        text("SELECT mapping_type, fu_cost_center_id, fu_board_id FROM project_flowup_mappings WHERE project_id = :pid"),
        {"pid": project_id},
    )
    mapping = mapping_result.first()

    if mapping and mapping.mapping_type == "board" and mapping.fu_board_id:
        hours_filter = "fr.fu_task_id IN (SELECT fu_task_id FROM fu_board_tasks WHERE fu_board_id = :fu_board_id)"
        filter_params: dict = {"fu_board_id": mapping.fu_board_id}
        mapping_type = "board"
    elif mapping and mapping.mapping_type == "cost_center" and mapping.fu_cost_center_id:
        hours_filter = "fr.fu_project_id = :fu_cost_center_id"
        filter_params = {"fu_cost_center_id": mapping.fu_cost_center_id}
        mapping_type = "cost_center"
    else:
        # Backward-compat fallback: use fu_cost_centers.project_id
        hours_filter = "fr.fu_project_id IN (SELECT fu_project_id FROM fu_cost_centers WHERE project_id = :project_id)"
        filter_params = {"project_id": project_id}
        mapping_type = "cost_center"

    sql = f"""
        SELECT
            tm.full_name AS member_name,
            pos.description AS position_name,
            SUM(fr.worked_hours) AS worked_hours,
            r.hourly_rate,
            SUM(fr.worked_hours) * r.hourly_rate AS member_cost
        FROM flowup_reports fr
        JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
        JOIN team_members tm ON um.team_member_id = tm.id
        LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
        LEFT JOIN positions pos ON pr.position_id = pos.id
        LEFT JOIN resources r ON r.project_id = :project_id AND r.position_id = pr.position_id AND r.is_active = true
        WHERE {hours_filter} AND fr.worked_hours IS NOT NULL
        GROUP BY tm.id, tm.full_name, pos.description, r.hourly_rate
        ORDER BY member_cost DESC NULLS LAST
    """
    result = await db.execute(text(sql), {"project_id": project_id, **filter_params})
    rows = result.fetchall()

    by_member = []
    members_without_rate = []
    total_hours = 0.0
    total_cost = 0.0

    for row in rows:
        worked = float(row.worked_hours or 0)
        rate = float(row.hourly_rate) if row.hourly_rate is not None else None
        cost = float(row.member_cost) if row.member_cost is not None else None
        total_hours += worked
        if cost is not None:
            total_cost += cost
        else:
            members_without_rate.append(row.member_name)
        by_member.append({
            "member_name": row.member_name,
            "position_name": row.position_name,
            "worked_hours": worked,
            "hourly_rate": rate,
            "member_cost": cost,
        })

    return {
        "mapping_type": mapping_type,
        "total_hours": total_hours,
        "total_cost": total_cost,
        "by_member": by_member,
        "members_without_rate": members_without_rate,
    }


@router.get("/{project_id}/flowup-cost-by-month")
async def project_flowup_cost_by_month(project_id: int, db: AsyncSession = Depends(get_db)):
    """FlowUp hours and cost grouped by month, using the same mapping logic as flowup-cost."""
    mapping_result = await db.execute(
        text("SELECT mapping_type, fu_cost_center_id, fu_board_id FROM project_flowup_mappings WHERE project_id = :pid"),
        {"pid": project_id},
    )
    mapping = mapping_result.first()

    if mapping and mapping.mapping_type == "board" and mapping.fu_board_id:
        hours_filter = "fr.fu_task_id IN (SELECT fu_task_id FROM fu_board_tasks WHERE fu_board_id = :fu_board_id)"
        filter_params: dict = {"fu_board_id": mapping.fu_board_id}
    elif mapping and mapping.mapping_type == "cost_center" and mapping.fu_cost_center_id:
        hours_filter = "fr.fu_project_id = :fu_cost_center_id"
        filter_params = {"fu_cost_center_id": mapping.fu_cost_center_id}
    else:
        hours_filter = "fr.fu_project_id IN (SELECT fu_project_id FROM fu_cost_centers WHERE project_id = :project_id)"
        filter_params = {"project_id": project_id}

    sql = f"""
        SELECT
            TO_CHAR(DATE_TRUNC('month', fr.start_datetime), 'YYYY-MM') AS month,
            SUM(fr.worked_hours) AS total_hours,
            SUM(fr.worked_hours * COALESCE(r.hourly_rate, 0)) AS total_cost
        FROM flowup_reports fr
        JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
        JOIN team_members tm ON um.team_member_id = tm.id
        LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
        LEFT JOIN resources r ON r.project_id = :project_id AND r.position_id = pr.position_id AND r.is_active = true
        WHERE {hours_filter} AND fr.worked_hours IS NOT NULL AND fr.start_datetime IS NOT NULL
        GROUP BY DATE_TRUNC('month', fr.start_datetime)
        ORDER BY DATE_TRUNC('month', fr.start_datetime)
    """
    result = await db.execute(text(sql), {"project_id": project_id, **filter_params})
    rows = result.fetchall()
    return [
        {"month": r.month, "total_hours": float(r.total_hours or 0), "total_cost": float(r.total_cost or 0)}
        for r in rows
    ]


@router.get("/{project_id}/resources")
async def project_resources(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT r.*, pos.description AS position_name, pos.domain, pos.level
            FROM resources r
            LEFT JOIN positions pos ON r.position_id = pos.id
            WHERE r.project_id = :id AND r.is_active = true
        """),
        {"id": project_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]

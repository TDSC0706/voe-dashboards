from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/pedidos", tags=["pedidos"])

# ── Pydantic schemas ─────────────────────────────────────────────────

class OrderCreate(BaseModel):
    name: str
    description: str | None = None
    status: str = "ACTIVE"
    notes: str | None = None
    project_ids: list[int] = []


class OrderUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    notes: str | None = None
    project_ids: list[int] | None = None


# ── Cost helper SQL (reused across endpoints) ────────────────────────
# Returns total FlowUp cost per project (same logic as projects router)
COST_PER_PROJECT_SQL = """
    SELECT op.project_id, SUM(flowup_cost) AS total_cost
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
        AND fcc.project_id NOT IN (SELECT project_id FROM project_flowup_mappings)
        GROUP BY fcc.project_id
    ) costs
    JOIN order_projects op ON op.project_id = costs.project_id
    GROUP BY op.project_id
"""

# ── Endpoints ────────────────────────────────────────────────────────

@router.get("")
async def list_orders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT o.*,
               COUNT(op.project_id) AS project_count,
               COALESCE(SUM(p.selling_price), 0) AS total_value
        FROM orders o
        LEFT JOIN order_projects op ON op.order_id = o.id
        LEFT JOIN projects p ON p.id = op.project_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    """))
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/{order_id}")
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT o.*,
               COUNT(op.project_id) AS project_count,
               COALESCE(SUM(p.selling_price), 0) AS total_value
        FROM orders o
        LEFT JOIN order_projects op ON op.order_id = o.id
        LEFT JOIN projects p ON p.id = op.project_id
        WHERE o.id = :id
        GROUP BY o.id
    """), {"id": order_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return dict(row._mapping)


@router.get("/{order_id}/projects")
async def get_order_projects(order_id: int, db: AsyncSession = Depends(get_db)):
    """Returns projects in this order with their consumption (FlowUp cost)."""
    # Check order exists
    chk = await db.execute(text("SELECT id FROM orders WHERE id = :id"), {"id": order_id})
    if not chk.fetchone():
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    result = await db.execute(text("""
        SELECT p.id, p.title, p.status, p.selling_price, p.start_date, p.planned_end_date,
               c.name AS customer_name,
               COALESCE(costs.total_cost, 0) AS consumed
        FROM order_projects op
        JOIN projects p ON p.id = op.project_id
        LEFT JOIN customers c ON c.id = p.customer_id
        LEFT JOIN (
            SELECT project_id, SUM(flowup_cost) AS total_cost
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
                AND fcc.project_id NOT IN (SELECT project_id FROM project_flowup_mappings)
                GROUP BY fcc.project_id
            ) sub
            GROUP BY project_id
        ) costs ON costs.project_id = p.id
        WHERE op.order_id = :order_id
        ORDER BY p.title
    """), {"order_id": order_id})

    rows = [dict(r._mapping) for r in result.fetchall()]
    return rows


@router.get("/{order_id}/matrix")
async def get_order_matrix(order_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns monthly cost matrix for the order.
    Each row: { project_id, project_title, month_data: [{year, month, this_month, acc_with, acc_without}] }
    Plus an 'order' summary row.
    """
    chk = await db.execute(text("SELECT id, name FROM orders WHERE id = :id"), {"id": order_id})
    order_row = chk.fetchone()
    if not order_row:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    # Get all monthly costs per project for this order
    result = await db.execute(text("""
        WITH monthly_costs AS (
            SELECT
                op.project_id,
                DATE_TRUNC('month', all_costs.start_datetime) AS month,
                SUM(all_costs.worked_hours * COALESCE(all_costs.hourly_rate, 0)) AS cost
            FROM order_projects op
            JOIN (
                SELECT pm.project_id, fr.worked_hours, fr.start_datetime,
                       r.hourly_rate
                FROM flowup_reports fr
                JOIN project_flowup_mappings pm
                    ON pm.mapping_type = 'cost_center' AND pm.fu_cost_center_id IS NOT NULL
                    AND fr.fu_project_id = pm.fu_cost_center_id
                JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
                JOIN team_members tm ON um.team_member_id = tm.id
                LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
                LEFT JOIN resources r ON r.project_id = pm.project_id AND r.position_id = pr.position_id AND r.is_active = true
                WHERE fr.worked_hours IS NOT NULL

                UNION ALL

                SELECT pm.project_id, fr.worked_hours, fr.start_datetime,
                       r.hourly_rate
                FROM flowup_reports fr
                JOIN fu_board_tasks fbt ON fr.fu_task_id = fbt.fu_task_id
                JOIN project_flowup_mappings pm
                    ON pm.mapping_type = 'board' AND pm.fu_board_id = fbt.fu_board_id
                JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
                JOIN team_members tm ON um.team_member_id = tm.id
                LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
                LEFT JOIN resources r ON r.project_id = pm.project_id AND r.position_id = pr.position_id AND r.is_active = true
                WHERE fr.worked_hours IS NOT NULL

                UNION ALL

                SELECT fcc.project_id, fr.worked_hours, fr.start_datetime,
                       r.hourly_rate
                FROM flowup_reports fr
                JOIN fu_cost_centers fcc ON fr.fu_project_id = fcc.fu_project_id
                JOIN user_mappings um ON fr.fu_member_id = um.fu_member_id
                JOIN team_members tm ON um.team_member_id = tm.id
                LEFT JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
                LEFT JOIN resources r ON r.project_id = fcc.project_id AND r.position_id = pr.position_id AND r.is_active = true
                WHERE fr.worked_hours IS NOT NULL
                AND fcc.project_id NOT IN (SELECT project_id FROM project_flowup_mappings)
            ) all_costs ON all_costs.project_id = op.project_id
            WHERE op.order_id = :order_id
            GROUP BY op.project_id, DATE_TRUNC('month', all_costs.start_datetime)
        )
        SELECT
            mc.project_id,
            p.title AS project_title,
            EXTRACT(YEAR FROM mc.month)::int AS year,
            EXTRACT(MONTH FROM mc.month)::int AS month,
            mc.cost AS this_month,
            SUM(mc.cost) OVER (PARTITION BY mc.project_id ORDER BY mc.month
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS acc_with,
            SUM(mc.cost) OVER (PARTITION BY mc.project_id ORDER BY mc.month
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS acc_without
        FROM monthly_costs mc
        JOIN projects p ON p.id = mc.project_id
        ORDER BY p.title, mc.month
    """), {"order_id": order_id})

    raw = [dict(r._mapping) for r in result.fetchall()]

    # Collect all months
    months = sorted(set((r["year"], r["month"]) for r in raw))

    # Build per-project map
    project_map: dict[int, dict] = {}
    for r in raw:
        pid = r["project_id"]
        if pid not in project_map:
            project_map[pid] = {"project_id": pid, "project_title": r["project_title"], "months": {}}
        project_map[pid]["months"][(r["year"], r["month"])] = {
            "this_month": float(r["this_month"] or 0),
            "acc_with": float(r["acc_with"] or 0),
            "acc_without": float(r["acc_without"] or 0),
        }

    # Build response rows
    project_rows = []
    order_month_totals: dict[tuple, dict] = {}

    for pid, pdata in project_map.items():
        month_data = []
        for (y, m) in months:
            cell = pdata["months"].get((y, m), {"this_month": 0, "acc_with": None, "acc_without": None})
            month_data.append({"year": y, "month": m, **cell})
            key = (y, m)
            if key not in order_month_totals:
                order_month_totals[key] = {"this_month": 0}
            order_month_totals[key]["this_month"] += cell["this_month"]
        project_rows.append({
            "project_id": pid,
            "project_title": pdata["project_title"],
            "month_data": month_data,
        })

    # Build order summary row with running accumulation
    order_month_data = []
    running = 0.0
    prev_running = 0.0
    for (y, m) in months:
        this = order_month_totals.get((y, m), {}).get("this_month", 0)
        acc_without = prev_running
        running += this
        order_month_data.append({
            "year": y, "month": m,
            "this_month": this,
            "acc_with": running,
            "acc_without": acc_without,
        })
        prev_running = running

    return {
        "order_id": order_row.id,
        "order_name": order_row.name,
        "months": [{"year": y, "month": m} for (y, m) in months],
        "order_row": {"project_id": None, "project_title": order_row.name, "month_data": order_month_data},
        "project_rows": project_rows,
    }


@router.post("")
async def create_order(body: OrderCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        INSERT INTO orders (name, description, status, notes)
        VALUES (:name, :description, :status, :notes)
        RETURNING id
    """), {"name": body.name, "description": body.description, "status": body.status, "notes": body.notes})
    order_id = result.scalar()

    if body.project_ids:
        for pid in body.project_ids:
            await db.execute(text(
                "INSERT INTO order_projects (order_id, project_id) VALUES (:oid, :pid) ON CONFLICT DO NOTHING"
            ), {"oid": order_id, "pid": pid})

    await db.commit()
    return {"id": order_id}


@router.put("/{order_id}")
async def update_order(order_id: int, body: OrderUpdate, db: AsyncSession = Depends(get_db)):
    chk = await db.execute(text("SELECT id FROM orders WHERE id = :id"), {"id": order_id})
    if not chk.fetchone():
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.description is not None:
        updates["description"] = body.description
    if body.status is not None:
        updates["status"] = body.status
    if body.notes is not None:
        updates["notes"] = body.notes

    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = order_id
        await db.execute(text(f"UPDATE orders SET {set_clause}, updated_at = NOW() WHERE id = :id"), updates)

    if body.project_ids is not None:
        await db.execute(text("DELETE FROM order_projects WHERE order_id = :oid"), {"oid": order_id})
        for pid in body.project_ids:
            await db.execute(text(
                "INSERT INTO order_projects (order_id, project_id) VALUES (:oid, :pid)"
            ), {"oid": order_id, "pid": pid})

    await db.commit()
    return {"ok": True}


@router.delete("/{order_id}")
async def delete_order(order_id: int, db: AsyncSession = Depends(get_db)):
    chk = await db.execute(text("SELECT id FROM orders WHERE id = :id"), {"id": order_id})
    if not chk.fetchone():
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    await db.execute(text("DELETE FROM orders WHERE id = :id"), {"id": order_id})
    await db.commit()
    return {"ok": True}

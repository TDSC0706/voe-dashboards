from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter(prefix="/client", tags=["client"])


@router.get("/overview")
async def client_overview(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a summary of ongoing iterations for the client view.
    If the user has a customer_id, only that customer's projects are shown.
    """
    customer_filter = ""
    params: dict = {}

    if current_user.customer_id:
        customer_filter = "AND p.customer_id = :customer_id"
        params["customer_id"] = current_user.customer_id

    # Get customer name if applicable
    customer_name = None
    if current_user.customer_id:
        cr = await db.execute(
            text("SELECT name FROM customers WHERE id = :id"),
            {"id": current_user.customer_id},
        )
        row = cr.first()
        if row:
            customer_name = row[0]

    result = await db.execute(
        text(f"""
            SELECT
                mv.iteration_id,
                mv.code,
                mv.status,
                mv.health_status,
                mv.product_title,
                mv.start_date,
                mv.end_date,
                mv.completion_pct,
                mv.hours_spent,
                mv.days_remaining,
                mv.total_activities,
                mv.completed_activities,
                p.id AS project_id,
                p.title AS project_title,
                c.name AS customer_name,
                -- Activity status breakdown via activity_states
                COUNT(DISTINCT ast.activity_id) FILTER (
                    WHERE ast.status IN ('TO_DO', 'PLANNED')
                ) AS todo_count,
                COUNT(DISTINCT ast.activity_id) FILTER (
                    WHERE ast.status IN ('ONGOING', 'IN_PROGRESS')
                ) AS in_progress_count,
                COUNT(DISTINCT ast.activity_id) FILTER (
                    WHERE ast.status = 'COMPLETED'
                ) AS done_count
            FROM mv_iteration_progress mv
            JOIN iterations i ON i.id = mv.iteration_id
            JOIN products pr ON pr.id = i.product_id
            JOIN projects p ON p.product_id = pr.id AND p.status = 'ONGOING'
            LEFT JOIN customers c ON c.id = p.customer_id
            LEFT JOIN activity_states ast ON ast.iteration_id = mv.iteration_id
            WHERE mv.status = 'ONGOING'
            {customer_filter}
            GROUP BY
                mv.iteration_id, mv.code, mv.status, mv.health_status,
                mv.product_title, mv.start_date, mv.end_date,
                mv.completion_pct, mv.hours_spent, mv.days_remaining,
                mv.total_activities, mv.completed_activities,
                p.id, p.title, c.name
            ORDER BY mv.start_date DESC
        """),
        params,
    )
    iterations = [dict(r._mapping) for r in result.fetchall()]

    # Compute summary
    total = len(iterations)
    on_track = sum(1 for i in iterations if i["health_status"] == "ON_TRACK")
    at_risk = sum(1 for i in iterations if i["health_status"] in ("AT_RISK", "OVERDUE"))
    avg_completion = (
        sum(float(i["completion_pct"] or 0) for i in iterations) / total
        if total > 0
        else 0.0
    )

    return {
        "customer_name": customer_name,
        "summary": {
            "active_iterations": total,
            "on_track": on_track,
            "at_risk": at_risk,
            "avg_completion_pct": round(avg_completion, 1),
        },
        "iterations": iterations,
    }


@router.get("/customers")
async def list_customers(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all customers (for admin use when creating client users)."""
    result = await db.execute(
        text("SELECT id, name FROM customers ORDER BY name")
    )
    return [{"id": r[0], "name": r[1]} for r in result.fetchall()]

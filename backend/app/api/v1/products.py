from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/products", tags=["products"])


@router.get("")
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT p.*,
                (SELECT COUNT(*) FROM backlog_items bi
                 JOIN deliverables d ON bi.deliverable_id = d.id
                 JOIN projects pr ON d.project_id = pr.id
                 WHERE pr.product_id = p.id AND bi.item_type = 'BUG_FIX'
                ) AS bug_count,
                COALESCE((
                    SELECT SUM(ee.total_hours)
                    FROM energy_entries ee
                    JOIN activities a ON ee.activity_id = a.id
                    JOIN backlog_items bi ON a.backlog_item_id = bi.id
                    JOIN deliverables d ON bi.deliverable_id = d.id
                    JOIN projects pr ON d.project_id = pr.id
                    WHERE pr.product_id = p.id
                ), 0) AS total_hours_spent,
                (SELECT COUNT(*) FROM projects pr WHERE pr.product_id = p.id) AS project_count
            FROM products p
            WHERE p.is_active = true
            ORDER BY p.title
        """)
    )
    rows = [dict(r._mapping) for r in result.fetchall()]
    # Calculate problem score
    for r in rows:
        r["problem_score"] = (r["bug_count"] or 0) * 3 + (1 if (r["total_hours_spent"] or 0) > 500 else 0) * 2
    return sorted(rows, key=lambda x: x["problem_score"], reverse=True)

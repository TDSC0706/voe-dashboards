from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/deliverables", tags=["deliverables"])


@router.get("/tree")
async def deliverable_tree(db: AsyncSession = Depends(get_db)):
    # 1. Products
    products_result = await db.execute(text("""
        SELECT id, title, code, state, status FROM products WHERE is_active = true ORDER BY title
    """))
    products: dict = {row.id: {**dict(row._mapping), "projects": []} for row in products_result.fetchall()}

    # 2. Projects with customer_name and deliverable counts
    projects_result = await db.execute(text("""
        SELECT p.id, p.title, p.status, p.is_delayed, p.start_date, p.planned_end_date, p.product_id,
               c.name AS customer_name,
               COUNT(DISTINCT d.id) AS total_deliverables,
               COUNT(DISTINCT CASE WHEN d.status IN ('COMPLETED', 'CANCELED') THEN d.id END) AS completed_deliverables
        FROM projects p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN deliverables d ON d.project_id = p.id AND d.is_active = true AND d.is_sandbox = false
        WHERE p.is_active = true
        GROUP BY p.id, p.title, p.status, p.is_delayed, p.start_date, p.planned_end_date, p.product_id, c.name
        ORDER BY p.title
    """))
    projects: dict = {row.id: {**dict(row._mapping), "deliverables": []} for row in projects_result.fetchall()}

    # 3. Deliverables with backlog item counts
    deliverables_result = await db.execute(text("""
        SELECT d.id, d.title, d.description, d.status, d.deadline, d.project_id,
               CASE WHEN d.deadline < NOW() AND d.status NOT IN ('COMPLETED', 'CANCELED') THEN true ELSE false END AS is_delayed_flag,
               COUNT(bi.id) AS total_items,
               COUNT(CASE WHEN bi.status IN ('COMPLETED', 'IN_PRODUCTION', 'ACCEPTED') THEN 1 END) AS completed_items
        FROM deliverables d
        LEFT JOIN backlog_items bi ON bi.deliverable_id = d.id AND bi.is_active = true
        WHERE d.is_active = true AND d.is_sandbox = false
        GROUP BY d.id, d.title, d.description, d.status, d.deadline, d.project_id
        ORDER BY d.deadline NULLS LAST
    """))
    deliverables: dict = {row.id: {**dict(row._mapping), "backlog_items": []} for row in deliverables_result.fetchall()}

    # 4. BacklogItems with activity counts
    backlog_result = await db.execute(text("""
        SELECT bi.id, bi.code, bi.title, bi.description, bi.status, bi.planned_end_date, bi.deliverable_id,
               COUNT(a.id) AS total_activities,
               COUNT(CASE WHEN a.status IN ('COMPLETED', 'CLOSED') THEN 1 END) AS completed_activities
        FROM backlog_items bi
        LEFT JOIN activities a ON a.backlog_item_id = bi.id AND a.is_active = true
        WHERE bi.is_active = true
        GROUP BY bi.id, bi.code, bi.title, bi.description, bi.status, bi.planned_end_date, bi.deliverable_id
        ORDER BY bi.code
    """))
    backlog_items: dict = {row.id: {**dict(row._mapping), "activities": []} for row in backlog_result.fetchall()}

    # 5. Activities with member_name
    activities_result = await db.execute(text("""
        SELECT a.id, a.title, a.status, a.estimation_hours, a.work_hours, a.backlog_item_id,
               tm.full_name AS member_name
        FROM activities a
        LEFT JOIN profiles pr ON a.profile_id = pr.id
        LEFT JOIN team_members tm ON pr.team_member_id = tm.id
        WHERE a.is_active = true
        ORDER BY a.title
    """))

    # Build tree bottom-up
    for row in activities_result.fetchall():
        a = dict(row._mapping)
        bi_id = a.pop("backlog_item_id", None)
        if bi_id and bi_id in backlog_items:
            backlog_items[bi_id]["activities"].append(a)

    for bi in list(backlog_items.values()):
        d_id = bi.pop("deliverable_id", None)
        if d_id and d_id in deliverables:
            deliverables[d_id]["backlog_items"].append(bi)

    for d in list(deliverables.values()):
        p_id = d.pop("project_id", None)
        if p_id and p_id in projects:
            projects[p_id]["deliverables"].append(d)

    for p in list(projects.values()):
        prod_id = p.pop("product_id", None)
        if prod_id and prod_id in products:
            products[prod_id]["projects"].append(p)

    return {"products": list(products.values())}


@router.get("")
async def list_deliverables(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT d.*, p.title AS project_title, p.status AS project_status,
                (SELECT COUNT(*) FROM backlog_items bi WHERE bi.deliverable_id = d.id) AS total_items,
                (SELECT COUNT(*) FROM backlog_items bi
                 WHERE bi.deliverable_id = d.id
                 AND bi.status IN ('COMPLETED', 'IN_PRODUCTION', 'ACCEPTED')
                ) AS completed_items,
                CASE
                    WHEN d.status IN ('COMPLETED', 'CANCELED') THEN 'DONE'
                    WHEN d.deadline < NOW() THEN 'OVERDUE'
                    WHEN d.deadline < NOW() + INTERVAL '7 days' THEN 'AT_RISK'
                    ELSE 'ON_TRACK'
                END AS health_status
            FROM deliverables d
            JOIN projects p ON d.project_id = p.id
            WHERE d.is_active = true AND d.is_sandbox = false
            ORDER BY d.deadline NULLS LAST
        """)
    )
    return [dict(row._mapping) for row in result.fetchall()]

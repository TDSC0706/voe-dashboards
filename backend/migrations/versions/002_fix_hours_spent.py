"""Fix mv_iteration_progress to use energy_entries for hours_spent.

Revision ID: 002
Revises: 001
Create Date: 2026-03-07

"""
from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_iteration_progress")
    op.execute("""
        CREATE MATERIALIZED VIEW mv_iteration_progress AS
        SELECT
            i.id AS iteration_id,
            i.voe_id,
            i.code,
            i.status,
            i.state,
            i.start_date,
            i.end_date,
            i.goal,
            pr.title AS product_title,
            pr.code AS product_code,
            COALESCE((
                SELECT COUNT(*) FILTER (WHERE ast.status = 'COMPLETED')::float /
                       NULLIF(COUNT(*), 0) * 100
                FROM activity_states ast WHERE ast.iteration_id = i.id
            ), 0) AS completion_pct,
            COALESCE((
                SELECT SUM(ee.total_hours)
                FROM energy_entries ee
                WHERE ee.activity_id IN (
                    SELECT activity_id FROM activity_states WHERE iteration_id = i.id
                )
            ), 0) AS hours_spent,
            GREATEST(0, EXTRACT(DAY FROM i.end_date - NOW())) AS days_remaining,
            (SELECT COUNT(*) FROM activity_states ast WHERE ast.iteration_id = i.id) AS total_activities,
            (SELECT COUNT(*) FROM activity_states ast
             WHERE ast.iteration_id = i.id AND ast.status = 'COMPLETED') AS completed_activities
        FROM iterations i
        LEFT JOIN products pr ON i.product_id = pr.id
        WHERE i.is_active = true
    """)
    op.execute("CREATE UNIQUE INDEX ON mv_iteration_progress (iteration_id)")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_iteration_progress")
    op.execute("""
        CREATE MATERIALIZED VIEW mv_iteration_progress AS
        SELECT
            i.id AS iteration_id,
            i.voe_id,
            i.code,
            i.status,
            i.state,
            i.start_date,
            i.end_date,
            i.goal,
            pr.title AS product_title,
            pr.code AS product_code,
            COALESCE((
                SELECT COUNT(*) FILTER (WHERE ast.status = 'COMPLETED')::float /
                       NULLIF(COUNT(*), 0) * 100
                FROM activity_states ast WHERE ast.iteration_id = i.id
            ), 0) AS completion_pct,
            COALESCE((
                SELECT SUM(ast.total_hours) FROM activity_states ast WHERE ast.iteration_id = i.id
            ), 0) AS hours_spent,
            GREATEST(0, EXTRACT(DAY FROM i.end_date - NOW())) AS days_remaining,
            (SELECT COUNT(*) FROM activity_states ast WHERE ast.iteration_id = i.id) AS total_activities,
            (SELECT COUNT(*) FROM activity_states ast
             WHERE ast.iteration_id = i.id AND ast.status = 'COMPLETED') AS completed_activities
        FROM iterations i
        LEFT JOIN products pr ON i.product_id = pr.id
        WHERE i.is_active = true
    """)
    op.execute("CREATE UNIQUE INDEX ON mv_iteration_progress (iteration_id)")

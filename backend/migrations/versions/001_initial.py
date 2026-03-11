"""Initial schema with all tables and materialized views.

Revision ID: 001
Revises: None
Create Date: 2026-03-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Customers ──
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("satisfaction", sa.String(50)),
        sa.Column("sector", sa.String(200)),
        sa.Column("region", sa.String(200)),
        sa.Column("notes", sa.Text()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Departments ──
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("description", sa.String(200)),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Products ──
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("state", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50)),
        sa.Column("description", sa.String(200)),
        sa.Column("domain", sa.String(200)),
        sa.Column("launch_date", sa.DateTime()),
        sa.Column("version", sa.String(200)),
        sa.Column("notes", sa.Text()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── TeamMembers ──
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("full_name", sa.String(200)),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(200)),
        sa.Column("whatsapp", sa.String(20)),
        sa.Column("is_local_user", sa.Boolean(), default=False),
        sa.Column("active", sa.Boolean(), default=True),
        sa.Column("last_login", sa.DateTime()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Projects ──
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("project_type", sa.String(50), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("cost_center", sa.String(320)),
        sa.Column("is_delayed", sa.Boolean(), default=False),
        sa.Column("start_date", sa.DateTime()),
        sa.Column("planned_end_date", sa.DateTime()),
        sa.Column("actual_end_date", sa.DateTime()),
        sa.Column("notes", sa.Text()),
        sa.Column("profit_margin", sa.Numeric(20, 8)),
        sa.Column("selling_price", sa.Numeric(20, 8)),
        sa.Column("extra_proj_cost", sa.Numeric(20, 8)),
        sa.Column("customer_voe_id", sa.BigInteger()),
        sa.Column("product_voe_id", sa.BigInteger()),
        sa.Column("accountable_voe_id", sa.BigInteger()),
        sa.Column("department_voe_id", sa.BigInteger()),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id")),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id")),
        sa.Column("accountable_id", sa.Integer(), sa.ForeignKey("team_members.id")),
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_projects_status", "projects", ["status"])

    # ── Positions ──
    op.create_table(
        "positions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("description", sa.String(200)),
        sa.Column("domain", sa.String(50)),
        sa.Column("level", sa.String(50)),
        sa.Column("notes", sa.Text()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Profiles ──
    op.create_table(
        "profiles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("description", sa.String(200)),
        sa.Column("net_cost", sa.Numeric(20, 8)),
        sa.Column("working_hours", sa.Integer()),
        sa.Column("effective_date", sa.DateTime()),
        sa.Column("team_member_voe_id", sa.BigInteger()),
        sa.Column("position_voe_id", sa.BigInteger()),
        sa.Column("team_member_id", sa.Integer(), sa.ForeignKey("team_members.id")),
        sa.Column("position_id", sa.Integer(), sa.ForeignKey("positions.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Resources ──
    op.create_table(
        "resources",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("hourly_rate", sa.Numeric(20, 8)),
        sa.Column("cost", sa.Numeric(20, 8)),
        sa.Column("commission", sa.Numeric(20, 8)),
        sa.Column("profit", sa.Numeric(20, 8)),
        sa.Column("profit_margin", sa.Numeric(20, 8)),
        sa.Column("project_voe_id", sa.BigInteger()),
        sa.Column("position_voe_id", sa.BigInteger()),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id")),
        sa.Column("position_id", sa.Integer(), sa.ForeignKey("positions.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Deliverables ──
    op.create_table(
        "deliverables",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("delivery_type", sa.String(50), nullable=False),
        sa.Column("description", sa.String(200)),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("deadline", sa.DateTime()),
        sa.Column("release", sa.DateTime()),
        sa.Column("state", sa.String(50)),
        sa.Column("is_sandbox", sa.Boolean(), default=False),
        sa.Column("notes", sa.Text()),
        sa.Column("project_voe_id", sa.BigInteger()),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── BacklogItems ──
    op.create_table(
        "backlog_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("code", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("item_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("planned_start_date", sa.DateTime()),
        sa.Column("planned_end_date", sa.DateTime()),
        sa.Column("actual_start_date", sa.DateTime()),
        sa.Column("actual_end_date", sa.DateTime()),
        sa.Column("work_hours", sa.Numeric(20, 8)),
        sa.Column("user_impact", sa.String(50)),
        sa.Column("business_impact", sa.String(50)),
        sa.Column("expended_energy", sa.String(50)),
        sa.Column("roe", sa.Numeric(20, 8)),
        sa.Column("notes", sa.Text()),
        sa.Column("deliverable_voe_id", sa.BigInteger()),
        sa.Column("responsible_voe_id", sa.BigInteger()),
        sa.Column("deliverable_id", sa.Integer(), sa.ForeignKey("deliverables.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Iterations ──
    op.create_table(
        "iterations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("code", sa.String(23), nullable=False),
        sa.Column("start_date", sa.DateTime()),
        sa.Column("end_date", sa.DateTime()),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("state", sa.String(50), nullable=False),
        sa.Column("goal", sa.String(200)),
        sa.Column("is_last", sa.Boolean(), default=True),
        sa.Column("product_voe_id", sa.BigInteger()),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Activities ──
    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("domain", sa.String(50)),
        sa.Column("instructions", sa.Text()),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("estimation_hours", sa.Numeric(20, 8)),
        sa.Column("work_hours", sa.Numeric(20, 8)),
        sa.Column("notes", sa.Text()),
        sa.Column("backlog_item_voe_id", sa.BigInteger()),
        sa.Column("profile_voe_id", sa.BigInteger()),
        sa.Column("backlog_item_id", sa.Integer(), sa.ForeignKey("backlog_items.id")),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── ActivityStates ──
    op.create_table(
        "activity_states",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("status", sa.String(50)),
        sa.Column("start_date_time", sa.DateTime()),
        sa.Column("end_date_time", sa.DateTime()),
        sa.Column("total_hours", sa.Numeric(20, 8)),
        sa.Column("notes", sa.Text()),
        sa.Column("iteration_voe_id", sa.BigInteger()),
        sa.Column("activity_voe_id", sa.BigInteger()),
        sa.Column("profile_voe_id", sa.BigInteger()),
        sa.Column("iteration_id", sa.Integer(), sa.ForeignKey("iterations.id")),
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id")),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── EnergyEntries ──
    op.create_table(
        "energy_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("start_date_time", sa.DateTime()),
        sa.Column("end_date_time", sa.DateTime()),
        sa.Column("total_hours", sa.Numeric(20, 8)),
        sa.Column("total_cost", sa.Numeric(20, 8)),
        sa.Column("notes", sa.Text()),
        sa.Column("activity_voe_id", sa.BigInteger()),
        sa.Column("profile_voe_id", sa.BigInteger()),
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id")),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id")),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_date", sa.DateTime()),
        sa.Column("changed_date", sa.DateTime()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Flowup Tables ──
    op.create_table(
        "fu_cost_centers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("fu_project_id", sa.BigInteger()),
        sa.Column("fu_project_name", sa.String(200)),
        sa.Column("fu_board_id", sa.BigInteger()),
        sa.Column("fu_board_name", sa.String(200)),
        sa.Column("project_voe_id", sa.BigInteger()),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id")),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "fu_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voe_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("fu_user_id", sa.BigInteger()),
        sa.Column("fu_user_name", sa.String(200)),
        sa.Column("team_member_voe_id", sa.BigInteger()),
        sa.Column("team_member_id", sa.Integer(), sa.ForeignKey("team_members.id")),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "flowup_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fu_id", sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column("fu_project_id", sa.BigInteger()),
        sa.Column("fu_task_id", sa.BigInteger()),
        sa.Column("fu_member_id", sa.BigInteger()),
        sa.Column("fu_member_name", sa.String(200)),
        sa.Column("start_datetime", sa.DateTime()),
        sa.Column("end_datetime", sa.DateTime()),
        sa.Column("worked_hours", sa.Numeric(20, 8)),
        sa.Column("description", sa.Text()),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Application Tables ──
    op.create_table(
        "user_mappings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("team_member_id", sa.Integer(), sa.ForeignKey("team_members.id"), unique=True),
        sa.Column("fu_member_id", sa.BigInteger(), nullable=False),
        sa.Column("fu_member_name", sa.String(200)),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "dashboards",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("layout", sa.Text(), server_default="[]"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "sync_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("entity", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("records_synced", sa.Integer(), server_default="0"),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime()),
    )

    # ── Materialized Views ──
    op.execute("""
        CREATE MATERIALIZED VIEW mv_project_health AS
        SELECT
            p.id AS project_id,
            p.voe_id,
            p.title,
            p.status,
            p.is_delayed,
            p.start_date,
            p.planned_end_date,
            p.actual_end_date,
            p.selling_price,
            p.profit_margin,
            p.extra_proj_cost,
            c.name AS customer_name,
            -- Schedule risk components
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
            -- Financial metrics
            COALESCE((
                SELECT SUM(r.cost) FROM resources r WHERE r.project_id = p.id
            ), 0) AS total_cost,
            COALESCE(p.selling_price, 0) - COALESCE((
                SELECT SUM(r.cost) FROM resources r WHERE r.project_id = p.id
            ), 0) - COALESCE(p.extra_proj_cost, 0) AS remaining_budget,
            -- Activity counts
            (SELECT COUNT(*) FROM activities a
             JOIN backlog_items bi ON a.backlog_item_id = bi.id
             JOIN deliverables d ON bi.deliverable_id = d.id
             WHERE d.project_id = p.id AND a.status NOT IN ('COMPLETED', 'CANCELED')
            ) AS open_activities,
            (SELECT COUNT(*) FROM backlog_items bi
             JOIN deliverables d ON bi.deliverable_id = d.id
             WHERE d.project_id = p.id AND bi.item_type = 'BUG_FIX'
            ) AS bug_count,
            (SELECT COUNT(*) FROM deliverables d WHERE d.project_id = p.id) AS deliverable_count
        FROM projects p
        LEFT JOIN customers c ON p.customer_id = c.id
        WHERE p.is_active = true
    """)
    op.execute("CREATE UNIQUE INDEX ON mv_project_health (project_id)")

    op.execute("""
        CREATE MATERIALIZED VIEW mv_team_workload AS
        SELECT
            tm.id AS team_member_id,
            tm.voe_id,
            tm.full_name,
            tm.name,
            pr.working_hours AS weekly_capacity,
            pr.id AS profile_id,
            (SELECT COUNT(*) FROM activities a
             WHERE a.profile_id = pr.id AND a.status IN ('ONGOING', 'TO_DO', 'PLANNED')
            ) AS active_activities,
            COALESCE((
                SELECT SUM(a.estimation_hours - COALESCE(a.work_hours, 0))
                FROM activities a
                WHERE a.profile_id = pr.id AND a.status NOT IN ('COMPLETED', 'CANCELED')
            ), 0) AS pending_hours,
            CASE WHEN pr.working_hours > 0 THEN
                ROUND(COALESCE((
                    SELECT SUM(a.estimation_hours - COALESCE(a.work_hours, 0))
                    FROM activities a
                    WHERE a.profile_id = pr.id AND a.status NOT IN ('COMPLETED', 'CANCELED')
                ), 0) / pr.working_hours * 100, 1)
            ELSE 0 END AS utilization_pct,
            CASE
                WHEN pr.working_hours > 0 AND COALESCE((
                    SELECT SUM(a.estimation_hours - COALESCE(a.work_hours, 0))
                    FROM activities a
                    WHERE a.profile_id = pr.id AND a.status NOT IN ('COMPLETED', 'CANCELED')
                ), 0) / pr.working_hours > 2.0 THEN 'CRITICAL'
                WHEN pr.working_hours > 0 AND COALESCE((
                    SELECT SUM(a.estimation_hours - COALESCE(a.work_hours, 0))
                    FROM activities a
                    WHERE a.profile_id = pr.id AND a.status NOT IN ('COMPLETED', 'CANCELED')
                ), 0) / pr.working_hours > 1.5 THEN 'OVERLOADED'
                ELSE 'OK'
            END AS overload_flag
        FROM team_members tm
        JOIN profiles pr ON pr.team_member_id = tm.id AND pr.is_active = true
        WHERE tm.active = true AND tm.is_active = true
    """)
    op.execute("CREATE UNIQUE INDEX ON mv_team_workload (team_member_id, profile_id)")

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


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_iteration_progress")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_team_workload")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_project_health")
    for table in [
        "sync_log", "dashboards", "user_mappings",
        "flowup_reports", "fu_users", "fu_cost_centers",
        "energy_entries", "activity_states", "activities",
        "iterations", "backlog_items", "deliverables",
        "resources", "profiles", "positions",
        "projects", "team_members", "products",
        "departments", "customers",
    ]:
        op.drop_table(table)

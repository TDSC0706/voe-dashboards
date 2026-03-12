from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey, Index, Numeric, String, Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Application Users ────────────────────────────────────────────────

class AppUser(Base):
    __tablename__ = "app_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TimestampMixin:
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", default=True)
    created_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    changed_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ── VOE OData Tables ────────────────────────────────────────────────

class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    satisfaction: Mapped[str | None] = mapped_column(String(50))
    sector: Mapped[str | None] = mapped_column(String(200))
    region: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)

    projects: Mapped[list["Project"]] = relationship(back_populates="customer")


class Department(TimestampMixin, Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(200))


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(16))
    state: Mapped[str] = mapped_column(String(50))
    status: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(200))
    domain: Mapped[str | None] = mapped_column(String(200))
    launch_date: Mapped[datetime | None] = mapped_column(DateTime)
    version: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)

    iterations: Mapped[list["Iteration"]] = relationship(back_populates="product")
    projects: Mapped[list["Project"]] = relationship(back_populates="product")


class TeamMember(TimestampMixin, Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(200))
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200))
    whatsapp: Mapped[str | None] = mapped_column(String(20))
    is_local_user: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)

    profiles: Mapped[list["Profile"]] = relationship(back_populates="team_member")
    fu_user: Mapped["FUUser | None"] = relationship(back_populates="team_member")


class Project(TimestampMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    project_type: Mapped[str] = mapped_column(String(50))
    category: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50))
    cost_center: Mapped[str | None] = mapped_column(String(320))
    is_delayed: Mapped[bool] = mapped_column(Boolean, default=False)
    start_date: Mapped[datetime | None] = mapped_column(DateTime)
    planned_end_date: Mapped[datetime | None] = mapped_column(DateTime)
    actual_end_date: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text)
    profit_margin: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    selling_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    extra_proj_cost: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))

    customer_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    product_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    accountable_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    department_voe_id: Mapped[int | None] = mapped_column(BigInteger)

    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))
    accountable_id: Mapped[int | None] = mapped_column(ForeignKey("team_members.id"))
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))

    customer: Mapped["Customer | None"] = relationship(back_populates="projects")
    product: Mapped["Product | None"] = relationship(back_populates="projects")
    accountable: Mapped["TeamMember | None"] = relationship()
    deliverables: Mapped[list["Deliverable"]] = relationship(back_populates="project")
    resources: Mapped[list["Resource"]] = relationship(back_populates="project")

    __table_args__ = (Index("ix_projects_status", "status"),)


class Position(TimestampMixin, Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(200))
    domain: Mapped[str | None] = mapped_column(String(50))
    level: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)


class Profile(TimestampMixin, Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(200))
    net_cost: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    working_hours: Mapped[int | None] = mapped_column()
    effective_date: Mapped[datetime | None] = mapped_column(DateTime)

    team_member_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    position_voe_id: Mapped[int | None] = mapped_column(BigInteger)

    team_member_id: Mapped[int | None] = mapped_column(ForeignKey("team_members.id"))
    position_id: Mapped[int | None] = mapped_column(ForeignKey("positions.id"))

    team_member: Mapped["TeamMember | None"] = relationship(back_populates="profiles")
    position: Mapped["Position | None"] = relationship()


class Resource(TimestampMixin, Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    hourly_rate: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    cost: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    commission: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    profit: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    profit_margin: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))

    project_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    position_voe_id: Mapped[int | None] = mapped_column(BigInteger)

    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    position_id: Mapped[int | None] = mapped_column(ForeignKey("positions.id"))

    project: Mapped["Project | None"] = relationship(back_populates="resources")
    position: Mapped["Position | None"] = relationship()


class Deliverable(TimestampMixin, Base):
    __tablename__ = "deliverables"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    delivery_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(50))
    deadline: Mapped[datetime | None] = mapped_column(DateTime)
    release: Mapped[datetime | None] = mapped_column(DateTime)
    state: Mapped[str | None] = mapped_column(String(50))
    is_sandbox: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)

    project_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))

    project: Mapped["Project | None"] = relationship(back_populates="deliverables")
    backlog_items: Mapped[list["BacklogItem"]] = relationship(back_populates="deliverable")


class BacklogItem(TimestampMixin, Base):
    __tablename__ = "backlog_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    code: Mapped[int] = mapped_column(BigInteger)
    title: Mapped[str] = mapped_column(String(200))
    item_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    planned_start_date: Mapped[datetime | None] = mapped_column(DateTime)
    planned_end_date: Mapped[datetime | None] = mapped_column(DateTime)
    actual_start_date: Mapped[datetime | None] = mapped_column(DateTime)
    actual_end_date: Mapped[datetime | None] = mapped_column(DateTime)
    work_hours: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    user_impact: Mapped[str | None] = mapped_column(String(50))
    business_impact: Mapped[str | None] = mapped_column(String(50))
    expended_energy: Mapped[str | None] = mapped_column(String(50))
    roe: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    notes: Mapped[str | None] = mapped_column(Text)

    deliverable_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    responsible_voe_id: Mapped[int | None] = mapped_column(BigInteger)

    deliverable_id: Mapped[int | None] = mapped_column(ForeignKey("deliverables.id"))

    deliverable: Mapped["Deliverable | None"] = relationship(back_populates="backlog_items")
    activities: Mapped[list["Activity"]] = relationship(back_populates="backlog_item")


class Iteration(TimestampMixin, Base):
    __tablename__ = "iterations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    code: Mapped[str] = mapped_column(String(23))
    start_date: Mapped[datetime | None] = mapped_column(DateTime)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(50))
    state: Mapped[str] = mapped_column(String(50))
    goal: Mapped[str | None] = mapped_column(String(200))
    is_last: Mapped[bool] = mapped_column(Boolean, default=True)

    product_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))

    product: Mapped["Product | None"] = relationship(back_populates="iterations")
    activity_states: Mapped[list["ActivityState"]] = relationship(back_populates="iteration")


class Activity(TimestampMixin, Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    domain: Mapped[str | None] = mapped_column(String(50))
    instructions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50))
    estimation_hours: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    work_hours: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    notes: Mapped[str | None] = mapped_column(Text)

    backlog_item_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    profile_voe_id: Mapped[int | None] = mapped_column(BigInteger)

    backlog_item_id: Mapped[int | None] = mapped_column(ForeignKey("backlog_items.id"))
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"))

    backlog_item: Mapped["BacklogItem | None"] = relationship(back_populates="activities")
    profile: Mapped["Profile | None"] = relationship()
    activity_states: Mapped[list["ActivityState"]] = relationship(back_populates="activity")
    energy_entries: Mapped[list["EnergyEntry"]] = relationship(back_populates="activity")


class ActivityState(TimestampMixin, Base):
    __tablename__ = "activity_states"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    status: Mapped[str | None] = mapped_column(String(50))
    start_date_time: Mapped[datetime | None] = mapped_column(DateTime)
    end_date_time: Mapped[datetime | None] = mapped_column(DateTime)
    total_hours: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    notes: Mapped[str | None] = mapped_column(Text)

    iteration_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    activity_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    profile_voe_id: Mapped[int | None] = mapped_column(BigInteger)

    iteration_id: Mapped[int | None] = mapped_column(ForeignKey("iterations.id"))
    activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id"))
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"))

    iteration: Mapped["Iteration | None"] = relationship(back_populates="activity_states")
    activity: Mapped["Activity | None"] = relationship(back_populates="activity_states")


class EnergyEntry(TimestampMixin, Base):
    __tablename__ = "energy_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    start_date_time: Mapped[datetime | None] = mapped_column(DateTime)
    end_date_time: Mapped[datetime | None] = mapped_column(DateTime)
    total_hours: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    total_cost: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    notes: Mapped[str | None] = mapped_column(Text)

    activity_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    profile_voe_id: Mapped[int | None] = mapped_column(BigInteger)

    activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id"))
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"))

    activity: Mapped["Activity | None"] = relationship(back_populates="energy_entries")
    profile: Mapped["Profile | None"] = relationship()


# ── Flowup Tables ────────────────────────────────────────────────────

class FUCostCenter(Base):
    __tablename__ = "fu_cost_centers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    fu_project_id: Mapped[int | None] = mapped_column(BigInteger)
    fu_project_name: Mapped[str | None] = mapped_column(String(200))
    fu_board_id: Mapped[int | None] = mapped_column(BigInteger)
    fu_board_name: Mapped[str | None] = mapped_column(String(200))

    project_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FUMember(Base):
    __tablename__ = "fu_members"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fu_member_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FUUser(Base):
    __tablename__ = "fu_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voe_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    fu_user_id: Mapped[int | None] = mapped_column(BigInteger)
    fu_user_name: Mapped[str | None] = mapped_column(String(200))

    team_member_voe_id: Mapped[int | None] = mapped_column(BigInteger)
    team_member_id: Mapped[int | None] = mapped_column(ForeignKey("team_members.id"))
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    team_member: Mapped["TeamMember | None"] = relationship(back_populates="fu_user")


class FlowupReport(Base):
    __tablename__ = "flowup_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fu_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    fu_project_id: Mapped[int | None] = mapped_column(BigInteger)
    fu_task_id: Mapped[int | None] = mapped_column(BigInteger)
    fu_member_id: Mapped[int | None] = mapped_column(BigInteger)
    fu_member_name: Mapped[str | None] = mapped_column(String(200))
    start_datetime: Mapped[datetime | None] = mapped_column(DateTime)
    end_datetime: Mapped[datetime | None] = mapped_column(DateTime)
    worked_hours: Mapped[Decimal | None] = mapped_column(Numeric(20, 8))
    description: Mapped[str | None] = mapped_column(Text)
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ── FlowUp Board / Task Tables ───────────────────────────────────────

class FUBoard(Base):
    __tablename__ = "fu_boards"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fu_board_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    fu_board_name: Mapped[str | None] = mapped_column(String(200))
    fu_cost_center_id: Mapped[int | None] = mapped_column(BigInteger)
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FUBoardTask(Base):
    __tablename__ = "fu_board_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fu_task_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    fu_board_id: Mapped[int | None] = mapped_column(BigInteger)
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ProjectFlowupMapping(Base):
    __tablename__ = "project_flowup_mappings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), unique=True, nullable=False)
    mapping_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'cost_center' | 'board'
    fu_cost_center_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    fu_board_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


# ── Application Tables ───────────────────────────────────────────────

class UserMapping(Base):
    __tablename__ = "user_mappings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_member_id: Mapped[int] = mapped_column(ForeignKey("team_members.id"), unique=True)
    fu_member_id: Mapped[int] = mapped_column(BigInteger)
    fu_member_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    team_member: Mapped["TeamMember"] = relationship()


class Dashboard(Base):
    __tablename__ = "dashboards"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    layout: Mapped[str] = mapped_column(Text, default="[]")  # JSON stored as text
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class SyncLog(Base):
    __tablename__ = "sync_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(20))  # 'odata' or 'flowup'
    entity: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20))  # 'success', 'error'
    records_synced: Mapped[int] = mapped_column(default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)


class AppConfig(Base):
    __tablename__ = "app_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    order_projects: Mapped[list["OrderProject"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderProject(Base):
    __tablename__ = "order_projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    order: Mapped["Order"] = relationship(back_populates="order_projects")
    project: Mapped["Project"] = relationship()

"""OData sync service — fetches all entity collections and upserts into PostgreSQL."""
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.core.ws import notify_ws


def parse_dt(val: Any) -> datetime | None:
    """Parse an ISO datetime string, returning a timezone-naive UTC datetime."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None) if val.tzinfo else val
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
            return dt.replace(tzinfo=None)
        except (ValueError, TypeError):
            return None
    return None


def utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_json_response_with_trailing(resp: httpx.Response) -> tuple[Any, str]:
    """Parse a JSON response and return (parsed_obj, trailing_text).

    Mendix's OData endpoint occasionally returns a complete JSON page followed
    by an inline error payload (the server crashes mid-stream while serializing
    a record but had already written HTTP 200 + 31 valid records). We need to
    surface that trailing error to the caller so it can recover.
    """
    raw = resp.text
    try:
        return resp.json(), ""
    except json.JSONDecodeError:
        decoder = json.JSONDecoder()
        obj, idx = decoder.raw_decode(raw.strip())
        return obj, raw.strip()[idx:].strip()


def parse_json_response(resp: httpx.Response) -> Any:
    """Backwards-compatible wrapper that discards trailing payload."""
    obj, _ = parse_json_response_with_trailing(resp)
    return obj

logger = logging.getLogger(__name__)

# Entity definitions: (OData collection, table_name, column_mapping, nav_property_fk_mapping)
# nav_property_fk_mapping: {NavigationPropertyName: (local_fk_col, referenced_table)}
ENTITY_SYNC_ORDER: list[dict[str, Any]] = [
    {
        "collection": "Customers",
        "table": "customers",
        "columns": {
            "ID": "voe_id", "Name": "name", "Satisfaction": "satisfaction",
            "Sector": "sector", "Region": "region", "Notes": "notes",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {},
    },
    {
        "collection": "Departments",
        "table": "departments",
        "columns": {
            "ID": "voe_id", "Description": "description",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {},
    },
    {
        "collection": "Products",
        "table": "products",
        "columns": {
            "ID": "voe_id", "Title": "title", "Code": "code", "State": "state",
            "Status": "status", "Description": "description", "Domain": "domain",
            "LaunchDate": "launch_date", "Version": "version", "Notes": "notes",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {},
    },
    {
        "collection": "TeamMembers",
        "table": "team_members",
        "columns": {
            "ID": "voe_id", "FullName": "full_name", "Name": "name", "Email": "email",
            "Whatsapp": "whatsapp", "IsLocalUser": "is_local_user", "Active": "active",
            "LastLogin": "last_login",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {},
    },
    {
        "collection": "Projects",
        "table": "projects",
        "columns": {
            "ID": "voe_id", "Title": "title", "ProjectType": "project_type",
            "Category": "category", "Status": "status", "CostCenter": "cost_center",
            "IsDelayed": "is_delayed", "StartDate": "start_date",
            "PlannedEndDate": "planned_end_date", "ActualEndDate": "actual_end_date",
            "Notes": "notes", "ProfitMargin": "profit_margin",
            "SellingPrice": "selling_price", "ExtraProjCost": "extra_proj_cost",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Project_Customer": ("customer_voe_id", "customers", "customer_id"),
            "Project_Product": ("product_voe_id", "products", "product_id"),
            "Project_Accountable": ("accountable_voe_id", "team_members", "accountable_id"),
            "Project_Department": ("department_voe_id", "departments", "department_id"),
        },
    },
    {
        "collection": "Positions",
        "table": "positions",
        "columns": {
            "FileID": "voe_id", "Description": "description", "Domain": "domain",
            "Level": "level", "Notes": "notes",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {},
    },
    {
        "collection": "Profiles",
        "table": "profiles",
        "columns": {
            "ID": "voe_id", "Description": "description", "NetCost": "net_cost",
            "WorkingHours": "working_hours", "EffectiveDate": "effective_date",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Profile_Member": ("team_member_voe_id", "team_members", "team_member_id"),
            "Profile_Position": ("position_voe_id", "positions", "position_id"),
        },
    },
    {
        "collection": "Resources",
        "table": "resources",
        "columns": {
            "ID": "voe_id", "HourlyRate": "hourly_rate", "Cost": "cost",
            "Commission": "commission", "Profit": "profit", "ProfitMargin": "profit_margin",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Resource_Project": ("project_voe_id", "projects", "project_id"),
            "Resource_Position": ("position_voe_id", "positions", "position_id"),
        },
    },
    {
        "collection": "Deliverables",
        "table": "deliverables",
        "columns": {
            "ID": "voe_id", "Title": "title", "DeliveryType": "delivery_type",
            "Description": "description", "Status": "status", "Deadline": "deadline",
            "Release": "release", "State": "state", "IsSandbox": "is_sandbox",
            "Notes": "notes",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Sandbox_Project": ("project_voe_id", "projects", "project_id"),
        },
    },
    {
        "collection": "BacklogItems",
        "table": "backlog_items",
        "columns": {
            "ID": "voe_id", "Code": "code", "Title": "title", "ItemType": "item_type",
            "Status": "status", "Description": "description",
            "PlannedStartDate": "planned_start_date", "PlannedEndDate": "planned_end_date",
            "ActualStartDate": "actual_start_date", "ActualEndDate": "actual_end_date",
            "WorkHours": "work_hours", "UserImpact": "user_impact",
            "BusinessImpact": "business_impact", "ExpendedEnergy": "expended_energy",
            "ROE": "roe", "Notes": "notes",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Item_Sandbox": ("deliverable_voe_id", "deliverables", "deliverable_id"),
            "BacklogItem_Responsable": ("responsible_voe_id", "team_members", None),
        },
    },
    {
        "collection": "Iterations",
        "table": "iterations",
        "columns": {
            "ID": "voe_id", "Code": "code", "StartDate": "start_date",
            "EndDate": "end_date", "Status": "status", "State": "state",
            "Goal": "goal", "IsLast": "is_last",
            "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Iteration_Product": ("product_voe_id", "products", "product_id"),
        },
    },
    {
        "collection": "Activities",
        "table": "activities",
        "columns": {
            "ID": "voe_id", "Title": "title", "Domain": "domain",
            "Instructions": "instructions", "Status": "status",
            "EstimationHours": "estimation_hours", "WorkHours": "work_hours",
            "Notes": "notes",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Activity_Item": ("backlog_item_voe_id", "backlog_items", "backlog_item_id"),
            "Activity_Profile": ("profile_voe_id", "profiles", "profile_id"),
        },
    },
    {
        "collection": "ActivityStates",
        "table": "activity_states",
        "columns": {
            "ID": "voe_id", "Status": "status",
            "StartDateTime": "start_date_time", "EndDateTime": "end_date_time",
            "TotalHours": "total_hours", "Notes": "notes",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Iteration_State": ("iteration_voe_id", "iterations", "iteration_id"),
            "Activity_State": ("activity_voe_id", "activities", "activity_id"),
            "ActivityState_Profile": ("profile_voe_id", "profiles", "profile_id"),
        },
    },
    {
        "collection": "Energies",
        "table": "energy_entries",
        "columns": {
            "ID": "voe_id", "StartDateTime": "start_date_time",
            "EndDateTime": "end_date_time", "TotalHours": "total_hours",
            "TotalCost": "total_cost", "Notes": "notes",
            "IsActive": "is_active", "changedDate": "changed_date", "createdDate": "created_date",
        },
        "nav_fks": {
            "Energy_Activity": ("activity_voe_id", "activities", "activity_id"),
            "Energy_Profile": ("profile_voe_id", "profiles", "profile_id"),
        },
    },
    # Flowup bridge tables from OData
    {
        "collection": "FUCostCenters",
        "table": "fu_cost_centers",
        "columns": {
            "ID": "voe_id", "FUProjectId": "fu_project_id",
            "FUProjectName": "fu_project_name", "FUBoardId": "fu_board_id",
            "FUBoardName": "fu_board_name",
        },
        "nav_fks": {
            "FUCostCenter_Project": ("project_voe_id", "projects", "project_id"),
        },
    },
    {
        "collection": "FUUsers",
        "table": "fu_users",
        "columns": {
            "ID": "voe_id", "FUUserId": "fu_user_id", "FUUserName": "fu_user_name",
        },
        "nav_fks": {
            "FUUser_TeamMember": ("team_member_voe_id", "team_members", "team_member_id"),
        },
    },
]


async def fetch_odata_collection(client: httpx.AsyncClient, collection: str) -> list[dict]:
    """Fetch all records from an OData collection, handling pagination and $expand."""
    all_records = []
    url = f"{settings.odata_base_url}/{collection}"

    while url:
        resp = await client.get(url, params={"$top": 1000, "$count": "true"} if not all_records else {})
        resp.raise_for_status()
        data = parse_json_response(resp)
        all_records.extend(data.get("value", []))
        url = data.get("@odata.nextLink")

    return all_records


async def fetch_collection_with_recovery(
    client: httpx.AsyncClient,
    collection: str,
    expand_props: list[str],
    voe_id_field: str,
) -> list[dict]:
    """Fetch a collection with $expand, recovering from Mendix mid-stream truncation.

    Mendix's OData has a bug where listing /<Collection>?$expand=... can crash
    mid-response when one record's nav property fails to serialize. The server
    sends HTTP 200, the first N valid records, then appends an inline error
    payload. We detect that, then backfill the missing records by listing the
    collection without $expand (to get the full ID set) and refetching each
    missing record individually with $expand (which works one-by-one).
    """
    base_url = f"{settings.odata_base_url}/{collection}"
    params: dict[str, str] = {}
    if expand_props:
        params["$expand"] = ",".join(expand_props)

    all_records: list[dict] = []
    truncated_trailing = ""
    next_url: str | None = base_url
    while next_url:
        resp = await client.get(next_url, params=params if not all_records else {})
        resp.raise_for_status()
        data, trailing = parse_json_response_with_trailing(resp)
        all_records.extend(data.get("value", []))
        if trailing and '"error"' in trailing:
            truncated_trailing = trailing
            break
        next_url = data.get("@odata.nextLink")

    if not truncated_trailing:
        return all_records

    logger.warning(
        f"  {collection}: Mendix truncated response after {len(all_records)} records; "
        f"trailing payload: {truncated_trailing[:200]}"
    )

    full_records: list[dict] = []
    next_full: str | None = base_url
    while next_full:
        resp = await client.get(next_full)
        resp.raise_for_status()
        data, trailing = parse_json_response_with_trailing(resp)
        full_records.extend(data.get("value", []))
        if trailing and '"error"' in trailing:
            logger.error(
                f"  {collection}: no-expand fetch also truncated after {len(full_records)} records; "
                f"cannot fully recover. Trailing: {trailing[:200]}"
            )
            break
        next_full = data.get("@odata.nextLink")

    present_ids = {r.get(voe_id_field) for r in all_records if r.get(voe_id_field) is not None}
    missing = [r for r in full_records if r.get(voe_id_field) is not None and r[voe_id_field] not in present_ids]
    logger.info(f"  {collection}: backfilling {len(missing)} missing record(s) individually")

    for rec in missing:
        vid = rec[voe_id_field]
        merged = await _fetch_one_with_per_nav_recovery(
            client, base_url, vid, voe_id_field, expand_props, fallback=rec,
        )
        all_records.append(merged)

    return all_records


def _is_error_payload(data: Any, trailing: str, voe_id_field: str) -> bool:
    """True when the OData response is/contains an error payload instead of a record."""
    if trailing and '"error"' in trailing:
        return True
    if isinstance(data, dict) and "error" in data and not data.get(voe_id_field):
        return True
    return False


async def _fetch_one_with_per_nav_recovery(
    client: httpx.AsyncClient,
    base_url: str,
    vid: Any,
    voe_id_field: str,
    expand_props: list[str],
    fallback: dict,
) -> dict:
    """Fetch a single record, working around Mendix per-record expand crashes.

    First tries the combined $expand. If that returns an error payload, fetches
    the base record without $expand and then each nav prop separately, merging
    whichever succeed. Any nav whose individual expand also crashes is left
    null and the FK will be NULL in the upsert.
    """
    entity_url = f"{base_url}({vid})"
    try:
        params: dict[str, str] = {}
        if expand_props:
            params["$expand"] = ",".join(expand_props)
        resp = await client.get(entity_url, params=params)
        resp.raise_for_status()
        data, trailing = parse_json_response_with_trailing(resp)
        if not _is_error_payload(data, trailing, voe_id_field):
            return data
    except Exception as e:
        logger.warning(f"  {entity_url}: combined-expand fetch failed ({e})")

    logger.warning(f"  {entity_url}: combined expand errored on Mendix; falling back to per-nav fetch")
    try:
        resp = await client.get(entity_url)
        resp.raise_for_status()
        base_data, base_trailing = parse_json_response_with_trailing(resp)
        if _is_error_payload(base_data, base_trailing, voe_id_field):
            logger.warning(f"  {entity_url}: even no-expand individual errored; using list fallback")
            return fallback
    except Exception as e:
        logger.warning(f"  {entity_url}: no-expand individual fetch failed ({e}); using list fallback")
        return fallback

    merged = dict(base_data)
    for nav in expand_props:
        try:
            resp = await client.get(entity_url, params={"$expand": nav})
            resp.raise_for_status()
            d, trailing = parse_json_response_with_trailing(resp)
            if _is_error_payload(d, trailing, voe_id_field):
                logger.warning(f"  {entity_url}: $expand={nav} errored on Mendix; leaving FK null")
                continue
            if nav in d:
                merged[nav] = d[nav]
        except Exception as e:
            logger.warning(f"  {entity_url}: $expand={nav} fetch failed ({e}); leaving FK null")
    return merged


def extract_nav_id(record: dict, nav_prop: str) -> int | None:
    """Extract a navigation property's ID if it was expanded, or from deferred link."""
    nav = record.get(nav_prop)
    if isinstance(nav, dict):
        return nav.get("ID") or nav.get("FileID")
    return None


async def resolve_fk(session: AsyncSession, voe_id: int | None, ref_table: str) -> int | None:
    """Look up local id from voe_id in the referenced table."""
    if voe_id is None:
        return None
    result = await session.execute(
        text(f"SELECT id FROM {ref_table} WHERE voe_id = :voe_id"),
        {"voe_id": voe_id},
    )
    row = result.first()
    return row[0] if row else None


async def upsert_entity(
    session: AsyncSession,
    table: str,
    columns: dict[str, str],
    nav_fks: dict,
    records: list[dict],
) -> int:
    """Upsert records into the given table. Returns count of synced records."""
    if not records:
        return 0

    DATE_COLS = {
        "launch_date", "deadline", "release", "last_login", "effective_date",
        "start_date", "end_date", "start_date_time", "end_date_time",
        "planned_start_date", "planned_end_date", "actual_start_date",
        "actual_end_date", "created_date", "changed_date",
    }

    # Determine which OData field maps to voe_id (usually "ID", but may be "FileID" etc.)
    voe_id_field = next((k for k, v in columns.items() if v == "voe_id"), "ID")

    count = 0
    for record in records:
        # Skip records without an ID — cannot upsert on voe_id
        if record.get(voe_id_field) is None:
            continue

        # Map OData fields to local columns
        row: dict[str, Any] = {}
        for odata_field, local_col in columns.items():
            val = record.get(odata_field)
            if local_col in DATE_COLS or local_col.endswith("_date") or local_col.endswith("_time"):
                val = parse_dt(val)
            row[local_col] = val

        # Extract navigation property foreign keys
        for nav_prop, (fk_col, ref_table, local_fk_col) in nav_fks.items():
            nav_voe_id = extract_nav_id(record, nav_prop)
            row[fk_col] = nav_voe_id
            if local_fk_col:
                row[local_fk_col] = await resolve_fk(session, nav_voe_id, ref_table)

        row["synced_at"] = utcnow_naive()

        # Default is_active to True if not provided
        if "is_active" in row and row["is_active"] is None:
            row["is_active"] = True

        # Build upsert
        col_names = list(row.keys())
        placeholders = ", ".join(f":{c}" for c in col_names)
        col_list = ", ".join(col_names)
        update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in col_names if c != "voe_id")

        sql = f"""
            INSERT INTO {table} ({col_list})
            VALUES ({placeholders})
            ON CONFLICT (voe_id) DO UPDATE SET {update_set}
        """
        await session.execute(text(sql), row)
        count += 1

    return count


async def sync_all_odata():
    """Run full OData sync for all entity types in FK order."""
    logger.info("Starting OData sync...")
    results = {}

    async with httpx.AsyncClient(
        auth=(settings.odata_username, settings.odata_password),
        timeout=120.0,
    ) as client:
        for entity_def in ENTITY_SYNC_ORDER:
            collection = entity_def["collection"]
            table = entity_def["table"]
            started = utcnow_naive()

            try:
                expand_props = list(entity_def["nav_fks"].keys())
                voe_id_field = next(
                    (k for k, v in entity_def["columns"].items() if v == "voe_id"),
                    "ID",
                )
                all_records = await fetch_collection_with_recovery(
                    client, collection, expand_props, voe_id_field,
                )

                async with async_session() as session:
                    count = await upsert_entity(
                        session, table, entity_def["columns"],
                        entity_def["nav_fks"], all_records,
                    )
                    await session.commit()

                    # Log success
                    await session.execute(
                        text("""INSERT INTO sync_log (source, entity, status, records_synced, started_at, completed_at)
                                VALUES ('odata', :entity, 'success', :count, :started, :completed)"""),
                        {"entity": collection, "count": count, "started": started, "completed": utcnow_naive()},
                    )
                    await session.commit()
                results[collection] = {"status": "success", "count": count}
                logger.info(f"  Synced {collection}: {count} records")
                await notify_ws({"type": "sync_progress", "source": "odata", "entity": collection, "status": "success", "records_synced": count})

            except Exception as e:
                logger.error(f"  Error syncing {collection}: {e}")
                try:
                    async with async_session() as session:
                        await session.execute(
                            text("""INSERT INTO sync_log (source, entity, status, records_synced, error_message, started_at, completed_at)
                                    VALUES ('odata', :entity, 'error', 0, :error, :started, :completed)"""),
                            {"entity": collection, "error": str(e)[:500], "started": started, "completed": utcnow_naive()},
                        )
                        await session.commit()
                except Exception:
                    pass
                results[collection] = {"status": "error", "error": str(e)}
                await notify_ws({"type": "sync_progress", "source": "odata", "entity": collection, "status": "error"})

        # Refresh materialized views
        for mv in ["mv_project_health", "mv_team_workload", "mv_iteration_progress"]:
            try:
                async with async_session() as session:
                    await session.execute(text(f"REFRESH MATERIALIZED VIEW {mv}"))
                    await session.commit()
            except Exception as e:
                logger.warning(f"  Error refreshing {mv}: {e}")
        logger.info("  Materialized views refreshed")

    logger.info("OData sync complete.")
    await notify_ws({"type": "sync_complete", "source": "odata"})
    return results

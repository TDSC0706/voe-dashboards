# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Testing if the Application is Running

Use the **Chrome DevTools MCP** (`mcp__chrome-devtools__*` tools) for all UI tests and browser interaction. Navigate to pages, take screenshots, inspect console messages, and verify network requests directly via MCP — do not use Playwright.

Quick health check:
1. Use `mcp__chrome-devtools__navigate_page` to `http://localhost:8080` — verify the frontend loads.
2. Check the backend from inside its container (see below) — `localhost:8000` on Windows **does NOT reach the Docker backend**.

Run both checks **45 seconds apart** to confirm containers stay stable.

## Docker & Networking

Docker Desktop is installed on Windows (not WSL — do not use WSL for Docker). Standard `docker compose` commands work from any terminal.

**Important:** If docker commands fail with a connection error, the `DOCKER_HOST` env var may still be set to the old WSL value (`tcp://localhost:2375`). Either remove it from system environment variables or prefix commands with `DOCKER_HOST=`. The Docker context should be `desktop-linux`.

### ⚠️ Backend port is NOT exposed to the Windows host

The `docker-compose.yml` intentionally has **no `ports:` mapping for the backend** (production setup uses Traefik). `localhost:8000` on Windows is served by a separate local WSL process — **not the Docker backend container**. Sending curl/HTTP requests to `localhost:8000` will hit the wrong process.

**Always interact with the backend container directly:**

```bash
# Run a Python script inside the container (e.g. trigger a sync)
docker exec voedashboard-backend-1 python -c "
import asyncio, sys
sys.path.insert(0, '/app')
from app.sync.odata_sync import sync_all_odata
import json; print(json.dumps(asyncio.run(sync_all_odata()), indent=2))
"

# Query the database
docker-compose exec -T db psql -U voe -d voedashboard -c "SELECT ..."

# Read backend logs
docker logs voedashboard-backend-1
```

Port mapping summary (as of production-compat branch):
- Frontend → `localhost:8080` (host) maps to container port 3000
- Backend → **no host port** (internal only, container name `backend` on Docker network)
- PostgreSQL → internal only (container name `db`)

FlowUp MySQL table reference: `costcenters` (columns: `Id`, `Name`, `Client_Id`). Reports table: `reportagem` (`Projeto_Id` = `costcenters.Id`). Members table: `membro`.

## After Every Change

After making any code change, rebuild and restart the app so the user can see the result:

```bash
docker-compose up -d --build
```

## Maintenance Instruction

**Every time you discover or learn something important about this project** — such as correct table/column names, working connection patterns, environment quirks, architectural decisions, or anything that would help future sessions — **update this file immediately**. Keep it accurate and up to date.

## Project Overview

VOE Dashboard is a project management and KPI dashboard application that syncs data from Mendix (via OData) and FlowUp (MySQL on Azure) into a local PostgreSQL database, serving a Next.js frontend via a FastAPI backend.

## Commands

### Full Stack (Docker)
```bash
docker-compose up -d        # Start all services (PostgreSQL, backend, frontend)
docker-compose down         # Stop all services
docker-compose logs -f      # Follow logs
```

### Backend (FastAPI — Python 3.12)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload       # Dev server at http://localhost:8000
alembic upgrade head                # Apply DB migrations
alembic revision --autogenerate -m "description"  # Generate migration
```

### Frontend (Next.js 14)
```bash
cd frontend
npm install
npm run dev     # Dev server at http://localhost:3000
npm run build   # Production build
npm run start   # Run production build
```

## Architecture

### Data Flow
```
Mendix OData API  ──→ backend/app/sync/odata_sync.py  ──→ PostgreSQL
FlowUp MySQL      ──→ backend/app/sync/flowup_sync.py ──→ PostgreSQL
                          ↑ scheduled by APScheduler (scheduler.py)

Frontend (Next.js) ←── REST API (FastAPI) ←── PostgreSQL
                   ←── WebSocket (real-time sync notifications)
```

### Backend (`backend/app/`)
- `main.py` — FastAPI app entry, lifespan hooks, WebSocket endpoint
- `core/config.py` — Pydantic settings loaded from `.env`
- `core/database.py` — Async SQLAlchemy engine and session factory
- `models/voe.py` — All ORM models (Customer, Project, Iteration, Deliverable, TeamMember, Activity, etc.)
- `api/v1/` — Route handlers grouped by domain (projects, iterations, team, deliverables, sync, flowup, dashboards, user_mappings)
- `sync/` — OData and FlowUp sync logic; `scheduler.py` runs syncs every 5 min (OData) and 10 min (FlowUp)
- Migrations live in `alembic/versions/`

### Frontend (`frontend/src/`)
- Uses Next.js App Router (`src/app/` — file-based routing)
- `src/lib/api.ts` — Centralized API client; all fetch calls go through here
- `src/lib/utils.ts` — Shared formatters (currency, dates, status colors)
- `src/hooks/useApi.ts` — Generic data-fetching hook with loading/error state
- `src/components/ui/` — Shared UI primitives (Card, KPICard, Badge, DataTable, ProgressBar, Loader)
- `src/components/layout/Sidebar.tsx` — Main navigation

### Environment
All configuration is in `.env` at the project root. Key vars:
- `POSTGRES_*` — Local PostgreSQL connection
- `ODATA_*` — Mendix OData base URL and credentials
- `FLOWUP_*` — Azure MySQL connection for FlowUp
- `SYNC_INTERVAL_*` — Sync frequencies in minutes

Port mapping (docker-compose): PostgreSQL→5432, Backend→8000, Frontend→3001 (host) / 3000 (container).
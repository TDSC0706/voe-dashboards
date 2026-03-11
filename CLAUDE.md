# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Testing if the Application is Running

Use Playwright to verify the app is up. Run two checks **45 seconds apart** to confirm containers stay stable:

```bash
# First check — verify both services respond
npx playwright test --config=playwright.health.config.ts 2>/dev/null || \
  node -e "
    const { chromium } = require('playwright');
    (async () => {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      const fe = await page.goto('http://localhost:3001', { timeout: 15000 });
      console.log('frontend:', fe.status());
      const be = await page.goto('http://localhost:8000/health', { timeout: 15000 });
      console.log('backend:', be.status());
      await browser.close();
    })().catch(e => { console.error(e.message); process.exit(1); });
  "

# Wait 45 seconds, then repeat the same check
sleep 45

node -e "
  const { chromium } = require('playwright');
  (async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fe = await page.goto('http://localhost:3001', { timeout: 15000 });
    console.log('frontend:', fe.status());
    const be = await page.goto('http://localhost:8000/health', { timeout: 15000 });
    console.log('backend:', be.status());
    await browser.close();
  })().catch(e => { console.error(e.message); process.exit(1); });
"
```

Both should print `200`.

## Docker & Networking

Docker Desktop is installed on Windows (not WSL — do not use WSL for Docker). Standard `docker compose` commands work from any terminal.

**Important:** If docker commands fail with a connection error, the `DOCKER_HOST` env var may still be set to the old WSL value (`tcp://localhost:2375`). Either remove it from system environment variables or prefix commands with `DOCKER_HOST=`. The Docker context should be `desktop-linux`.

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
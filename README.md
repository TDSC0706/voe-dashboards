# VOE Dashboard

A project management and KPI dashboard that syncs data from **Mendix** (via OData) and **FlowUp** (MySQL on Azure) into a local PostgreSQL database, serving a Next.js frontend via a FastAPI backend.

## Architecture

```
Mendix OData API  ──→ backend/app/sync/odata_sync.py  ──→ PostgreSQL
FlowUp MySQL      ──→ backend/app/sync/flowup_sync.py ──→ PostgreSQL
                          ↑ APScheduler (every 5 / 10 min)

Frontend (Next.js) ←── REST API (FastAPI) ←── PostgreSQL
                   ←── WebSocket (real-time sync notifications)
```

### Services (docker-compose)

| Service    | Host port | Description              |
|------------|-----------|--------------------------|
| PostgreSQL | 5432      | Local data store         |
| Backend    | 8000      | FastAPI REST + WebSocket |
| Frontend   | 3001      | Next.js 14 App Router    |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows — not WSL)
- A `.env` file at the project root (see [Environment](#environment))

## Quick Start

```bash
# Start all services
docker-compose up -d --build

# Verify both services are up (should print 200 for each)
curl http://localhost:8000/health
curl http://localhost:3001
```

The frontend is available at **http://localhost:3001**.

## Pages

| Route           | Description                        |
|-----------------|------------------------------------|
| `/dashboard`    | KPI overview                       |
| `/projects`     | Project list and detail            |
| `/iterations`   | Sprint / iteration management      |
| `/team`         | Team members                       |
| `/time-tracking`| Time tracking                      |
| `/user-hours`   | Per-user hour reports              |
| `/pedidos`      | Requests (pedidos)                 |
| `/produtos`     | Products                           |
| `/sync`         | Manual sync trigger + status       |
| `/settings`     | App settings                       |

## Environment

All configuration lives in `.env` at the project root. Key variables:

```env
# PostgreSQL
POSTGRES_DB=voedashboard
POSTGRES_USER=voe
POSTGRES_PASSWORD=...

# Mendix OData
ODATA_BASE_URL=...
ODATA_USERNAME=...
ODATA_PASSWORD=...

# FlowUp (Azure MySQL)
FLOWUP_HOST=...
FLOWUP_PORT=3306
FLOWUP_DB=...
FLOWUP_USER=...
FLOWUP_PASSWORD=...

# Sync intervals (minutes)
SYNC_INTERVAL_ODATA=5
SYNC_INTERVAL_FLOWUP=10
```

## Development

### Backend (FastAPI — Python 3.12)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload        # http://localhost:8000
alembic upgrade head                 # Apply DB migrations
alembic revision --autogenerate -m "description"  # New migration
```

### Frontend (Next.js 14)

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
npm run build
npm run start
```

## Project Structure

```
.
├── backend/app/
│   ├── main.py              # FastAPI entry point, WebSocket endpoint
│   ├── core/
│   │   ├── config.py        # Pydantic settings
│   │   └── database.py      # Async SQLAlchemy engine
│   ├── models/voe.py        # ORM models
│   ├── api/v1/              # Route handlers (projects, team, sync, …)
│   └── sync/
│       ├── odata_sync.py    # Mendix OData sync
│       ├── flowup_sync.py   # FlowUp MySQL sync
│       └── scheduler.py     # APScheduler jobs
├── frontend/src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/
│   │   ├── ui/              # Shared UI primitives
│   │   └── layout/          # Sidebar, navigation
│   ├── lib/
│   │   ├── api.ts           # Centralized API client
│   │   └── utils.ts         # Formatters (currency, dates, status)
│   └── hooks/useApi.ts      # Data-fetching hook
├── docker-compose.yml
└── .env                     # Not committed — create from the template above
```

## Docker Notes

Docker Desktop must be running on Windows (not WSL). If `docker` commands fail with a connection error, the `DOCKER_HOST` environment variable may be set to the old WSL value (`tcp://localhost:2375`). Remove it from system environment variables or unset it before running docker commands. The correct Docker context is `desktop-linux`.

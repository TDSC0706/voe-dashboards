# App Compatibility Guide for AppHostingMgm

This document describes the requirements for a docker-compose based app to be deployed and managed by the **AppHostingMgm** hosting manager on a shared VPS.

The hosting manager clones your repo, runs `docker compose -p ahm-<app-name> -f docker-compose.yml up -d --build`, and manages the lifecycle (start/stop/restart/rollback/redeploy) from a web dashboard. The manager supports both subdomain-based routing (e.g., `myapp.yourdomain.com`) and full domain routing (e.g., `myapp.com`).

**Important:** The manager always uses `docker-compose.yml` — not a `-prod` or `-production` variant. Your `docker-compose.yml` must be the production-ready file. If you want to keep a separate dev config, name it `docker-compose.dev.yml` and run it locally with `docker compose -f docker-compose.dev.yml up`.

---

## Required Changes

### 1. Ensure the deployment branch has all production files

The manager clones the branch you specify when registering the app (defaults to `main`). If your Dockerfiles, `docker-compose.yml`, or production configs live on a different branch (e.g., `develop`), either:
- **Merge into `main`** before deploying, or
- **Set the branch** to `develop` (or whichever branch has the production files) when registering the app in the dashboard

A common pitfall: the `main` branch has source code but no Docker files, while `develop` has the Dockerfiles and compose config. The deploy will fail with "Cannot locate specified Dockerfile" if the cloned branch doesn't contain them.

### 2. Make `docker-compose.yml` production-ready

The manager uses `docker-compose.yml` directly. This file must be configured for production, not development.

Key differences from a typical dev setup:

| Aspect | Development | Production (required) |
|--------|------------|----------------------|
| Build target | `target: development` | `target: production` |
| Volume mounts | Source code mounted (`./apps/api:/app`) | No source mounts (code baked into image) |
| Ports | All services exposed to host | Only the entry point exposed |
| Container names | Hardcoded (`md_postgres`, `md_api`) | Remove entirely |
| Dev tools | MailHog, debug ports | Remove or make optional |
| Commands | `npm run start:dev` | Use Dockerfile CMD (production) |

If you need a dev compose file, keep it as `docker-compose.dev.yml` and run locally with:
```bash
docker compose -f docker-compose.dev.yml up
```

### 3. Remove the `version` attribute

```yaml
# REMOVE this line — it's obsolete in modern Docker Compose and causes warnings
version: '3.9'
```

### 4. Remove hardcoded `container_name` values

The hosting manager runs compose with `-p ahm-<app-name>`, which auto-prefixes container names. Hardcoded `container_name` values cause conflicts if multiple apps use similar names, and break the project isolation.

```yaml
# BAD - remove these
container_name: md_postgres
container_name: md_api

# GOOD - let Docker Compose auto-name them based on the project
# (no container_name field at all)
```

### 5. Remove host port mappings (or make them configurable)

On a shared VPS, hardcoded ports like `80:80`, `3000:3000`, `6379:6379` will conflict with other apps or the hosting manager itself. Services should communicate via the internal Docker Compose network (which is automatic).

Only the **entry point** service (nginx in your case) needs to be reachable, and even that should ideally not bind to a fixed host port — use Traefik labels instead (see below).

```yaml
# BAD - binds to host ports, will conflict
ports:
  - '80:80'
  - '6379:6379'

# GOOD - use APP_PORT variable (the manager sets this automatically)
ports:
  - '${APP_PORT:-8080}:80'
```

The manager assigns a unique port per app (range 8080-9000) and passes it as `APP_PORT` in the environment. This prevents port conflicts between apps.

Services like `postgres`, `redis`, and `minio` do NOT need `ports:` at all — they are automatically reachable by other services in the same compose project via their service name (e.g., `redis:6379`).

### 6. Use production build targets in Dockerfiles

Both API and Web Dockerfiles already have `production` targets. The compose file should use them:

```yaml
api:
  build:
    context: ./apps/api
    dockerfile: Dockerfile
    target: production    # <-- was "development"
  # Remove volume mounts for source code
  # volumes:             # <-- remove ./apps/api:/app mount
  #   - ./apps/api:/app
  # Remove command override — let the Dockerfile CMD run
  # command: npm run start:dev   # <-- remove this

web:
  build:
    context: ./apps/web
    dockerfile: Dockerfile
    target: production    # <-- was "development"
  # Remove volume mounts
```

### 7. Handle monorepo / npm workspaces correctly

Many Node.js apps use npm/yarn/pnpm workspaces (monorepo structure). This requires special attention for Docker builds:

**Build context must be the repo root**, not the individual app directory. Workspace packages need access to the root `package.json` and lock file:

```yaml
# BAD - build context is the app subdirectory, can't resolve workspace deps
api:
  build:
    context: ./apps/api
    dockerfile: Dockerfile

# GOOD - build context is the repo root, Dockerfile path is relative
api:
  build:
    context: .
    dockerfile: apps/api/Dockerfile
```

**Dockerfiles must copy workspace structure** before running `npm ci`:

```dockerfile
# Copy root package files first
COPY package.json package-lock.json ./

# Copy all workspace package.json stubs so npm can resolve the tree
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Now install — npm can resolve all workspace references
RUN npm ci

# Then copy the actual source
COPY apps/api/ apps/api/
```

**Note on `--omit=dev`:** If any workspace package needs devDependencies to build (e.g., `typescript` for `tsc`), do **not** use `npm ci --omit=dev` during the builder stage. Install all deps, build, then either prune or rely on multi-stage builds where only the production output is copied to the final image. The builder stage is discarded anyway.

**Only the root `package-lock.json` exists** in workspace setups. Per-app lock files won't exist because workspace packages (like `@myapp/types`) aren't published to npm. Make sure the root lock file is committed.

**Copy shared config files, not just `package.json` stubs.** Workspace packages often extend a root `tsconfig.base.json` (or `tsconfig.json`). If any workspace `tsconfig.json` has `"extends": "../../tsconfig.base.json"`, that file must be copied into the build context before running build commands:

```dockerfile
# After npm ci, copy shared configs
COPY tsconfig.base.json ./

# Then copy workspace sources and build
COPY packages/types ./packages/types
RUN cd packages/types && npm run build
```

Other common root-level files that workspace packages may reference:
- `tsconfig.base.json` / `tsconfig.json`
- `.eslintrc.*` (if linting runs during build)
- `babel.config.*`
- `jest.config.*` (if tests run during build)

### 8. Handle workspace symlinks in Docker production stages

Docker `COPY` does not follow symlinks. In npm/yarn workspaces, `node_modules/@myorg/shared` is typically a symlink to `../../packages/shared`. When you `COPY --from=builder /app/node_modules ./node_modules` in the production stage, that symlink becomes a broken link.

**Fix:** In the builder stage, replace workspace symlinks with the actual built files before the production `COPY`:

```dockerfile
# In builder stage, after building everything:
# Replace workspace symlinks with real files so COPY works
RUN for link in $(find node_modules/@myorg -type l 2>/dev/null); do \
      target=$(readlink -f "$link"); \
      rm "$link"; \
      cp -r "$target" "$link"; \
    done
```

Or target specific packages:
```dockerfile
RUN rm -rf node_modules/@music-diary/types && \
    cp -r packages/types node_modules/@music-diary/types
```

### 9. Handle Next.js standalone output in monorepos

Next.js `output: 'standalone'` in a monorepo preserves the workspace directory structure. The `server.js` entry point is **not** at the root of the standalone output — it's nested under the app's workspace path (e.g., `apps/web/server.js`).

**Production Dockerfile pattern for Next.js in a monorepo:**

```dockerfile
# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy the full standalone output (preserves workspace structure)
COPY --from=builder /app/apps/web/.next/standalone ./

# Copy static assets relative to where server.js lives
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Set working directory to where server.js actually is
WORKDIR /app/apps/web

EXPOSE 3000
CMD ["node", "server.js"]
```

**Key points:**
- `server.js` is at `standalone/apps/web/server.js`, not `standalone/server.js`
- Static files must be at `apps/web/.next/static` relative to `server.js`
- Public files must be at `apps/web/public` relative to `server.js`
- Set `WORKDIR` to the app directory so `node server.js` works

### 10. Add a `.dockerignore` file

Without `.dockerignore`, Docker sends `node_modules`, `.next`, `.git`, and `.env` files into the build context. This causes slow builds, bloated images, and potential secret leaks.

Add a `.dockerignore` at the repo root:

```
node_modules
.next
.git
.env
.env.*
*.log
dist
coverage
.turbo
```

### 11. Use a production nginx config

If your app uses nginx as a reverse proxy, you likely need a separate production config. The dev config may include HMR/webpack hot reload proxying that doesn't apply in production.

```yaml
nginx:
  image: nginx:alpine
  volumes:
    - ./infra/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
```

Keep `nginx.conf` for local dev and create `nginx.prod.conf` for the production compose file. The prod config should proxy to the production service ports and not include dev-only features.

**Important:** The `nginx.prod.conf` file must actually exist and be committed to the repo. If it's missing, Docker will create a directory in its place, causing the mount to fail with `"not a directory"`. Example production config:

```nginx
events {
    worker_connections 1024;
}
http {
    upstream api {
        server api:3001;  # match your API_PORT (NestJS defaults to 3001)
    }
    upstream web {
        server web:3000;  # Next.js defaults to 3000
    }
    server {
        listen 80;

        location /api/ {
            proxy_pass http://api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            proxy_pass http://web;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

Adjust the upstream ports to match your services (e.g., Next.js standalone runs on 3000, NestJS on 3000 or 3001, etc.).

### 12. Provide `.env.example` files for all `env_file` references

The hosting manager writes a root `.env` file with user-configured variables before running compose. However, if your `docker-compose.yml` uses `env_file:` directives pointing to **subdirectory** `.env` files (e.g., `./backend/.env`), the manager will automatically handle them:

1. It scans `docker-compose.yml` for all `env_file:` references
2. For any referenced `.env` file that doesn't exist, it looks for a `.env.example` in the same location
3. If `.env.example` exists, it copies it as `.env`
4. If no `.env.example` exists either, it creates an empty `.env` to prevent compose from failing

**Best practice:** Always commit a `.env.example` next to any `.env` file your compose references. This ensures sensible defaults are available even before the user configures variables in the dashboard.

```yaml
# If your compose file has:
services:
  backend:
    env_file:
      - ./backend/.env    # ← manager will create from ./backend/.env.example if missing

  frontend:
    env_file:
      - .env              # ← manager writes this with dashboard-configured vars
```

The user should set app-specific env vars when registering the app in the dashboard:

```json
{
  "NODE_ENV": "production",
  "JWT_ACCESS_SECRET": "<generate-a-strong-secret>",
  "JWT_REFRESH_SECRET": "<generate-a-strong-secret>",
  "APP_URL": "https://music-diary.yourdomain.com",
  "NEXT_PUBLIC_API_URL": "https://music-diary.yourdomain.com/api",
  "NEXT_PUBLIC_WS_URL": "wss://music-diary.yourdomain.com"
}
```

**Important:** The root `.env` file written by the manager contains only the variables configured in the dashboard. Subdirectory `.env` files (like `./backend/.env`) are populated from their `.env.example` — the manager does NOT merge dashboard variables into them. If your subdirectory service needs user-configured secrets, either:
- Reference the root `.env` (`env_file: - .env`) instead of a subdirectory file
- Use `environment:` in compose with `${VAR_NAME}` syntax, which inherits from the root `.env`
- Document which variables the user must add to the dashboard

### 13. (Optional) Add Traefik labels for automatic HTTPS routing

If the VPS uses Traefik as a reverse proxy (which the hosting manager supports), add labels to your entry-point service. The manager automatically sets these environment variables for your compose app:
- `AHM_APP_NAME` — the app's name in the manager
- `AHM_DOMAIN` — the resolved domain (either `subdomain.base_domain` or a full custom domain)
- `APP_PORT` — the assigned host port

Add Traefik labels to your entry-point service for automatic HTTPS routing:

```yaml
nginx:
  image: nginx:alpine
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.${AHM_APP_NAME:-app}.rule=Host(`${AHM_DOMAIN:-localhost}`)"
    - "traefik.http.routers.${AHM_APP_NAME:-app}.entrypoints=websecure"
    - "traefik.http.routers.${AHM_APP_NAME:-app}.tls.certresolver=letsencrypt"
    - "traefik.http.services.${AHM_APP_NAME:-app}.loadbalancer.server.port=80"
  networks:
    - default
    - traefik-net

networks:
  traefik-net:
    external: true
```

The hosting manager sets these environment variables automatically when deploying compose apps.

---

## Example: Production docker-compose.yml

Here's what a production-ready version of a monorepo compose file should look like:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: musicdiary
      POSTGRES_USER: musicdiary
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-musicdiary}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U musicdiary']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    volumes:
      - minio_data:/data

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_started
    entrypoint: /bin/sh /init.sh
    volumes:
      - ./infra/minio/init.sh:/init.sh:ro
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    restart: 'no'

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: production
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://musicdiary:${POSTGRES_PASSWORD:-musicdiary}@postgres:5432/musicdiary
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio
      MINIO_PORT: '9000'

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: production
    restart: unless-stopped
    depends_on:
      - api
    env_file:
      - .env
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost/api}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost}

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    depends_on:
      - api
      - web
    ports:
      - '${APP_PORT:-8080}:80'
    volumes:
      - ./infra/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## Summary of Changes Checklist

- [ ] Ensure Dockerfiles and `docker-compose.yml` are on the branch you'll deploy (usually `main` — merge from `develop` first if needed)
- [ ] Make `docker-compose.yml` the production file (move dev config to `docker-compose.dev.yml`)
- [ ] Remove `version: '3.9'` from docker-compose.yml
- [ ] Remove all `container_name:` fields
- [ ] Remove `ports:` from internal services (postgres, redis, minio, mailhog)
- [ ] Use `target: production` instead of `target: development` for api and web builds
- [ ] Remove source code volume mounts (`./apps/api:/app`, `./apps/web:/app`)
- [ ] Remove `command:` overrides that run dev scripts (e.g., `npm run start:dev`)
- [ ] Remove MailHog service (or make it conditional) — not needed in production
- [ ] Set build context to repo root (`.`) for monorepo/workspace apps, with `dockerfile: apps/api/Dockerfile`
- [ ] Update Dockerfiles to copy workspace `package.json` stubs before `npm ci`
- [ ] Copy root-level config files (`tsconfig.base.json`, etc.) that workspace packages extend via relative paths
- [ ] Add `.dockerignore` at repo root (exclude `node_modules`, `.next`, `.git`, `.env`)
- [ ] Create and commit `nginx.prod.conf` for production (must be an actual file, not missing — Docker will create a directory if the file doesn't exist, breaking the mount)
- [ ] Commit `.env.example` files next to every `.env` referenced by `env_file:` in compose (the manager auto-copies them)
- [ ] Make secrets configurable via env vars (`POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, etc.)
- [ ] Ensure `npm ci` (not `npm install`) is used in Dockerfiles for reproducible builds
- [ ] Verify `package-lock.json` is committed (root-level only for workspace/monorepo setups — per-app lock files don't exist when using workspaces)
- [ ] Verify all directories referenced by `COPY` instructions in Dockerfiles exist in the repo (e.g., Next.js `public/` — commit a `.gitkeep` or add `mkdir -p` in the builder stage if the folder may not exist)
- [ ] Pin critical service ports in the compose `environment:` block (e.g., `API_PORT: '3001'`) so they can't drift from what `nginx.prod.conf` expects if someone changes the `.env`
- [ ] Replace workspace symlinks with real files in Docker builder stage before `COPY --from=builder` (Docker COPY doesn't follow symlinks — workspace `node_modules/@org/pkg` links will be broken in production)
- [ ] For Next.js monorepo apps: standalone output nests `server.js` under the workspace path (e.g., `apps/web/server.js`) — set `WORKDIR` accordingly and copy static/public assets relative to it
- [ ] Set entry-point port to `${APP_PORT:-8080}:80` so the manager can assign a unique port per app
- [ ] For Traefik HTTPS: add labels and `traefik-net` external network to the entry-point service (see section 13)

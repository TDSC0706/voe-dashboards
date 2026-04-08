import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

try:
    from app.api.v1 import auth, users, client
    _auth_ok = True
except Exception as e:
    logger.error(f"[router] IMPORT ERROR for auth/users/client: {e}", exc_info=True)
    _auth_ok = False

from app.api.v1 import (
    dashboards, deliverables, flowup, iterations, pedidos, products,
    projects, sync, team, user_mappings,
)

api_router = APIRouter(prefix="/api/v1")

if _auth_ok:
    api_router.include_router(auth.router)
    api_router.include_router(users.router)
    api_router.include_router(client.router)
api_router.include_router(projects.router)
api_router.include_router(iterations.router)
api_router.include_router(team.router)
api_router.include_router(products.router)
api_router.include_router(deliverables.router)
api_router.include_router(flowup.router)
api_router.include_router(sync.router)
api_router.include_router(dashboards.router)
api_router.include_router(user_mappings.router)
api_router.include_router(pedidos.router)

from fastapi import APIRouter

from app.api.v1 import (
    dashboards, deliverables, flowup, iterations, pedidos, products,
    projects, sync, team, user_mappings,
)

api_router = APIRouter(prefix="/api/v1")

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

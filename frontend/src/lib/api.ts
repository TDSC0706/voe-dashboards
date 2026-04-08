const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(status: number) {
  if (status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    window.location.href = "/login";
  }
}

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

function authedFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers as Record<string, string> || {}) },
  });
}

export const api = {
  // Projects
  projects: () => fetchApi<any[]>("/api/v1/projects"),
  projectsHealth: () => fetchApi<any[]>("/api/v1/projects/health"),
  project: (id: number) => fetchApi<any>(`/api/v1/projects/${id}`),
  projectHealth: (id: number) => fetchApi<any>(`/api/v1/projects/${id}/health`),
  projectDeliverables: (id: number) => fetchApi<any[]>(`/api/v1/projects/${id}/deliverables`),
  projectDeliverablesTree: (id: number) => fetchApi<any[]>(`/api/v1/projects/${id}/deliverables-tree`),
  projectBacklog: (id: number) => fetchApi<any[]>(`/api/v1/projects/${id}/backlog`),
  projectActivities: (id: number) => fetchApi<any[]>(`/api/v1/projects/${id}/activities`),
  projectResources: (id: number) => fetchApi<any[]>(`/api/v1/projects/${id}/resources`),
  projectFlowupHours: (id: number) => fetchApi<any>(`/api/v1/projects/${id}/flowup-hours`),

  // Iterations
  iterations: () => fetchApi<any[]>("/api/v1/iterations"),
  iteration: (id: number) => fetchApi<any>(`/api/v1/iterations/${id}`),
  iterationBurndown: (id: number) => fetchApi<any[]>(`/api/v1/iterations/${id}/burndown`),
  iterationForecast: (id: number) => fetchApi<any>(`/api/v1/iterations/${id}/forecast`),
  iterationActivities: (id: number) => fetchApi<any[]>(`/api/v1/iterations/${id}/activities`),

  // Team
  team: () => fetchApi<any[]>("/api/v1/team"),
  teamAll: () => fetchApi<any[]>("/api/v1/team/all"),
  member: (id: number) => fetchApi<any>(`/api/v1/team/${id}`),
  memberTimesheet: (id: number) => fetchApi<any>(`/api/v1/team/${id}/timesheet`),
  memberProjects: (id: number) => fetchApi<any[]>(`/api/v1/team/${id}/projects`),

  // Products
  products: () => fetchApi<any[]>("/api/v1/products"),

  // Deliverables
  deliverables: () => fetchApi<any[]>("/api/v1/deliverables"),
  deliverableTree: () => fetchApi<any>("/api/v1/deliverables/tree"),

  // Flowup
  flowupReports: (params?: string) => fetchApi<any[]>(`/api/v1/flowup/reports${params ? `?${params}` : ""}`),
  flowupMembers: () => fetchApi<any[]>("/api/v1/flowup/members"),
  flowupHoursByMember: (projectId?: number) => fetchApi<any[]>(`/api/v1/flowup/hours-by-member${projectId ? `?project_id=${projectId}` : ""}`),
  flowupDiscrepancy: () => fetchApi<any[]>("/api/v1/flowup/discrepancy"),
  userHours: (memberId?: number, groupBy: string = "none", startDate?: string, endDate?: string) =>
    fetchApi<any[]>(`/api/v1/flowup/user-hours?group_by=${groupBy}${memberId ? `&member_id=${memberId}` : ""}${startDate ? `&start_date=${startDate}` : ""}${endDate ? `&end_date=${endDate}` : ""}`),
  flowupBoards: () => fetchApi<any[]>("/api/v1/flowup/boards"),
  mapBoard: (id: number, projectId: number | null) =>
    authedFetch(`/api/v1/flowup/boards/${id}/map`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    }).then(r => r.json()),
  flowupFuBoards: () => fetchApi<any[]>("/api/v1/flowup/fu-boards"),
  flowupProjectMappings: () => fetchApi<any[]>("/api/v1/flowup/project-mappings"),
  updateProjectFlowupMapping: (projectId: number, data: any) =>
    authedFetch(`/api/v1/flowup/project-mapping/${projectId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  projectFlowupCost: (id: number) => fetchApi<any>(`/api/v1/projects/${id}/flowup-cost`),
  projectFlowupCostByMonth: (id: number) => fetchApi<any[]>(`/api/v1/projects/${id}/flowup-cost-by-month`),

  // Sync
  syncStatus: () => fetchApi<any>("/api/v1/sync/status"),
  triggerSync: () => authedFetch(`/api/v1/sync/trigger`, { method: "POST" }),
  getSyncConfig: () => fetchApi<any>("/api/v1/sync/config"),
  updateSyncConfig: (data: { odata_interval?: number; flowup_interval?: number }) =>
    authedFetch(`/api/v1/sync/config`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  // Dashboards
  dashboards: () => fetchApi<any[]>("/api/v1/dashboards"),
  dashboard: (id: number) => fetchApi<any>(`/api/v1/dashboards/${id}`),
  createDashboard: (data: any) =>
    authedFetch(`/api/v1/dashboards`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  updateDashboard: (id: number, data: any) =>
    authedFetch(`/api/v1/dashboards/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  deleteDashboard: (id: number) =>
    authedFetch(`/api/v1/dashboards/${id}`, { method: "DELETE" }),

  // Pedidos (Orders)
  pedidos: () => fetchApi<any[]>("/api/v1/pedidos"),
  pedido: (id: number) => fetchApi<any>(`/api/v1/pedidos/${id}`),
  pedidoProjects: (id: number) => fetchApi<any[]>(`/api/v1/pedidos/${id}/projects`),
  pedidoMatrix: (id: number) => fetchApi<any>(`/api/v1/pedidos/${id}/matrix`),
  createPedido: (data: any) =>
    authedFetch(`/api/v1/pedidos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  updatePedido: (id: number, data: any) =>
    authedFetch(`/api/v1/pedidos/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  deletePedido: (id: number) =>
    authedFetch(`/api/v1/pedidos/${id}`, { method: "DELETE" }),

  // User mappings
  userMappings: () => fetchApi<any[]>("/api/v1/user-mappings"),
  createUserMapping: (data: any) =>
    authedFetch(`/api/v1/user-mappings`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  deleteUserMapping: (id: number) =>
    authedFetch(`/api/v1/user-mappings/${id}`, { method: "DELETE" }),

  // Client view
  clientOverview: () => fetchApi<any>("/api/v1/client/overview"),
  customers: () => fetchApi<any[]>("/api/v1/client/customers"),

  // App users (admin)
  appUsers: () => fetchApi<any[]>("/api/v1/users"),
  createAppUser: (data: any) =>
    authedFetch(`/api/v1/users`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  updateAppUser: (id: number, data: any) =>
    authedFetch(`/api/v1/users/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  deleteAppUser: (id: number) =>
    authedFetch(`/api/v1/users/${id}`, { method: "DELETE" }),
};

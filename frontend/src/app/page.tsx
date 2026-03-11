"use client";
import { useState, useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { riskColor, formatCurrency, formatDate } from "@/lib/utils";
import { FolderKanban, AlertTriangle, Users, IterationCcw } from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
} from "recharts";

type SortKey = "title" | "customer_name" | "status" | "schedule_risk" | "selling_price" | "remaining_budget" | "open_activities" | "bug_count" | "planned_end_date";

export default function HomePage() {
  const { data: health, loading, error } = useApi(() => api.projectsHealth());
  const { data: team } = useApi(() => api.team());
  const { data: iterations } = useApi(() => api.iterations());

  const [textFilter, setTextFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("schedule_risk");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!health) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const customers = Array.from(new Set((health as any[]).map((p: any) => p.customer_name).filter(Boolean))).sort();
  const statuses = Array.from(new Set((health as any[]).map((p: any) => p.status).filter(Boolean))).sort();

  const filteredHealth = (health as any[])
    .filter((p: any) =>
      (!textFilter || (p.title || "").toLowerCase().includes(textFilter.toLowerCase())) &&
      (!customerFilter || p.customer_name === customerFilter) &&
      (!statusFilter || p.status === statusFilter)
    )
    .sort((a: any, b: any) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });

  const activeProjects = health.filter((p: any) => ["ONGOING", "PLANNING"].includes(p.status));
  const atRisk = health.filter((p: any) => p.schedule_risk >= 35);
  const teamUtil = team ? Math.round(team.reduce((s: number, t: any) => s + (t.utilization_pct || 0), 0) / Math.max(team.length, 1)) : 0;
  const activeIterations = iterations ? iterations.filter((i: any) => i.status === "ONGOING").length : 0;

  // Risk matrix data — use flowup_balance when available, fall back to remaining_budget
  const riskMatrix = health.map((p: any) => {
    const balance = p.selling_price
      ? (p.flowup_balance ?? p.remaining_budget)
      : null;
    return {
      x: p.schedule_risk || 0,
      y: (p.selling_price && balance != null)
        ? Math.max(0, Math.min(100, 100 - (balance / p.selling_price) * 100))
        : 0,
      title: p.title,
      status: p.status,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Visão Geral</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Projetos Ativos" value={activeProjects.length} icon={FolderKanban}
          subtitle={`${health.length} total`} />
        <KPICard title="Projetos em Risco" value={atRisk.length} icon={AlertTriangle}
          color={atRisk.length > 0 ? "text-red-600" : "text-green-600"}
          subtitle={atRisk.length > 0 ? "Atenção necessária" : "Nenhum risco"} />
        <KPICard title="Utilização da Equipe" value={`${teamUtil}%`} icon={Users}
          color={teamUtil > 150 ? "text-red-600" : teamUtil > 100 ? "text-yellow-600" : "text-brand-600"} />
        <KPICard title="Iterações Ativas" value={activeIterations} icon={IterationCcw}
          subtitle={iterations ? `${iterations.length} total` : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Matrix */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Matriz de Risco</h2></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Risco Cronograma" type="number" domain={[0, 100]}
                  label={{ value: "Risco Cronograma", position: "bottom", fontSize: 12 }} />
                <YAxis dataKey="y" name="Risco Financeiro" type="number" domain={[0, 100]}
                  label={{ value: "Risco Financeiro", angle: -90, position: "left", fontSize: 12 }} />
                <ZAxis range={[60, 200]} />
                <Tooltip content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border p-2 rounded shadow text-xs">
                      <p className="font-medium">{d.title}</p>
                      <p>Cronograma: {d.x}</p>
                      <p>Financeiro: {Math.round(d.y)}</p>
                    </div>
                  );
                }} />
                <Scatter data={riskMatrix}>
                  {riskMatrix.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.x >= 50 || entry.y >= 50 ? "#ef4444" : entry.x >= 25 || entry.y >= 25 ? "#eab308" : "#22c55e"} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Schedule Risk Bar Chart */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Risco de Cronograma por Projeto</h2></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activeProjects.slice(0, 10)} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" angle={-30} textAnchor="end" fontSize={11} height={60} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="schedule_risk" name="Risco">
                  {activeProjects.slice(0, 10).map((p: any, i: number) => (
                    <Cell key={i} fill={p.schedule_risk >= 50 ? "#ef4444" : p.schedule_risk >= 25 ? "#eab308" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Project Health Table */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Saúde dos Projetos</h2></CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              placeholder="Buscar projeto..."
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              className="text-xs px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-300 w-44"
            />
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="text-xs px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
            >
              <option value="">Todos os clientes</option>
              {customers.map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
            >
              <option value="">Todos os status</option>
              {statuses.map((s: any) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(textFilter || customerFilter || statusFilter) && (
              <button
                onClick={() => { setTextFilter(""); setCustomerFilter(""); setStatusFilter(""); }}
                className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-800"
              >
                Limpar filtros
              </button>
            )}
            <span className="text-xs text-gray-400 self-center ml-auto">{filteredHealth.length} projetos</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase">
                  {(["title", "customer_name", "status", "schedule_risk", "selling_price", "remaining_budget", "open_activities", "bug_count", "planned_end_date"] as SortKey[]).map((key) => {
                    const labels: Record<SortKey, string> = {
                      title: "Projeto", customer_name: "Cliente", status: "Status",
                      schedule_risk: "Risco", selling_price: "Preço Venda", remaining_budget: "Saldo",
                      open_activities: "Atividades", bug_count: "Bugs", planned_end_date: "Prazo",
                    };
                    const isRight = ["schedule_risk", "selling_price", "remaining_budget", "open_activities", "bug_count"].includes(key);
                    return (
                      <th
                        key={key}
                        className={`px-3 py-2 cursor-pointer hover:text-gray-800 select-none ${isRight ? "text-right" : "text-left"}`}
                        onClick={() => handleSort(key)}
                      >
                        {labels[key]}{sortArrow(key)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredHealth.map((p: any) => (
                  <tr key={p.project_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/projects/${p.project_id}`} className="text-brand-600 hover:underline font-medium">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{p.customer_name || "—"}</td>
                    <td className="px-3 py-2"><Badge status={p.status} /></td>
                    <td className={`px-3 py-2 text-right font-bold ${riskColor(p.schedule_risk || 0)}`}>
                      {p.schedule_risk || 0}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(p.selling_price)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${(p.flowup_balance ?? p.remaining_budget ?? 0) < 0 ? "text-red-600" : ""}`}>
                      {formatCurrency(p.flowup_balance ?? p.remaining_budget)}
                    </td>
                    <td className="px-3 py-2 text-right">{p.open_activities || 0}</td>
                    <td className="px-3 py-2 text-right">{p.bug_count || 0}</td>
                    <td className="px-3 py-2 text-gray-500">{formatDate(p.planned_end_date)}</td>
                  </tr>
                ))}
                {filteredHealth.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400 text-sm">Nenhum projeto encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

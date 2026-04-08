"use client";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { KPICard } from "@/components/ui/KPICard";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatCurrency, formatDate, formatNumber, formatHours, riskColor } from "@/lib/utils";
import { DollarSign, AlertTriangle, ListChecks, Users, ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const pid = parseInt(id);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deliverableFilter, setDeliverableFilter] = useState("");
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const { data: project, loading, error } = useApi(() => api.project(pid), [pid]);
  const { data: health } = useApi(() => api.projectHealth(pid), [pid]);
  const { data: deliverables } = useApi(() => api.projectDeliverablesTree(pid), [pid]);
  const { data: activities } = useApi(() => api.projectActivities(pid), [pid]);
  const { data: resources } = useApi(() => api.projectResources(pid), [pid]);
  const { data: flowupCost } = useApi(() => api.projectFlowupCost(pid), [pid]);
  const { data: costByMonth } = useApi(() => api.projectFlowupCostByMonth(pid), [pid]);

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (project?.error) return <ErrorMessage message="Projeto não encontrado" />;
  if (!project) return null;

  // Activity breakdown by member
  const memberMap: Record<string, { name: string; hours: number; estimated: number }> = {};
  (activities || []).forEach((a: any) => {
    const name = a.member_name || "Sem atribuição";
    if (!memberMap[name]) memberMap[name] = { name, hours: 0, estimated: 0 };
    memberMap[name].hours += parseFloat(a.work_hours || 0);
    memberMap[name].estimated += parseFloat(a.estimation_hours || 0);
  });
  const memberData = Object.values(memberMap);

  // Activity status distribution
  const statusCount: Record<string, number> = {};
  (activities || []).forEach((a: any) => {
    statusCount[a.status] = (statusCount[a.status] || 0) + 1;
  });
  const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

  // Financial computed from FlowUp cost (more accurate than OData resources)
  const sellingPrice = project.selling_price ?? 0;
  const extraCost = project.extra_proj_cost ?? 0;
  const flowupTotalCost = flowupCost?.total_cost ?? 0;
  const flowupBalance = sellingPrice - flowupTotalCost - extraCost;
  const hasFlowupData = flowupCost != null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <Badge status={project.status} />
        {project.is_delayed && <Badge status="OVERDUE" label="Atrasado" />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Preço de Venda" value={formatCurrency(project?.selling_price)} icon={DollarSign} />
        <KPICard title="Saldo Restante" icon={DollarSign}
          value={hasFlowupData ? formatCurrency(flowupBalance) : (health ? formatCurrency(health.remaining_budget) : "—")}
          color={(hasFlowupData ? flowupBalance : (health?.remaining_budget ?? 0)) < 0 ? "text-red-600" : "text-green-600"} />
        <KPICard title="Risco de Cronograma" icon={AlertTriangle}
          value={health?.schedule_risk || 0}
          color={riskColor(health?.schedule_risk || 0)} />
        <KPICard title="Horas Apontadas (FlowUp)"
          value={flowupCost ? formatHours(flowupCost.total_hours) : "—"}
          icon={Users}
          subtitle={flowupCost ? `Custo: ${formatCurrency(flowupCost.total_cost)} | ${health?.open_activities || 0} atividades` : `${health?.open_activities || 0} atividades | ${health?.bug_count || 0} bugs`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Panel */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Financeiro</h2></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Preço de Venda</span><span className="font-medium">{formatCurrency(project.selling_price)}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">Custo Total {hasFlowupData ? "(FlowUp)" : "(VOE)"}</span>
              <span className="font-medium">{hasFlowupData ? formatCurrency(flowupTotalCost) : formatCurrency(health?.total_cost)}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Custos Extras</span><span className="font-medium">{formatCurrency(project.extra_proj_cost)}</span></div>
            <hr />
            <div className="flex justify-between"><span className="text-gray-500">Saldo</span>
              <span className={`font-bold ${(hasFlowupData ? flowupBalance : (health?.remaining_budget || 0)) < 0 ? "text-red-600" : "text-green-600"}`}>
                {hasFlowupData ? formatCurrency(flowupBalance) : formatCurrency(health?.remaining_budget)}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Margem</span><span className="font-medium">{formatNumber(project.profit_margin)}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Início</span><span>{formatDate(project.start_date)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Prazo</span><span>{formatDate(project.planned_end_date)}</span></div>
          </CardContent>
        </Card>

        {/* Activity Status Pie */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Status das Atividades</h2></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Team Breakdown */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Horas por Membro</h2></CardHeader>
          <CardContent>
            {flowupCost && flowupCost.by_member.length > 0 ? (
              <>
                <p className="text-xs text-gray-400 mb-2">Apontado (FlowUp) vs Estimado (VOE)</p>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={flowupCost.by_member.map((fm: any) => {
                      const voe = memberData.find((m) => m.name === fm.member_name);
                      return { name: fm.member_name, flowup: fm.worked_hours, estimated: voe?.estimated || 0 };
                    })}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" fontSize={11} width={75} />
                    <Tooltip formatter={(value: any) => [formatHours(Number(value)), undefined]} />
                    <Bar dataKey="estimated" name="Estimado (VOE)" fill="#93c5fd" />
                    <Bar dataKey="flowup" name="Apontado (FlowUp)" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={memberData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" fontSize={11} width={75} />
                  <Tooltip formatter={(value: any) => [formatHours(Number(value)), undefined]} />
                  <Bar dataKey="estimated" name="Estimado (VOE)" fill="#93c5fd" />
                  <Bar dataKey="hours" name="Trabalhado (VOE)" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost by Month Chart */}
      {costByMonth && costByMonth.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Custo por Mês (FlowUp)</h2>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-500">Total acumulado: <span className="font-medium text-gray-800">{formatCurrency(costByMonth.reduce((s, r) => s + r.total_cost, 0))}</span></span>
                <span className="text-gray-500">Horas acumuladas: <span className="font-medium text-gray-800">{formatHours(costByMonth.reduce((s, r) => s + r.total_hours, 0))}</span></span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={costByMonth.map((r: any) => ({ ...r, month: r.month.split('-').reverse().join('/') }))} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis yAxisId="cost" orientation="left" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <YAxis yAxisId="hours" orientation="right" tickFormatter={(v) => `${v}h`} fontSize={11} />
                <Tooltip
                  formatter={(value: any, name: string) =>
                    name === "Custo" ? [formatCurrency(Number(value)), name] : [formatHours(Number(value)), name]
                  }
                />
                <Legend />
                <Bar yAxisId="cost" dataKey="total_cost" name="Custo" fill="#3b82f6" />
                <Bar yAxisId="hours" dataKey="total_hours" name="Horas" fill="#93c5fd" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* FlowUp Cost Card */}
      {flowupCost && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Custo FlowUp</h2>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-500">Total horas: <span className="font-medium text-gray-800">{formatHours(flowupCost.total_hours)}</span></span>
                <span className="text-gray-500">Custo total: <span className="font-medium text-gray-800">{formatCurrency(flowupCost.total_cost)}</span></span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {flowupCost.members_without_rate?.length > 0 && (
              <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                Membros sem taxa cadastrada: {flowupCost.members_without_rate.join(", ")}
              </div>
            )}
            {flowupCost.by_member?.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhuma hora apontada encontrada para este mapeamento.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase">
                    <th className="px-3 py-2 text-left">Membro</th>
                    <th className="px-3 py-2 text-left">Cargo</th>
                    <th className="px-3 py-2 text-right">Horas</th>
                    <th className="px-3 py-2 text-right">Taxa/h</th>
                    <th className="px-3 py-2 text-right">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {flowupCost.by_member.map((m: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-3 py-2 font-medium">{m.member_name}</td>
                      <td className="px-3 py-2 text-gray-500">{m.position_name || "—"}</td>
                      <td className="px-3 py-2 text-right">{formatHours(m.worked_hours)}</td>
                      <td className="px-3 py-2 text-right">{m.hourly_rate != null ? formatCurrency(m.hourly_rate) : <span className="text-yellow-600">—</span>}</td>
                      <td className="px-3 py-2 text-right font-medium">{m.member_cost != null ? formatCurrency(m.member_cost) : <span className="text-yellow-600">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deliverables */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold">Entregas</h2>
            <div className="relative w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar entregas..."
                value={deliverableFilter}
                onChange={(e) => setDeliverableFilter(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(deliverables || []).length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma entrega encontrada</p>
          ) : (() => {
            const filtered = (deliverables || []).filter((d: any) =>
              !deliverableFilter || d.title.toLowerCase().includes(deliverableFilter.toLowerCase())
            );
            return filtered.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhuma entrega corresponde ao filtro.</p>
            ) : (
            <div className="space-y-2">
              {filtered.map((d: any) => {
                const delKey = `del-${d.id}`;
                const isDelOpen = expanded[delKey];
                return (
                  <div key={d.id} className="border-l-4 border-green-500 bg-white rounded-lg overflow-hidden shadow-sm">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-green-50 select-none"
                      onClick={() => toggle(delKey)}
                    >
                      {isDelOpen ? <ChevronDown size={13} className="text-green-600 shrink-0" /> : <ChevronRight size={13} className="text-green-600 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{d.title}</span>
                          <Badge status={d.status} />
                          {d.is_delayed_flag && <Badge status="OVERDUE" label="Atrasado" />}
                        </div>
                        <p className="text-xs text-gray-500">
                          {d.completed_items}/{d.total_items} itens | Prazo: {formatDate(d.deadline)}
                        </p>
                      </div>
                      <div className="w-24 shrink-0">
                        <ProgressBar value={d.completed_items} max={d.total_items || 1} />
                      </div>
                    </div>

                    {isDelOpen && (
                      <div className="px-4 pb-3">
                        {(d.backlog_items || []).length === 0 ? (
                          <p className="text-xs text-gray-300 py-1 text-center">Sem itens de backlog</p>
                        ) : (
                          (d.backlog_items || []).map((item: any) => {
                            const itemKey = `item-${item.id}`;
                            const isItemOpen = expanded[itemKey];
                            return (
                              <div key={item.id} className="border-l-4 border-yellow-400 bg-yellow-50 rounded-lg mb-2 ml-2 overflow-hidden">
                                <div
                                  className="flex items-center gap-3 p-2 cursor-pointer hover:bg-yellow-100 select-none"
                                  onClick={() => toggle(itemKey)}
                                >
                                  {isItemOpen ? <ChevronDown size={12} className="text-yellow-600 shrink-0" /> : <ChevronRight size={12} className="text-yellow-600 shrink-0" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-medium">#{item.code} {item.title}</span>
                                      <Badge status={item.status} />
                                    </div>
                                    <p className="text-xs text-gray-400">
                                      {item.completed_activities}/{item.total_activities} atividades | {formatDate(item.planned_end_date)}
                                    </p>
                                  </div>
                                  <div className="w-16 shrink-0">
                                    <ProgressBar value={item.completed_activities} max={item.total_activities || 1} />
                                  </div>
                                </div>

                                {isItemOpen && (
                                  <div className="px-4 pb-2 space-y-1">
                                    {(item.activities || []).length === 0 ? (
                                      <p className="text-xs text-gray-300 py-1 text-center">Sem atividades</p>
                                    ) : (
                                      (item.activities || []).map((activity: any) => (
                                        <div key={activity.id} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded text-xs border-l-2 border-gray-200">
                                          <span className="flex-1 font-medium truncate">{activity.title}</span>
                                          <Badge status={activity.status} />
                                          <span className="text-gray-400 shrink-0">{activity.member_name || "—"}</span>
                                          <span className="text-gray-400 shrink-0">{formatHours(activity.estimation_hours)}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

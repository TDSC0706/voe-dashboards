"use client";
import { useState, useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatHours } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell,
} from "recharts";

type Tab = "total" | "month" | "week" | "user";

const COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#a855f7",
];

const CHART_HEIGHT = 380;
const USER_CHART_HEIGHT = 300;

const TABS: { id: Tab; label: string }[] = [
  { id: "total",  label: "Total" },
  { id: "month",  label: "Por Mês" },
  { id: "week",   label: "Por Semana" },
  { id: "user",   label: "Usuário Individual" },
];

interface Period { start: string; end: string }

function PeriodFilter({ value, onChange }: {
  value: Period;
  onChange: (v: Period) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-xs text-gray-500 mb-1">De</label>
        <input
          type="date"
          className="border rounded px-3 py-1.5 text-sm bg-white"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Até</label>
        <input
          type="date"
          className="border rounded px-3 py-1.5 text-sm bg-white"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
        />
      </div>
    </>
  );
}

function MemberFilter({ members, value, onChange, label = "Membro" }: {
  members: any[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        className="border rounded px-3 py-1.5 text-sm bg-white min-w-[220px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todos os membros</option>
        {members.map((m: any) => (
          <option key={m.id} value={m.id}>{m.full_name}</option>
        ))}
      </select>
    </div>
  );
}

function TotalHours({ value }: { value: number }) {
  return (
    <div className="ml-auto text-right">
      <p className="text-xs text-gray-500">Total de horas</p>
      <p className="text-2xl font-bold text-blue-600">{formatHours(value)}</p>
    </div>
  );
}

// ── Tab: Total ────────────────────────────────────────────────────────────────
function TotalTab({ members }: { members: any[] }) {
  const [member, setMember] = useState("");
  const [period, setPeriod] = useState<Period>({ start: "", end: "" });

  const { data, loading, error } = useApi(
    () => api.userHours(member ? Number(member) : undefined, "none", period.start || undefined, period.end || undefined),
    [member, period.start, period.end],
  );

  const rows: any[] = useMemo(() => (data as any[]) || [], [data]);

  const chartData = useMemo(() => {
    const key = member ? "project_title" : "member_name";
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r[key], (map.get(r[key]) || 0) + Number(r.total_hours)));
    return Array.from(map.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours);
  }, [rows, member]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.total_hours), 0), [rows]);

  return (
    <>
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 py-2">
            <MemberFilter members={members} value={member} onChange={setMember} />
            <PeriodFilter value={period} onChange={setPeriod} />
            <TotalHours value={total} />
          </div>
        </CardContent>
      </Card>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">
              {member ? "Horas por Projeto" : "Horas por Membro"}
            </h2>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 160, right: 24, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${Number(v).toFixed(0)}h`} />
                  <YAxis dataKey="name" type="category" fontSize={11} width={155} />
                  <Tooltip formatter={(v: any) => [formatHours(Number(v)), "Horas"]} />
                  <Bar dataKey="hours" name="Horas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Tab: Por Mês ──────────────────────────────────────────────────────────────
function MonthTab({ members }: { members: any[] }) {
  const [member, setMember] = useState("");
  const [period, setPeriod] = useState<Period>({ start: "", end: "" });

  const { data, loading, error } = useApi(
    () => api.userHours(member ? Number(member) : undefined, "month", period.start || undefined, period.end || undefined),
    [member, period.start, period.end],
  );

  const rows: any[] = useMemo(() => (data as any[]) || [], [data]);

  const { chartData, barKeys } = useMemo(() => {
    const key = member ? "project_title" : "member_name";
    const keys = Array.from(new Set(rows.map((r) => r[key] as string)));
    const periodMap = new Map<string, any>();
    rows.forEach((r) => {
      if (!periodMap.has(r.period)) periodMap.set(r.period, { period: r.period });
      const entry = periodMap.get(r.period);
      entry[r[key]] = (entry[r[key]] || 0) + Number(r.total_hours);
    });
    // Sort by period (MM/YYYY → sortable)
    const sorted = Array.from(periodMap.values()).sort((a, b) => {
      const [am, ay] = a.period.split("/");
      const [bm, by] = b.period.split("/");
      return Number(ay) - Number(by) || Number(am) - Number(bm);
    });
    return { chartData: sorted, barKeys: keys };
  }, [rows, member]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.total_hours), 0), [rows]);

  return (
    <>
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 py-2">
            <MemberFilter members={members} value={member} onChange={setMember} />
            <PeriodFilter value={period} onChange={setPeriod} />
            <TotalHours value={total} />
          </div>
        </CardContent>
      </Card>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Horas por Mês</h2>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart
                  data={chartData}
                  margin={{ bottom: 60, right: 24, top: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    fontSize={11}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}h`} width={48} />
                  <Tooltip formatter={(v: any) => [formatHours(Number(v)), undefined]} />
                  <Legend wrapperStyle={{ paddingTop: 8 }} />
                  {barKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Tab: Por Semana ───────────────────────────────────────────────────────────
function WeekTab({ members }: { members: any[] }) {
  const [member, setMember] = useState("");
  const [period, setPeriod] = useState<Period>({ start: "", end: "" });

  const { data, loading, error } = useApi(
    () => api.userHours(member ? Number(member) : undefined, "week", period.start || undefined, period.end || undefined),
    [member, period.start, period.end],
  );

  const rows: any[] = useMemo(() => (data as any[]) || [], [data]);

  const { chartData, barKeys } = useMemo(() => {
    const key = member ? "project_title" : "member_name";
    const keys = Array.from(new Set(rows.map((r) => r[key] as string)));
    const periodMap = new Map<string, any>();
    rows.forEach((r) => {
      if (!periodMap.has(r.period)) periodMap.set(r.period, { period: r.period });
      const entry = periodMap.get(r.period);
      entry[r[key]] = (entry[r[key]] || 0) + Number(r.total_hours);
    });
    return { chartData: Array.from(periodMap.values()), barKeys: keys };
  }, [rows, member]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.total_hours), 0), [rows]);

  return (
    <>
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 py-2">
            <MemberFilter members={members} value={member} onChange={setMember} />
            <PeriodFilter value={period} onChange={setPeriod} />
            <TotalHours value={total} />
          </div>
        </CardContent>
      </Card>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Horas por Semana</h2>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart
                  data={chartData}
                  margin={{ bottom: 60, right: 24, top: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    fontSize={11}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}h`} width={48} />
                  <Tooltip formatter={(v: any) => [formatHours(Number(v)), undefined]} />
                  <Legend wrapperStyle={{ paddingTop: 8 }} />
                  {barKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Tab: Usuário Individual ───────────────────────────────────────────────────
const RADIAN = Math.PI / 180;
function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

function UserTab({ members }: { members: any[] }) {
  const [selectedUser, setSelectedUser] = useState("");
  const [period, setPeriod] = useState<Period>({ start: "", end: "" });

  const uid = selectedUser ? Number(selectedUser) : undefined;
  const sd = period.start || undefined;
  const ed = period.end || undefined;

  const { data: noneData, loading: l1, error: e1 } = useApi(
    () => uid ? api.userHours(uid, "none", sd, ed) : Promise.resolve([]),
    [selectedUser, period.start, period.end],
  );
  const { data: weekData, loading: l2, error: e2 } = useApi(
    () => uid ? api.userHours(uid, "week", sd, ed) : Promise.resolve([]),
    [selectedUser, period.start, period.end],
  );
  const { data: monthData, loading: l3, error: e3 } = useApi(
    () => uid ? api.userHours(uid, "month", sd, ed) : Promise.resolve([]),
    [selectedUser, period.start, period.end],
  );

  const loading = l1 || l2 || l3;
  const error = e1 || e2 || e3;

  // Donut: hours by project
  const donutData = useMemo(() => {
    const map = new Map<string, number>();
    ((noneData as any[]) || []).forEach((r) =>
      map.set(r.project_title, (map.get(r.project_title) || 0) + Number(r.total_hours))
    );
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [noneData]);

  // Weekly: total hours per week
  const weeklyData = useMemo(() => {
    const map = new Map<string, number>();
    ((weekData as any[]) || []).forEach((r) =>
      map.set(r.period, (map.get(r.period) || 0) + Number(r.total_hours))
    );
    return Array.from(map.entries()).map(([period, hours]) => ({ period, hours }));
  }, [weekData]);

  // Monthly: total hours per month, sorted
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    ((monthData as any[]) || []).forEach((r) =>
      map.set(r.period, (map.get(r.period) || 0) + Number(r.total_hours))
    );
    return Array.from(map.entries())
      .map(([period, hours]) => ({ period, hours }))
      .sort((a, b) => {
        const [am, ay] = a.period.split("/");
        const [bm, by] = b.period.split("/");
        return Number(ay) - Number(by) || Number(am) - Number(bm);
      });
  }, [monthData]);

  const total = useMemo(
    () => donutData.reduce((s, r) => s + r.value, 0),
    [donutData],
  );

  return (
    <>
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 py-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Usuário</label>
              <select
                className="border rounded px-3 py-1.5 text-sm bg-white min-w-[220px]"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">Selecione um usuário…</option>
                {members.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
            <PeriodFilter value={period} onChange={setPeriod} />
            {selectedUser && <TotalHours value={total} />}
          </div>
        </CardContent>
      </Card>

      {!selectedUser && (
        <Card>
          <CardContent>
            <p className="text-gray-400 text-sm text-center py-12">
              Selecione um usuário para visualizar os gráficos.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedUser && loading && <Loader />}
      {selectedUser && error && <ErrorMessage message={error} />}

      {selectedUser && !loading && !error && (
        <div className="grid grid-cols-3 gap-4">
          {/* Donut: horas por projeto */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Horas por Projeto</h2>
            </CardHeader>
            <CardContent>
              {donutData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={USER_CHART_HEIGHT}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="80%"
                        dataKey="value"
                        labelLine={false}
                        label={DonutLabel}
                      >
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [formatHours(Number(v)), "Horas"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-col gap-1">
                    {donutData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs text-gray-600">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <span className="truncate flex-1" title={d.name}>{d.name}</span>
                        <span className="font-mono shrink-0">{formatHours(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyChart />
              )}
            </CardContent>
          </Card>

          {/* Horas por Semana */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Horas por Semana</h2>
            </CardHeader>
            <CardContent>
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={USER_CHART_HEIGHT}>
                  <BarChart
                    data={weeklyData}
                    margin={{ bottom: 48, right: 8, top: 8, left: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      fontSize={10}
                      angle={-40}
                      textAnchor="end"
                      interval={0}
                      height={56}
                    />
                    <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}h`} width={40} fontSize={10} />
                    <Tooltip formatter={(v: any) => [formatHours(Number(v)), "Horas"]} />
                    <Bar dataKey="hours" name="Horas" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </CardContent>
          </Card>

          {/* Horas por Mês */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Horas por Mês</h2>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={USER_CHART_HEIGHT}>
                  <BarChart
                    data={monthlyData}
                    margin={{ bottom: 48, right: 8, top: 8, left: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      fontSize={10}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={56}
                    />
                    <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}h`} width={40} fontSize={10} />
                    <Tooltip formatter={(v: any) => [formatHours(Number(v)), "Horas"]} />
                    <Bar dataKey="hours" name="Horas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function EmptyChart() {
  return (
    <p className="text-gray-400 text-sm text-center py-12">
      Sem dados para exibir. Verifique os mapeamentos de usuário e a sincronização do FlowUp.
    </p>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UserHoursPage() {
  const [activeTab, setActiveTab] = useState<Tab>("total");
  const { data: members } = useApi(() => api.teamAll());
  const memberList: any[] = (members as any[]) || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Horas por Usuário</h1>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "total" && <TotalTab members={memberList} />}
      {activeTab === "month" && <MonthTab members={memberList} />}
      {activeTab === "week"  && <WeekTab  members={memberList} />}
      {activeTab === "user"  && <UserTab  members={memberList} />}
    </div>
  );
}

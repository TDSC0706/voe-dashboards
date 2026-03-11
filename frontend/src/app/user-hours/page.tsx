"use client";
import { useState, useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatHours } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type GroupBy = "none" | "month" | "week";

const COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#a855f7",
];

export default function UserHoursPage() {
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const { data: members } = useApi(() => api.teamAll());
  const { data: hours, loading, error } = useApi(
    () => api.userHours(selectedMember ? Number(selectedMember) : undefined, groupBy),
    [selectedMember, groupBy],
  );

  const rows: any[] = useMemo(() => (hours as any[]) || [], [hours]);

  const totalHours = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.total_hours), 0),
    [rows],
  );

  // Keys for multi-bar chart (by project or by member depending on context)
  const barKeys = useMemo(() => {
    if (groupBy === "none") return [];
    const key = selectedMember ? "project_title" : "member_name";
    return Array.from(new Set(rows.map((r) => r[key] as string)));
  }, [rows, groupBy, selectedMember]);

  const chartData = useMemo(() => {
    if (groupBy === "none") {
      // Sum by project (member selected) or by member (all)
      const groupKey = selectedMember ? "project_title" : "member_name";
      const map = new Map<string, number>();
      rows.forEach((r) => {
        map.set(r[groupKey], (map.get(r[groupKey]) || 0) + Number(r.total_hours));
      });
      return Array.from(map.entries())
        .map(([name, h]) => ({ name, hours: h }))
        .sort((a, b) => b.hours - a.hours);
    }
    // Pivot by period
    const periodMap = new Map<string, any>();
    rows.forEach((r) => {
      if (!periodMap.has(r.period)) {
        periodMap.set(r.period, { period: r.period });
      }
      const entry = periodMap.get(r.period);
      const key = selectedMember ? r.project_title : r.member_name;
      entry[key] = (entry[key] || 0) + Number(r.total_hours);
    });
    return Array.from(periodMap.values());
  }, [rows, groupBy, selectedMember]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Horas por Usuário</h1>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 py-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Membro</label>
              <select
                className="border rounded px-3 py-1.5 text-sm bg-white min-w-[220px]"
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
              >
                <option value="">Todos os membros</option>
                {((members as any[]) || []).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Agrupar por</label>
              <div className="flex border rounded overflow-hidden text-sm">
                {(["none", "month", "week"] as GroupBy[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-3 py-1.5 transition-colors ${
                      groupBy === g
                        ? "bg-blue-600 text-white font-medium"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {g === "none" ? "Total" : g === "month" ? "Por Mês" : "Por Semana"}
                  </button>
                ))}
              </div>
            </div>

            <div className="ml-auto text-right">
              <p className="text-xs text-gray-500">Total de horas</p>
              <p className="text-2xl font-bold text-blue-600">{formatHours(totalHours)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          {/* Chart */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">
                {groupBy === "none"
                  ? selectedMember
                    ? "Horas por Projeto"
                    : "Horas por Membro"
                  : groupBy === "month"
                  ? "Horas por Mês"
                  : "Horas por Semana"}
              </h2>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                groupBy === "none" ? (
                  <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 36)}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 160 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `${Number(v).toFixed(0)}h`} />
                      <YAxis dataKey="name" type="category" fontSize={11} width={155} />
                      <Tooltip formatter={(v: any) => [formatHours(Number(v)), "Horas"]} />
                      <Bar dataKey="hours" name="Horas" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
                    <BarChart data={chartData} margin={{ bottom: 70 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="period"
                        fontSize={11}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={75}
                      />
                      <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}h`} />
                      <Tooltip formatter={(v: any) => [formatHours(Number(v)), undefined]} />
                      <Legend />
                      {barKeys.map((key, i) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="a"
                          fill={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">
                  Sem dados. Verifique os mapeamentos de usuário e a sincronização do FlowUp.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          {rows.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold">Detalhamento</h2>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-500 uppercase">
                      {!selectedMember && (
                        <th className="px-3 py-2 text-left">Membro</th>
                      )}
                      <th className="px-3 py-2 text-left">Projeto</th>
                      {groupBy !== "none" && (
                        <th className="px-3 py-2 text-left">Período</th>
                      )}
                      <th className="px-3 py-2 text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        {!selectedMember && (
                          <td className="px-3 py-2 font-medium">{r.member_name}</td>
                        )}
                        <td className="px-3 py-2">{r.project_title}</td>
                        {groupBy !== "none" && (
                          <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                            {r.period}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right font-mono">
                          {formatHours(Number(r.total_hours))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

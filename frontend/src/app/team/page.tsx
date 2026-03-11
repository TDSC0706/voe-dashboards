"use client";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { KPICard } from "@/components/ui/KPICard";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatNumber } from "@/lib/utils";
import { Users, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export default function TeamPage() {
  const { data, loading, error } = useApi(() => api.team());

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const overloaded = data.filter((m: any) => m.overload_flag !== "OK");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Equipe</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Membros Ativos" value={data.length} icon={Users} />
        <KPICard title="Sobrecarregados" value={overloaded.length} icon={AlertTriangle}
          color={overloaded.length > 0 ? "text-red-600" : "text-green-600"} />
        <KPICard title="Utilização Média" icon={Users}
          value={`${formatNumber(data.reduce((s: number, m: any) => s + (m.utilization_pct || 0), 0) / Math.max(data.length, 1), 0)}%`} />
      </div>

      {/* Capacity Chart */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Capacidade por Membro</h2></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(300, data.length * 35)}>
            <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" label={{ value: "Utilização (%)", position: "bottom", fontSize: 12 }} />
              <YAxis dataKey="full_name" type="category" fontSize={11} width={115} />
              <Tooltip formatter={(v: any) => `${formatNumber(v, 0)}%`} />
              <Bar dataKey="utilization_pct" name="Utilização">
                {data.map((m: any, i: number) => (
                  <Cell key={i} fill={
                    m.overload_flag === "CRITICAL" ? "#ef4444" :
                    m.overload_flag === "OVERLOADED" ? "#eab308" : "#22c55e"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Member Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((m: any) => (
          <Card key={m.team_member_id}>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{m.full_name || m.name}</span>
                <Badge status={m.overload_flag} />
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Atividades Ativas</span><span className="font-medium text-gray-700">{m.active_activities}</span>
                </div>
                <div className="flex justify-between">
                  <span>Horas Pendentes</span><span className="font-medium text-gray-700">{formatNumber(m.pending_hours, 1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Capacidade Semanal</span><span className="font-medium text-gray-700">{m.weekly_capacity}h</span>
                </div>
                <div className="flex justify-between">
                  <span>Utilização</span>
                  <span className={`font-bold ${m.utilization_pct > 150 ? "text-red-600" : m.utilization_pct > 100 ? "text-yellow-600" : "text-green-600"}`}>
                    {formatNumber(m.utilization_pct, 0)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

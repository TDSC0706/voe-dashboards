"use client";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { KPICard } from "@/components/ui/KPICard";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatDate, formatNumber, formatHours } from "@/lib/utils";
import { IterationCcw, Clock, CheckCircle, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";

export default function IterationDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const iid = parseInt(id);
  const { data: iteration, loading, error } = useApi(() => api.iteration(iid), [iid]);
  const { data: burndown } = useApi(() => api.iterationBurndown(iid), [iid]);
  const { data: forecast } = useApi(() => api.iterationForecast(iid), [iid]);
  const { data: activities } = useApi(() => api.iterationActivities(iid), [iid]);

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (iteration?.error) return <ErrorMessage message="Iteração não encontrada" />;
  if (!iteration) return null;

  const health = iteration.health_status ?? null;

  const healthLabel: Record<string, string> = {
    ON_TRACK: "No Prazo",
    AT_RISK: "Em Risco",
    OVERDUE: "Atrasado",
    COMPLETED: "Concluído",
    CANCELED: "Cancelado",
  };

  // Activity kanban groups
  const groups: Record<string, any[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
  (activities || []).forEach((a: any) => {
    if (["COMPLETED"].includes(a.status)) groups.DONE.push(a);
    else if (["ONGOING", "IN_PROGRESS"].includes(a.status)) groups.IN_PROGRESS.push(a);
    else groups.TODO.push(a);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{iteration.code}</h1>
        <Badge status={iteration.status} />
        {health && <Badge status={health} label={healthLabel[health]} />}
      </div>
      <p className="text-sm text-gray-500">{iteration.product_title} | {iteration.goal || "—"}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Progresso" value={`${formatNumber(iteration.completion_pct, 0)}%`} icon={IterationCcw} />
        <KPICard title="Horas Gastas" value={formatHours(iteration.hours_spent)} icon={Clock} />
        <KPICard title="Dias Restantes" value={formatNumber(iteration.days_remaining, 0)} icon={TrendingUp}
          color={iteration.days_remaining <= 2 ? "text-red-600" : "text-brand-600"} />
        <KPICard title="Previsão" icon={CheckCircle}
          value={forecast?.on_track ? "No prazo" : forecast?.days_remaining === 0 ? "Atrasado" : "Em risco"}
          color={forecast?.on_track ? "text-green-600" : forecast?.days_remaining === 0 ? "text-red-600" : "text-yellow-600"}
          subtitle={forecast?.days_needed ? `${forecast.days_needed}d necessários` : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Burndown Chart */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Horas Acumuladas vs Estimativa</h2></CardHeader>
          <CardContent>
            {(burndown || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={burndown || []} margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="work_date" fontSize={11} tickFormatter={(d: string) => { const [,m,day] = d.split("-"); return `${day}/${m}`; }} label={{ value: "Data", position: "insideBottom", offset: -10 }} />
                  <YAxis label={{ value: "Horas", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value: any) => [formatHours(Number(value)), undefined]} />
                  <Legend verticalAlign="top" />
                  <Line type="monotone" dataKey="cumulative_hours" name="Horas Acumuladas" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="total_estimated" name="Total Estimado" stroke="#ef4444" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">Sem dados de burndown</p>
            )}
          </CardContent>
        </Card>

        {/* Forecast */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Previsão de Conclusão</h2></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {forecast && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">Período</span><span>{formatDate(forecast.start_date)} — {formatDate(forecast.end_date)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Dias Decorridos</span><span>{formatNumber(forecast.elapsed_days, 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Dias Restantes</span><span>{formatNumber(forecast.days_remaining, 0)}</span></div>
                <hr />
                <div className="flex justify-between"><span className="text-gray-500">Horas Concluídas</span><span>{formatHours(forecast.completed_hours)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Horas Restantes</span><span>{formatHours(forecast.remaining_hours)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Velocidade Diária</span><span>{formatNumber(forecast.daily_velocity, 2)}h/dia</span></div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-gray-500">Dias Necessários</span>
                  <span className="font-bold">{forecast.days_needed ?? "∞"}</span>
                </div>
                <div className={`text-center py-3 rounded-lg text-lg font-bold ${forecast.on_track ? "bg-green-50 text-green-700" : forecast.days_remaining === 0 ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                  {forecast.on_track ? "No Prazo" : forecast.days_remaining === 0 ? "Atrasado" : "Em Risco de Atraso"}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Kanban */}
      {(() => {
        const columnStyle: Record<string, { border: string; header: string; cardBorder: string }> = {
          TODO:        { border: "border-l-4 border-blue-400",   header: "text-blue-600",   cardBorder: "border-l-2 border-blue-300" },
          IN_PROGRESS: { border: "border-l-4 border-orange-400", header: "text-orange-600", cardBorder: "border-l-2 border-orange-300" },
          DONE:        { border: "border-l-4 border-green-400",  header: "text-green-600",  cardBorder: "border-l-2 border-green-300" },
        };
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["TODO", "IN_PROGRESS", "DONE"] as const).map((group) => (
              <Card key={group} className={columnStyle[group].border}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h2 className={`text-sm font-semibold ${columnStyle[group].header}`}>
                      {group === "TODO" ? "A Fazer" : group === "IN_PROGRESS" ? "Em Progresso" : "Concluído"}
                    </h2>
                    <span className="text-xs text-gray-400">{groups[group].length}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {groups[group].map((a: any) => (
                    <div key={a.id} className={`p-2 bg-gray-50 rounded text-xs ${columnStyle[group].cardBorder}`}>
                      <p className="font-medium">{a.activity_title}</p>
                      {a.project_name && <p className="text-gray-400 truncate">{a.project_name}</p>}
                      <div className="flex justify-between items-center mt-0.5">
                        <p className="text-gray-400">{a.member_name || "—"} | {a.domain || "—"}</p>
                        <p className="text-gray-500 font-mono">{formatHours(a.activity_total_hours ?? 0)}</p>
                      </div>
                    </div>
                  ))}
                  {groups[group].length === 0 && <p className="text-gray-300 text-xs text-center py-4">Vazio</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}

    </div>
  );
}

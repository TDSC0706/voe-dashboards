"use client";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, Clock, Circle, TrendingUp, FolderKanban, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

const healthLabel: Record<string, string> = {
  ON_TRACK: "No Prazo",
  AT_RISK: "Em Risco",
  OVERDUE: "Atrasado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};

const healthColor: Record<string, string> = {
  ON_TRACK: "bg-green-100 text-green-700 border-green-200",
  AT_RISK: "bg-yellow-100 text-yellow-700 border-yellow-200",
  OVERDUE: "bg-red-100 text-red-700 border-red-200",
  COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELED: "bg-gray-100 text-gray-500 border-gray-200",
};

const healthBorder: Record<string, string> = {
  ON_TRACK: "border-l-green-400",
  AT_RISK: "border-l-yellow-400",
  OVERDUE: "border-l-red-400",
  COMPLETED: "border-l-emerald-400",
  CANCELED: "border-l-gray-300",
};

function IterationActivities({ id }: { id: number }) {
  const { data: activities, loading } = useApi(() => api.iterationActivities(id), [id]);

  if (loading) return <p className="text-xs text-gray-400 py-3 text-center">Carregando atividades...</p>;

  const groups: Record<string, any[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
  (activities || []).forEach((a: any) => {
    if (["COMPLETED"].includes(a.status)) groups.DONE.push(a);
    else if (["ONGOING", "IN_PROGRESS"].includes(a.status)) groups.IN_PROGRESS.push(a);
    else groups.TODO.push(a);
  });

  const columnStyle = {
    TODO:        { header: "text-blue-600",   cardBorder: "border-l-2 border-blue-300" },
    IN_PROGRESS: { header: "text-orange-600", cardBorder: "border-l-2 border-orange-300" },
    DONE:        { header: "text-green-600",  cardBorder: "border-l-2 border-green-300" },
  };
  const columnLabel = { TODO: "A Fazer", IN_PROGRESS: "Em Progresso", DONE: "Concluído" };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
      {(["TODO", "IN_PROGRESS", "DONE"] as const).map((group) => (
        <div key={group}>
          <p className={`text-xs font-semibold mb-2 ${columnStyle[group].header}`}>
            {columnLabel[group]}{" "}
            <span className="text-gray-400 font-normal">({groups[group].length})</span>
          </p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {groups[group].map((a: any) => (
              <div key={a.id} className={`p-2 bg-gray-50 rounded text-xs ${columnStyle[group].cardBorder}`}>
                <p className="font-medium text-gray-800 leading-snug">{a.activity_title}</p>
                <div className="flex justify-between items-center mt-0.5 text-gray-400">
                  <span>{a.member_name || "—"}{a.domain ? ` · ${a.domain}` : ""}</span>
                  <span className="font-mono">{a.activity_total_hours ? `${Number(a.activity_total_hours).toFixed(1)}h` : "—"}</span>
                </div>
              </div>
            ))}
            {groups[group].length === 0 && (
              <p className="text-gray-300 text-xs text-center py-2">Vazio</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ClientPage() {
  const { user } = useAuth();
  const { data, loading, error } = useApi(() => api.clientOverview());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const { customer_name, summary, iterations } = data;
  const title = customer_name || "Todos os Projetos";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">Acompanhamento de Sprints em Andamento</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 rounded-lg">
                <FolderKanban size={20} className="text-brand-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.active_iterations}</p>
                <p className="text-xs text-gray-500 mt-0.5">Sprints Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <ShieldCheck size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.on_track}</p>
                <p className="text-xs text-gray-500 mt-0.5">No Prazo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <TrendingUp size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.avg_completion_pct}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Progresso Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sprint cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Sprint Progress
        </h2>

        {iterations.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400 text-sm">
              Nenhuma iteração em andamento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {iterations.map((iter: any) => {
              const health = iter.health_status || "ON_TRACK";
              const pct = Math.round(Number(iter.completion_pct) || 0);
              const todo = Number(iter.todo_count) || 0;
              const inProgress = Number(iter.in_progress_count) || 0;
              const done = Number(iter.done_count) || 0;
              const total = todo + inProgress + done;

              return (
                <div
                  key={iter.iteration_id}
                  className={`bg-white border border-gray-200 border-l-4 rounded-lg shadow-sm p-4 ${healthBorder[health] || "border-l-gray-200"}`}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {iter.project_title || iter.product_title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {iter.code}
                        {iter.start_date && iter.end_date && (
                          <span className="ml-2">
                            · {formatDate(iter.start_date)} – {formatDate(iter.end_date)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${healthColor[health] || "bg-gray-100 text-gray-600 border-gray-200"}`}
                      >
                        {health === "OVERDUE" && <AlertTriangle size={11} className="mr-1" />}
                        {healthLabel[health] || health}
                      </span>
                      <span className="text-sm font-bold text-gray-700">{pct}%</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <ProgressBar value={pct} className="mb-3" />

                  {/* Activity counts */}
                  {total > 0 && (
                    <div className="flex items-center gap-5 text-xs text-gray-600 mt-2">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span className="font-medium text-gray-800">{done}</span>
                        {" "}concluídas
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-blue-500" />
                        <span className="font-medium text-gray-800">{inProgress}</span>
                        {" "}em andamento
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Circle size={13} className="text-gray-400" />
                        <span className="font-medium text-gray-800">{todo}</span>
                        {" "}a fazer
                      </span>
                      {iter.days_remaining != null && Number(iter.days_remaining) > 0 && (
                        <span className="ml-auto text-gray-400">
                          {Math.round(Number(iter.days_remaining))} dia(s) restante(s)
                        </span>
                      )}
                    </div>
                  )}
                  {/* Toggle button */}
                  <button
                    onClick={() => setExpandedId(expandedId === iter.iteration_id ? null : iter.iteration_id)}
                    className="mt-3 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
                  >
                    {expandedId === iter.iteration_id ? (
                      <><ChevronUp size={13} /> Ocultar atividades</>
                    ) : (
                      <><ChevronDown size={13} /> Ver atividades</>
                    )}
                  </button>

                  {/* Expandable Kanban */}
                  {expandedId === iter.iteration_id && (
                    <IterationActivities id={iter.iteration_id} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

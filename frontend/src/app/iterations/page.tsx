"use client";
import { useState, useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatDate, formatNumber } from "@/lib/utils";
import Link from "next/link";

type SortKey = "code" | "product_title" | "status" | "start_date" | "completion_pct";

const healthLabel: Record<string, string> = {
  ON_TRACK: "No Prazo",
  AT_RISK: "Em Risco",
  OVERDUE: "Atrasado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="ml-1 inline-block opacity-50" style={{ opacity: active ? 1 : 0.35 }}>
      {active && dir === "desc" ? "↓" : "↑"}
    </span>
  );
}

export default function IterationsPage() {
  const { data, loading, error } = useApi(() => api.iterations());

  const [filterCode, setFilterCode] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("start_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const allIterations = data || [];

  const statusOptions = useMemo(() => {
    const set = new Set<string>(allIterations.map((i: any) => i.status));
    return Array.from(set).sort();
  }, [allIterations]);

  const filtered = useMemo(() => {
    return allIterations.filter((i: any) => {
      const matchCode = !filterCode || i.code?.toLowerCase().includes(filterCode.toLowerCase());
      const matchProduct = !filterProduct || i.product_title?.toLowerCase().includes(filterProduct.toLowerCase());
      const matchStatus = !filterStatus || i.status === filterStatus;
      return matchCode && matchProduct && matchStatus;
    });
  }, [allIterations, filterCode, filterProduct, filterStatus]);

  const ongoing = filtered.filter((i: any) => i.status === "ONGOING");

  const others = useMemo(() => {
    const nonOngoing = filtered.filter((i: any) => i.status !== "ONGOING");
    return [...nonOngoing].sort((a: any, b: any) => {
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Iterações</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filtrar por código..."
          value={filterCode}
          onChange={e => setFilterCode(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
        />
        <input
          type="text"
          placeholder="Filtrar por produto..."
          value={filterProduct}
          onChange={e => setFilterProduct(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-52"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-44 bg-white"
        >
          <option value="">Todos os status</option>
          {statusOptions.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        {(filterCode || filterProduct || filterStatus) && (
          <button
            onClick={() => { setFilterCode(""); setFilterProduct(""); setFilterStatus(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {ongoing.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Em Andamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ongoing.map((it: any) => (
              <Link key={it.iteration_id} href={`/iterations/${it.iteration_id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{it.code}</span>
                      <Badge status={it.health_status} label={healthLabel[it.health_status]} />
                    </div>
                    <p className="text-xs text-gray-500">{it.product_title} | {it.goal || "—"}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar value={it.completion_pct} />
                      </div>
                      <span className="text-sm font-medium">{formatNumber(it.completion_pct, 0)}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{formatDate(it.start_date)} — {formatDate(it.end_date)}</span>
                      <span>{formatNumber(it.days_remaining, 0)}d restantes</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>{it.completed_activities}/{it.total_activities} atividades</span>
                      <span>{formatNumber(it.hours_spent, 1)}h gastas</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Outras Iterações</h2></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase">
                  {(
                    [
                      { key: "code", label: "Código", align: "left" },
                      { key: "product_title", label: "Produto", align: "left" },
                      { key: "status", label: "Status", align: "left" },
                      { key: "start_date", label: "Período", align: "left" },
                      { key: "completion_pct", label: "Progresso", align: "right" },
                    ] as { key: SortKey; label: string; align: string }[]
                  ).map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-${col.align} cursor-pointer select-none hover:text-gray-800`}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {others.map((it: any) => (
                  <tr key={it.iteration_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/iterations/${it.iteration_id}`} className="text-brand-600 hover:underline">
                        {it.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{it.product_title}</td>
                    <td className="px-3 py-2 flex gap-1">
                      <Badge status={it.status} />
                      {it.health_status && <Badge status={it.health_status} label={healthLabel[it.health_status]} />}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{formatDate(it.start_date)} — {formatDate(it.end_date)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(it.completion_pct, 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && allIterations.length > 0 && (
        <p className="text-sm text-gray-400 text-center py-8">Nenhuma iteração encontrada com os filtros aplicados.</p>
      )}
    </div>
  );
}

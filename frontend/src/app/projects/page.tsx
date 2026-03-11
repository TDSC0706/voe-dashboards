"use client";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState, useMemo } from "react";

const columns: ColumnDef<any, any>[] = [
  {
    accessorKey: "title",
    header: "Projeto",
    cell: ({ row }) => (
      <Link href={`/projects/${row.original.id}`} className="text-brand-600 hover:underline font-medium">
        {row.original.title}
      </Link>
    ),
  },
  { accessorKey: "customer_name", header: "Cliente" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <Badge status={getValue()} />,
  },
  { accessorKey: "project_type", header: "Tipo" },
  { accessorKey: "category", header: "Categoria" },
  {
    accessorKey: "is_delayed",
    header: "Atrasado",
    cell: ({ getValue }) => getValue() ? <Badge status="OVERDUE" label="Sim" /> : <span className="text-gray-400">Não</span>,
  },
  {
    accessorKey: "selling_price",
    header: "Preço Venda",
    cell: ({ getValue }) => formatCurrency(getValue()),
  },
  {
    accessorKey: "flowup_total_cost",
    header: "Custo",
    cell: ({ getValue }) => formatCurrency(getValue()),
  },
  {
    accessorKey: "flowup_balance",
    header: "Saldo",
    cell: ({ getValue }) => {
      const v = getValue();
      const formatted = formatCurrency(v);
      return <span className={v < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>{formatted}</span>;
    },
  },
];

const SELECT_CLS = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white";

export default function ProjectsPage() {
  const { data, loading, error } = useApi(() => api.projects());
  const [search, setSearch] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");

  const projects = data || [];

  const clients = useMemo(() => Array.from(new Set(projects.map((p: any) => p.customer_name).filter(Boolean))).sort(), [projects]);
  const statuses = useMemo(() => Array.from(new Set(projects.map((p: any) => p.status).filter(Boolean))).sort(), [projects]);
  const types = useMemo(() => Array.from(new Set(projects.map((p: any) => p.project_type).filter(Boolean))).sort(), [projects]);
  const categories = useMemo(() => Array.from(new Set(projects.map((p: any) => p.category).filter(Boolean))).sort(), [projects]);

  const filtered = useMemo(() =>
    projects
      .filter((p: any) =>
        (!client || p.customer_name === client) &&
        (!status || p.status === status) &&
        (!type || p.project_type === type) &&
        (!category || p.category === category)
      )
      .sort((a: any, b: any) => (a.title || "").localeCompare(b.title || "")),
    [projects, client, status, type, category]);

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Projetos</h1>
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar projetos..."
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select value={client} onChange={(e) => setClient(e.target.value)} className={SELECT_CLS}>
              <option value="">Todos os clientes</option>
              {clients.map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT_CLS}>
              <option value="">Todos os status</option>
              {statuses.map((s: any) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className={SELECT_CLS}>
              <option value="">Todos os tipos</option>
              {types.map((t: any) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT_CLS}>
              <option value="">Todas as categorias</option>
              {categories.map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <DataTable data={filtered} columns={columns} globalFilter={search} onGlobalFilterChange={setSearch} />
        </CardContent>
      </Card>
    </div>
  );
}

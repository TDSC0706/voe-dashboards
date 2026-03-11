"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Edit, Trash2, DollarSign, TrendingDown, CheckCircle } from "lucide-react";
import Link from "next/link";

function ConsumeBar({ pct }: { pct: number }) {
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function MonthLabel({ year, month }: { year: number; month: number }) {
  return <span>{MONTH_NAMES[month - 1]}/{String(year).slice(2)}</span>;
}

function CurrencyCell({ value, dim }: { value: number | null | undefined; dim?: boolean }) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
  return (
    <span className={dim ? "text-gray-400" : "text-gray-900"}>
      {formatCurrency(value)}
    </span>
  );
}

export default function PedidoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [expandedMatrix, setExpandedMatrix] = useState(true);

  const { data: pedido, loading: l1, error: e1 } = useApi(() => api.pedido(orderId));
  const { data: projects, loading: l2, error: e2 } = useApi(() => api.pedidoProjects(orderId));
  const { data: matrix, loading: l3 } = useApi(() => api.pedidoMatrix(orderId));

  const loading = l1 || l2 || l3;
  const error = e1 || e2;

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!pedido) return null;

  const totalValue = Number(pedido.total_value) || 0;
  const totalConsumed = (projects || []).reduce((s: number, p: any) => s + Number(p.consumed || 0), 0);
  const totalAvailable = totalValue - totalConsumed;
  const consumedPct = totalValue > 0 ? Math.min(100, (totalConsumed / totalValue) * 100) : 0;

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;
    setDeleting(true);
    await api.deletePedido(orderId);
    router.push("/pedidos");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/pedidos" className="text-gray-400 hover:text-gray-600 shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{pedido.name}</h1>
              <Badge status={pedido.status} />
            </div>
            {pedido.description && (
              <p className="text-sm text-gray-500 mt-0.5">{pedido.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/pedidos/${orderId}/edit`}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} />
            Editar
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 size={15} />
            Excluir
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Valor Total do Pedido</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
                <p className="text-xs text-gray-400">{pedido.project_count} projeto{pedido.project_count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingDown size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Consumido</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalConsumed)}</p>
                <p className="text-xs text-gray-400">{consumedPct.toFixed(1)}% do total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalAvailable >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                <CheckCircle size={20} className={totalAvailable >= 0 ? "text-green-600" : "text-red-600"} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Disponível</p>
                <p className={`text-xl font-bold ${totalAvailable >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(totalAvailable)}
                </p>
                <p className="text-xs text-gray-400">{(100 - consumedPct).toFixed(1)}% restante</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall progress bar */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Consumo do Pedido</span>
            <span className="text-sm text-gray-500">{formatCurrency(totalConsumed)} / {formatCurrency(totalValue)}</span>
          </div>
          <ConsumeBar pct={consumedPct} />
        </CardContent>
      </Card>

      {/* Projects consumption table */}
      <Card>
        <CardHeader>Consumo por Projeto</CardHeader>
        <CardContent>
          {(!projects || projects.length === 0) ? (
            <p className="text-center text-gray-400 py-6 text-sm">Nenhum projeto associado a este pedido.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="pb-3 font-medium text-gray-500">Projeto</th>
                    <th className="pb-3 font-medium text-gray-500">Cliente</th>
                    <th className="pb-3 font-medium text-gray-500">Status</th>
                    <th className="pb-3 font-medium text-gray-500 text-right">Venda</th>
                    <th className="pb-3 font-medium text-gray-500 text-right">Consumido</th>
                    <th className="pb-3 font-medium text-gray-500 text-right">Disponível</th>
                    <th className="pb-3 font-medium text-gray-500 w-32">% Consumido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {projects.map((p: any) => {
                    const selling = Number(p.selling_price) || 0;
                    const consumed = Number(p.consumed) || 0;
                    const available = selling - consumed;
                    const pct = selling > 0 ? Math.min(100, (consumed / selling) * 100) : 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-3">
                          <Link href={`/projects/${p.id}`} className="text-brand-600 hover:underline font-medium">
                            {p.title}
                          </Link>
                        </td>
                        <td className="py-3 text-gray-500">{p.customer_name}</td>
                        <td className="py-3"><Badge status={p.status} /></td>
                        <td className="py-3 text-right font-medium">{formatCurrency(selling)}</td>
                        <td className="py-3 text-right text-orange-600">{formatCurrency(consumed)}</td>
                        <td className={`py-3 text-right font-medium ${available >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(available)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <ConsumeBar pct={pct} />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 font-semibold">
                    <td className="pt-3 text-gray-700" colSpan={3}>Total</td>
                    <td className="pt-3 text-right">{formatCurrency(totalValue)}</td>
                    <td className="pt-3 text-right text-orange-600">{formatCurrency(totalConsumed)}</td>
                    <td className={`pt-3 text-right ${totalAvailable >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(totalAvailable)}
                    </td>
                    <td className="pt-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ConsumeBar pct={consumedPct} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{consumedPct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Matrix */}
      {matrix && matrix.months && matrix.months.length > 0 && (
        <Card>
          <CardHeader>
            <button
              className="flex items-center justify-between w-full"
              onClick={() => setExpandedMatrix(!expandedMatrix)}
            >
              <span>Matriz Mensal de Consumo</span>
              <span className="text-sm font-normal text-gray-400">{expandedMatrix ? "▲" : "▼"}</span>
            </button>
          </CardHeader>
          {expandedMatrix && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="sticky left-0 bg-gray-50 text-left px-3 py-2 font-medium text-gray-600 border border-gray-200 min-w-40 z-10">
                        Projeto
                      </th>
                      {matrix.months.map((m: any) => (
                        <th
                          key={`${m.year}-${m.month}`}
                          colSpan={3}
                          className="text-center px-2 py-2 font-medium text-gray-600 border border-gray-200 min-w-32"
                        >
                          <MonthLabel year={m.year} month={m.month} />
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-gray-50 text-gray-400">
                      <th className="sticky left-0 bg-gray-50 border border-gray-200 px-3 py-1 z-10"></th>
                      {matrix.months.map((m: any) => (
                        <>
                          <th key={`${m.year}-${m.month}-a`} className="border border-gray-200 px-2 py-1 text-center font-normal">
                            No mês
                          </th>
                          <th key={`${m.year}-${m.month}-b`} className="border border-gray-200 px-2 py-1 text-center font-normal">
                            Acum. c/mês
                          </th>
                          <th key={`${m.year}-${m.month}-c`} className="border border-gray-200 px-2 py-1 text-center font-normal">
                            Acum. s/mês
                          </th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Order summary row */}
                    <tr className="bg-brand-50 font-semibold">
                      <td className="sticky left-0 bg-brand-50 px-3 py-2 border border-gray-200 text-brand-800 z-10">
                        {matrix.order_row.project_title}
                      </td>
                      {matrix.order_row.month_data.map((cell: any) => (
                        <>
                          <td key={`ord-${cell.year}-${cell.month}-a`} className="border border-gray-200 px-2 py-2 text-right">
                            <CurrencyCell value={cell.this_month} />
                          </td>
                          <td key={`ord-${cell.year}-${cell.month}-b`} className="border border-gray-200 px-2 py-2 text-right">
                            <CurrencyCell value={cell.acc_with} />
                          </td>
                          <td key={`ord-${cell.year}-${cell.month}-c`} className="border border-gray-200 px-2 py-2 text-right">
                            <CurrencyCell value={cell.acc_without} dim />
                          </td>
                        </>
                      ))}
                    </tr>
                    {/* Project rows */}
                    {matrix.project_rows.map((proj: any) => (
                      <tr key={proj.project_id} className="hover:bg-gray-50">
                        <td className="sticky left-0 bg-white hover:bg-gray-50 px-3 py-2 border border-gray-200 pl-6 z-10">
                          <Link href={`/projects/${proj.project_id}`} className="text-brand-600 hover:underline">
                            {proj.project_title}
                          </Link>
                        </td>
                        {proj.month_data.map((cell: any) => (
                          <>
                            <td key={`${proj.project_id}-${cell.year}-${cell.month}-a`} className="border border-gray-200 px-2 py-2 text-right">
                              <CurrencyCell value={cell.this_month || null} />
                            </td>
                            <td key={`${proj.project_id}-${cell.year}-${cell.month}-b`} className="border border-gray-200 px-2 py-2 text-right">
                              <CurrencyCell value={cell.acc_with} />
                            </td>
                            <td key={`${proj.project_id}-${cell.year}-${cell.month}-c`} className="border border-gray-200 px-2 py-2 text-right">
                              <CurrencyCell value={cell.acc_without} dim />
                            </td>
                          </>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex gap-4 text-xs text-gray-400">
                  <span><strong>No mês</strong>: custo incorrido apenas naquele mês</span>
                  <span><strong>Acum. c/mês</strong>: total acumulado incluindo o mês</span>
                  <span><strong>Acum. s/mês</strong>: total acumulado sem o mês corrente</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Notes */}
      {pedido.notes && (
        <Card>
          <CardHeader>Observações</CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{pedido.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

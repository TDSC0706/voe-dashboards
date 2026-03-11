"use client";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ShoppingBag } from "lucide-react";

export default function PedidosPage() {
  const { data, loading, error } = useApi(() => api.pedidos());
  const router = useRouter();
  const pedidos = data || [];

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingBag size={24} className="text-brand-600" />
          <h1 className="text-2xl font-bold">Pedidos</h1>
        </div>
        <Link
          href="/pedidos/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus size={16} />
          Novo Pedido
        </Link>
      </div>

      {pedidos.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-gray-400 py-12">Nenhum pedido cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pedidos.map((pedido: any) => (
            <div key={pedido.id} className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/pedidos/${pedido.id}`)}>
            <Card>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">{pedido.name}</h2>
                      <Badge status={pedido.status} />
                    </div>
                    {pedido.description && (
                      <p className="text-sm text-gray-500 mb-2 line-clamp-1">{pedido.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{pedido.project_count} projeto{pedido.project_count !== 1 ? "s" : ""}</span>
                      <span>Criado em {formatDate(pedido.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right ml-6 shrink-0">
                    <p className="text-xs text-gray-400 mb-0.5">Valor total</p>
                    <p className="text-xl font-bold text-brand-600">{formatCurrency(pedido.total_value)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

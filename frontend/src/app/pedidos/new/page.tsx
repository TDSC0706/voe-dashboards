"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";

const INPUT_CLS = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
const LABEL_CLS = "block text-sm font-medium text-gray-700 mb-1";

export default function NewPedidoPage() {
  const router = useRouter();
  const { data: projects, loading, error } = useApi(() => api.projects());

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const list = projects || [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((p: any) =>
      p.title?.toLowerCase().includes(q) || p.customer_name?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const totalValue = useMemo(() => {
    const list = projects || [];
    return list
      .filter((p: any) => selectedIds.has(p.id))
      .reduce((sum: number, p: any) => sum + (Number(p.selling_price) || 0), 0);
  }, [projects, selectedIds]);

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.createPedido({
        name: name.trim(),
        description: description.trim() || null,
        status,
        notes: notes.trim() || null,
        project_ids: Array.from(selectedIds),
      });
      router.push(`/pedidos/${res.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/pedidos" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold">Novo Pedido</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <Card>
          <CardHeader>Informações do Pedido</CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className={LABEL_CLS}>Nome *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nome do pedido"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Descrição</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descrição opcional"
                rows={3}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={INPUT_CLS}>
                <option value="ACTIVE">Ativo</option>
                <option value="COMPLETED">Concluído</option>
                <option value="CANCELED">Cancelado</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Observações</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observações opcionais"
                rows={2}
                className={INPUT_CLS}
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                <Check size={16} />
                {saving ? "Salvando..." : "Criar Pedido"}
              </button>
              <Link
                href="/pedidos"
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                <X size={16} />
                Cancelar
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Right: Project selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span>Projetos</span>
              <span className="text-sm font-normal text-gray-500">
                {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""} · {formatCurrency(totalValue)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar projetos..."
              className={`${INPUT_CLS} mb-3`}
            />
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filtered.map((p: any) => {
                const selected = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-3 transition-colors ${
                      selected
                        ? "bg-brand-50 border border-brand-300"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.title}</p>
                      <p className="text-xs text-gray-400 truncate">{p.customer_name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium">{formatCurrency(p.selling_price)}</p>
                      {selected && <Check size={14} className="text-brand-600 ml-auto mt-0.5" />}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-center text-gray-400 py-4 text-sm">Nenhum projeto encontrado</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

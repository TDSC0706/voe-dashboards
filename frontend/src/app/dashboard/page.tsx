"use client";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

export default function DashboardListPage() {
  const { data, loading, error, refresh } = useApi(() => api.dashboards());
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await api.createDashboard({ name, layout: [] });
      setName("");
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    await api.deleteDashboard(id);
    refresh();
  };

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboards Personalizados</h1>

      <Card>
        <CardContent>
          <div className="flex gap-3 items-center">
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nome do novo dashboard..."
              className="px-3 py-2 border rounded text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button onClick={handleCreate} disabled={creating || !name.trim()}
              className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
              <Plus size={16} /> Criar
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data || []).map((d: any) => (
          <Card key={d.id} className="hover:shadow-md transition-shadow">
            <CardContent>
              <div className="flex items-center justify-between">
                <Link href={`/dashboard/${d.id}`} className="text-brand-600 hover:underline font-semibold text-sm">
                  {d.name}
                </Link>
                <button onClick={() => handleDelete(d.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{d.description || "Sem descrição"}</p>
              <p className="text-xs text-gray-300 mt-1">{(d.layout || []).length} blocos</p>
            </CardContent>
          </Card>
        ))}
        {(data || []).length === 0 && (
          <p className="text-gray-400 text-sm col-span-3 text-center py-8">
            Nenhum dashboard criado. Crie um acima.
          </p>
        )}
      </div>
    </div>
  );
}

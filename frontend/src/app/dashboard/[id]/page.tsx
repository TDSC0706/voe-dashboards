"use client";
import { useState, useCallback } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { KPICard } from "@/components/ui/KPICard";
import { use } from "react";
import { Plus, Save, Hash, BarChart3, Table, Type } from "lucide-react";

interface Block {
  i: string;
  type: "metric" | "chart" | "table" | "text";
  title: string;
  config: Record<string, any>;
  x: number;
  y: number;
  w: number;
  h: number;
}

const BLOCK_TYPES = [
  { type: "metric", label: "Métrica", icon: Hash },
  { type: "chart", label: "Gráfico", icon: BarChart3 },
  { type: "table", label: "Tabela", icon: Table },
  { type: "text", label: "Texto", icon: Type },
] as const;

function BlockRenderer({ block }: { block: Block }) {
  if (block.type === "text") {
    return (
      <div className="p-3 h-full">
        <h3 className="text-sm font-semibold mb-1">{block.title}</h3>
        <p className="text-xs text-gray-500">{block.config.text || "Texto vazio"}</p>
      </div>
    );
  }
  if (block.type === "metric") {
    return (
      <div className="p-3 h-full flex flex-col justify-center items-center">
        <p className="text-xs text-gray-500">{block.title}</p>
        <p className="text-3xl font-bold text-brand-600">{block.config.value || "—"}</p>
        {block.config.subtitle && <p className="text-xs text-gray-400 mt-1">{block.config.subtitle}</p>}
      </div>
    );
  }
  return (
    <div className="p-3 h-full flex flex-col">
      <h3 className="text-sm font-semibold mb-2">{block.title}</h3>
      <div className="flex-1 flex items-center justify-center bg-gray-50 rounded text-xs text-gray-400">
        {block.type === "chart" ? "Configurar fonte de dados" : "Configurar tabela"}
      </div>
    </div>
  );
}

export default function DashboardBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const did = parseInt(id);
  const { data: dashboard, loading, error, refresh } = useApi(() => api.dashboard(did), [did]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  if (dashboard && !initialized) {
    setBlocks(dashboard.layout || []);
    setInitialized(true);
  }

  const addBlock = (type: Block["type"]) => {
    const newBlock: Block = {
      i: `block-${Date.now()}`,
      type,
      title: type === "metric" ? "Nova Métrica" : type === "chart" ? "Novo Gráfico" : type === "table" ? "Nova Tabela" : "Novo Texto",
      config: {},
      x: 0,
      y: blocks.length * 4,
      w: type === "metric" ? 3 : 6,
      h: type === "metric" ? 2 : 4,
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (i: string) => setBlocks(blocks.filter((b) => b.i !== i));

  const updateBlock = (i: string, updates: Partial<Block>) => {
    setBlocks(blocks.map((b) => (b.i === i ? { ...b, ...updates } : b)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateDashboard(did, { layout: blocks });
      refresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{dashboard.name}</h1>
        <div className="flex gap-2">
          {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
            <button key={type} onClick={() => addBlock(type as Block["type"])}
              className="px-3 py-1.5 border rounded text-xs flex items-center gap-1.5 hover:bg-gray-50">
              <Icon size={14} /> {label}
            </button>
          ))}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 bg-brand-600 text-white rounded text-xs flex items-center gap-1.5 hover:bg-brand-700 disabled:opacity-50">
            <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">Dashboard vazio</p>
          <p className="text-sm">Adicione blocos usando os botões acima</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {blocks.map((block) => (
            <div key={block.i} className="col-span-12 md:col-span-6 lg:col-span-4" style={{ gridColumn: `span ${Math.min(block.w, 12)}` }}>
              <Card className="relative group">
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => {
                    const title = prompt("Título:", block.title);
                    if (title) updateBlock(block.i, { title });
                  }} className="p-1 bg-gray-100 rounded text-xs">Editar</button>
                  <button onClick={() => removeBlock(block.i)}
                    className="p-1 bg-red-100 text-red-600 rounded text-xs">Remover</button>
                </div>
                <BlockRenderer block={block} />
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

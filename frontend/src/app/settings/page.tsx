"use client";
import { useState, useRef, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Loader, ErrorMessage } from "@/components/ui/Loader";

// ── Searchable combobox ────────────────────────────────────────────────────

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "— Selecionar —",
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative min-w-[260px]">
      <div
        className="px-2 py-1.5 border rounded text-sm cursor-pointer flex items-center justify-between bg-white gap-2"
        onClick={() => { setOpen(true); setQuery(""); }}
      >
        <span className={selected ? "text-gray-900 truncate" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar..."
            className="w-full px-2 py-1.5 text-sm border-b outline-none"
          />
          <div className="max-h-52 overflow-y-auto">
            <div
              className="px-2 py-1.5 text-sm text-gray-400 cursor-pointer hover:bg-gray-50"
              onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
            >
              — Selecionar —
            </div>
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-gray-400">Nenhum resultado</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.value}
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-50 ${
                    o.value === value ? "bg-brand-50 text-brand-700 font-medium" : ""
                  }`}
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── User Mappings Tab ──────────────────────────────────────────────────────

function UserMappingsTab() {
  const { data: mappings, loading, error, refresh } = useApi(() => api.userMappings());
  const { data: team } = useApi(() => api.teamAll());
  const { data: fuMembers } = useApi(() => api.flowupMembers());
  const [teamMemberId, setTeamMemberId] = useState("");
  const [fuMemberId, setFuMemberId] = useState("");

  const handleCreate = async () => {
    if (!teamMemberId || !fuMemberId) return;
    const selected = (fuMembers || []).find((m: any) => m.fu_member_id === parseInt(fuMemberId));
    await api.createUserMapping({
      team_member_id: parseInt(teamMemberId),
      fu_member_id: parseInt(fuMemberId),
      fu_member_name: selected?.name || null,
    });
    setTeamMemberId("");
    setFuMemberId("");
    refresh();
  };

  const handleDelete = async (id: number) => {
    await api.deleteUserMapping(id);
    refresh();
  };

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Novo Mapeamento</h2></CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Membro VOE</label>
              <select value={teamMemberId} onChange={(e) => setTeamMemberId(e.target.value)}
                className="px-3 py-2 border rounded text-sm min-w-[200px]">
                <option value="">Selecionar...</option>
                {(team || []).map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Membro Flowup</label>
              <select value={fuMemberId} onChange={(e) => setFuMemberId(e.target.value)}
                className="px-3 py-2 border rounded text-sm min-w-[200px]">
                <option value="">Selecionar...</option>
                {(fuMembers || []).map((m: any) => (
                  <option key={m.fu_member_id} value={m.fu_member_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleCreate}
              disabled={!teamMemberId || !fuMemberId}
              className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed">
              Salvar
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Mapeamentos Existentes</h2></CardHeader>
        <CardContent>
          {(mappings || []).length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum mapeamento configurado</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Membro VOE</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Membro Flowup</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(mappings || []).map((m: any) => (
                  <tr key={m.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-medium">{m.member_name}</td>
                    <td className="px-3 py-2 text-gray-500">{m.email}</td>
                    <td className="px-3 py-2">{m.fu_member_name || m.fu_member_id}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => handleDelete(m.id)}
                        className="text-red-500 hover:text-red-700 text-xs">Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Custo FlowUp Tab ───────────────────────────────────────────────────────

function CustoFlowupTab() {
  const { data: projects } = useApi(() => api.projects());
  const { data: costCenters } = useApi(() => api.flowupBoards());
  const { data: fuBoards } = useApi(() => api.flowupFuBoards());
  const { data: existingMappings, refresh } = useApi(() => api.flowupProjectMappings());
  const [selections, setSelections] = useState<Record<number, { type: string; ccId: string; boardId: string }>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const activeProjects = (projects || []).filter((p: any) => p.is_active);

  const getSelection = (projectId: number) => {
    if (projectId in selections) return selections[projectId];
    const existing = (existingMappings || []).find((m: any) => m.project_id === projectId);
    return {
      type: existing?.mapping_type || "cost_center",
      ccId: existing?.fu_cost_center_id?.toString() || "",
      boardId: existing?.fu_board_id?.toString() || "",
    };
  };

  const updateSelection = (projectId: number, patch: Partial<{ type: string; ccId: string; boardId: string }>) => {
    setSelections((prev) => ({ ...prev, [projectId]: { ...getSelection(projectId), ...patch } }));
  };

  const handleSave = async (projectId: number) => {
    const sel = getSelection(projectId);
    setSaving((prev) => ({ ...prev, [projectId]: true }));
    await api.updateProjectFlowupMapping(projectId, {
      mapping_type: sel.type,
      fu_cost_center_id: sel.type === "cost_center" && sel.ccId ? parseInt(sel.ccId) : null,
      fu_board_id: sel.type === "board" && sel.boardId ? parseInt(sel.boardId) : null,
    });
    refresh();
    setSaving((prev) => ({ ...prev, [projectId]: false }));
  };

  // Build options lists
  const costCenterOptions = (costCenters || []).map((cc: any) => ({
    value: cc.fu_project_id?.toString() || "",
    label: cc.fu_project_name || `#${cc.fu_project_id}`,
  })).filter((o: any) => o.value);

  const boardOptions = (fuBoards || []).map((b: any) => ({
    value: b.fu_board_id?.toString() || "",
    label: b.cost_center_name
      ? `${b.cost_center_name} - ${b.fu_board_name || `#${b.fu_board_id}`}`
      : (b.fu_board_name || `#${b.fu_board_id}`),
  })).filter((o: any) => o.value);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-sm font-semibold">Mapeamento de Custo FlowUp por Projeto</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Defina se cada projeto usa um centro de custo completo ou um quadro específico para calcular o custo real.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {activeProjects.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum projeto ativo encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Projeto</th>
                  <th className="px-3 py-2 text-left">Tipo de Mapeamento</th>
                  <th className="px-3 py-2 text-left">FlowUp Origem</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {activeProjects.map((p: any) => {
                  const sel = getSelection(p.id);
                  return (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="px-3 py-2 font-medium">{p.title}</td>
                      <td className="px-3 py-2">
                        <select
                          value={sel.type}
                          onChange={(e) => updateSelection(p.id, { type: e.target.value })}
                          className="px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="cost_center">Centro de Custo</option>
                          <option value="board">Quadro</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {sel.type === "cost_center" ? (
                          <SearchableSelect
                            value={sel.ccId}
                            onChange={(v) => updateSelection(p.id, { ccId: v })}
                            options={costCenterOptions}
                          />
                        ) : (
                          <SearchableSelect
                            value={sel.boardId}
                            onChange={(v) => updateSelection(p.id, { boardId: v })}
                            options={boardOptions}
                            placeholder={boardOptions.length === 0 ? "Sincronize para carregar quadros" : "— Selecionar —"}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleSave(p.id)}
                          disabled={saving[p.id]}
                          className="px-3 py-1.5 bg-brand-600 text-white rounded text-xs hover:bg-brand-700 disabled:opacity-50"
                        >
                          {saving[p.id] ? "..." : "Salvar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<"membros" | "custo">("membros");

  const labels: Record<string, string> = {
    membros: "Membros",
    custo: "Custo FlowUp",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mapeamento VOE — Flowup</h1>

      <div className="flex gap-1 border-b">
        {(["membros", "custo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {labels[t]}
          </button>
        ))}
      </div>

      {tab === "membros" && <UserMappingsTab />}
      {tab === "custo" && <CustoFlowupTab />}
    </div>
  );
}

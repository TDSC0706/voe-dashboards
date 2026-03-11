"use client";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatDate, formatHours } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs px-2 py-1 border border-gray-200 rounded mb-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export default function ProdutosPage() {
  const { data, loading, error } = useApi(() => api.deliverableTree());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const getFilter = (key: string) => filters[key] || "";
  const setFilter = (key: string, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));

  const filterText = (text: string, filter: string) =>
    !filter || (text || "").toLowerCase().includes(filter.toLowerCase());

  const products: any[] = data?.products || [];

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Produtos</h1>

      {products.map((product: any) => {
        const prodKey = `prod-${product.id}`;
        const isOpen = expanded[prodKey];
        const filter = getFilter(prodKey);
        const filteredProjects = (product.projects || []).filter((p: any) =>
          filterText(p.title, filter)
        );

        return (
          <div key={product.id} className="border-l-4 border-purple-500 bg-white rounded-lg shadow-sm overflow-hidden">
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-purple-50 select-none"
              onClick={() => toggle(prodKey)}
            >
              {isOpen ? <ChevronDown size={16} className="text-purple-500 shrink-0" /> : <ChevronRight size={16} className="text-purple-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{product.title}</span>
                  <span className="text-xs text-gray-400">[{product.code}]</span>
                  <Badge status={product.state} />
                </div>
                <p className="text-xs text-gray-400">{(product.projects || []).length} projetos</p>
              </div>
            </div>

            {isOpen && (
              <div className="px-4 pb-4">
                <FilterInput value={filter} onChange={(v) => setFilter(prodKey, v)} placeholder="Filtrar projetos..." />

                {filteredProjects.map((project: any) => {
                  const projKey = `proj-${project.id}`;
                  const isProjOpen = expanded[projKey];
                  const projFilter = getFilter(projKey);
                  const filteredDeliverables = (project.deliverables || []).filter((d: any) =>
                    filterText(d.title, projFilter) || filterText(d.description, projFilter)
                  );

                  return (
                    <div key={project.id} className="border-l-4 border-blue-500 bg-blue-50 rounded-lg mb-2 ml-2 overflow-hidden">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-blue-100 select-none"
                        onClick={() => toggle(projKey)}
                      >
                        {isProjOpen ? <ChevronDown size={14} className="text-blue-500 shrink-0" /> : <ChevronRight size={14} className="text-blue-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{project.title}</span>
                            <Badge status={project.status} />
                            {project.is_delayed && <Badge status="OVERDUE" label="Atrasado" />}
                          </div>
                          <p className="text-xs text-gray-500">
                            {project.customer_name || "—"} | {project.completed_deliverables}/{project.total_deliverables} entregas | Prazo: {formatDate(project.planned_end_date)}
                          </p>
                        </div>
                        <div className="w-24 shrink-0">
                          <ProgressBar value={project.completed_deliverables} max={project.total_deliverables || 1} />
                        </div>
                      </div>

                      {isProjOpen && (
                        <div className="px-4 pb-3">
                          <FilterInput value={projFilter} onChange={(v) => setFilter(projKey, v)} placeholder="Filtrar entregas..." />

                          {filteredDeliverables.map((deliverable: any) => {
                            const delKey = `del-${deliverable.id}`;
                            const isDelOpen = expanded[delKey];
                            const delFilter = getFilter(delKey);
                            const filteredItems = (deliverable.backlog_items || []).filter((bi: any) =>
                              filterText(bi.title, delFilter) || filterText(bi.description, delFilter)
                            );

                            return (
                              <div key={deliverable.id} className="border-l-4 border-green-500 bg-white rounded-lg mb-2 ml-2 overflow-hidden shadow-sm">
                                <div
                                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-green-50 select-none"
                                  onClick={() => toggle(delKey)}
                                >
                                  {isDelOpen ? <ChevronDown size={13} className="text-green-600 shrink-0" /> : <ChevronRight size={13} className="text-green-600 shrink-0" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm">{deliverable.title}</span>
                                      <Badge status={deliverable.status} />
                                      {deliverable.is_delayed_flag && <Badge status="OVERDUE" label="Atrasado" />}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      {deliverable.completed_items}/{deliverable.total_items} itens | Prazo: {formatDate(deliverable.deadline)}
                                    </p>
                                  </div>
                                  <div className="w-20 shrink-0">
                                    <ProgressBar value={deliverable.completed_items} max={deliverable.total_items || 1} />
                                  </div>
                                </div>

                                {isDelOpen && (
                                  <div className="px-4 pb-3">
                                    <FilterInput value={delFilter} onChange={(v) => setFilter(delKey, v)} placeholder="Filtrar itens de backlog..." />

                                    {filteredItems.map((item: any) => {
                                      const itemKey = `item-${item.id}`;
                                      const isItemOpen = expanded[itemKey];

                                      return (
                                        <div key={item.id} className="border-l-4 border-yellow-400 bg-yellow-50 rounded-lg mb-2 ml-2 overflow-hidden">
                                          <div
                                            className="flex items-center gap-3 p-2 cursor-pointer hover:bg-yellow-100 select-none"
                                            onClick={() => toggle(itemKey)}
                                          >
                                            {isItemOpen ? <ChevronDown size={12} className="text-yellow-600 shrink-0" /> : <ChevronRight size={12} className="text-yellow-600 shrink-0" />}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-medium">#{item.code} {item.title}</span>
                                                <Badge status={item.status} />
                                              </div>
                                              <p className="text-xs text-gray-400">
                                                {item.completed_activities}/{item.total_activities} atividades | {formatDate(item.planned_end_date)}
                                              </p>
                                            </div>
                                            <div className="w-16 shrink-0">
                                              <ProgressBar value={item.completed_activities} max={item.total_activities || 1} />
                                            </div>
                                          </div>

                                          {isItemOpen && (
                                            <div className="px-4 pb-2 space-y-1">
                                              {(item.activities || []).length === 0 ? (
                                                <p className="text-xs text-gray-300 py-1 text-center">Sem atividades</p>
                                              ) : (
                                                (item.activities || []).map((activity: any) => (
                                                  <div key={activity.id} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded text-xs border-l-2 border-gray-200">
                                                    <span className="flex-1 font-medium truncate">{activity.title}</span>
                                                    <Badge status={activity.status} />
                                                    <span className="text-gray-400 shrink-0">{activity.member_name || "—"}</span>
                                                    <span className="text-gray-400 shrink-0">{formatHours(activity.estimation_hours)}</span>
                                                  </div>
                                                ))
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {filteredItems.length === 0 && (deliverable.backlog_items || []).length > 0 && (
                                      <p className="text-xs text-gray-400 py-1 text-center">Nenhum item corresponde ao filtro</p>
                                    )}
                                    {(deliverable.backlog_items || []).length === 0 && (
                                      <p className="text-xs text-gray-300 py-1 text-center">Sem itens de backlog</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {filteredDeliverables.length === 0 && (project.deliverables || []).length > 0 && (
                            <p className="text-xs text-gray-400 py-1 text-center">Nenhuma entrega corresponde ao filtro</p>
                          )}
                          {(project.deliverables || []).length === 0 && (
                            <p className="text-xs text-gray-300 py-1 text-center">Sem entregas</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredProjects.length === 0 && (product.projects || []).length > 0 && (
                  <p className="text-xs text-gray-400 py-1 text-center">Nenhum projeto corresponde ao filtro</p>
                )}
                {(product.projects || []).length === 0 && (
                  <p className="text-xs text-gray-300 py-1 text-center">Sem projetos</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {products.length === 0 && (
        <p className="text-gray-400 text-center py-8">Nenhum produto encontrado</p>
      )}
    </div>
  );
}

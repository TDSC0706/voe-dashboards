"use client";
import { useState, useEffect, useRef } from "react";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatDateTime } from "@/lib/utils";

type SyncEvent = {
  type: string;
  source?: string;
  entity?: string;
  status?: string;
  records_synced?: number;
};

export default function SyncPage() {
  const { data, loading, error, refresh } = useApi(() => api.syncStatus());
  const { data: configData } = useApi(() => api.getSyncConfig());
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const [isSyncRunning, setIsSyncRunning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [odataInterval, setOdataInterval] = useState(300);
  const [flowupInterval, setFlowupInterval] = useState(600);
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/updates");
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg: SyncEvent = JSON.parse(event.data);
      if (msg.type === "sync_start") {
        setIsSyncRunning(true);
        setSyncEvents([]);
      } else if (msg.type === "sync_progress") {
        setSyncEvents((prev) => [...prev, msg]);
      } else if (msg.type === "sync_complete") {
        setIsSyncRunning(false);
        refresh();
        setTimeout(() => setSyncEvents([]), 5000);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (configData) {
      setOdataInterval(configData.odata_interval ?? 300);
      setFlowupInterval(configData.flowup_interval ?? 600);
    }
  }, [configData]);

  const handleSync = async () => {
    await api.triggerSync();
  };

  const handleSaveConfig = async () => {
    await api.updateSyncConfig({ odata_interval: odataInterval, flowup_interval: flowupInterval });
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  };

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  const progressEvents = syncEvents.filter((e) => e.type === "sync_progress");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sincronização</h1>
        <button
          onClick={handleSync}
          disabled={isSyncRunning}
          className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {isSyncRunning ? "Sincronizando..." : "Sincronizar Agora"}
        </button>
      </div>

      {(isSyncRunning || progressEvents.length > 0) && (
        <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            {isSyncRunning && (
              <span className="inline-block w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            )}
            <span>{isSyncRunning ? "Sincronizando tabelas..." : "Sincronização concluída"}</span>
          </div>
          {progressEvents.length > 0 && (
            <div className="space-y-0.5">
              {progressEvents.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="uppercase text-xs font-semibold bg-gray-200 px-1.5 py-0.5 rounded">
                    {e.source}
                  </span>
                  <span className="flex-1">{e.entity}</span>
                  {e.status === "success" ? (
                    <span className="text-green-600">✓ {e.records_synced} registros</span>
                  ) : (
                    <span className="text-red-500">✗ erro</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Último Status</h2></CardHeader>
        <CardContent>
          {(data?.latest || []).length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma sincronização realizada. Clique em &quot;Sincronizar Agora&quot;.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Fonte</th>
                  <th className="px-3 py-2 text-left">Entidade</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Registros</th>
                  <th className="px-3 py-2 text-left">Início</th>
                  <th className="px-3 py-2 text-left">Fim</th>
                </tr>
              </thead>
              <tbody>
                {(data?.latest || []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-3 py-2 uppercase font-medium">{s.source}</td>
                    <td className="px-3 py-2">{s.entity}</td>
                    <td className="px-3 py-2">
                      <Badge status={s.status === "success" ? "ON_TRACK" : "OVERDUE"}
                        label={s.status === "success" ? "OK" : "Erro"} />
                    </td>
                    <td className="px-3 py-2 text-right">{s.records_synced || 0}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{formatDateTime(s.started_at)}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{formatDateTime(s.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Configuração de Intervalos</h2></CardHeader>
        <CardContent>
          <div className="flex gap-6 items-end flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">OData (segundos)</label>
              <input
                type="number"
                min={30}
                value={odataInterval}
                onChange={(e) => setOdataInterval(Number(e.target.value))}
                className="px-3 py-2 border rounded text-sm w-32"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">FlowUp (segundos)</label>
              <input
                type="number"
                min={30}
                value={flowupInterval}
                onChange={(e) => setFlowupInterval(Number(e.target.value))}
                className="px-3 py-2 border rounded text-sm w-32"
              />
            </div>
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
            >
              Salvar
            </button>
            {configSaved && <span className="text-green-600 text-sm">Salvo!</span>}
          </div>
          <p className="text-xs text-gray-400 mt-3">Altera o intervalo de sincronização automática em tempo real.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Histórico Recente</h2></CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-gray-500 uppercase">
                  <th className="px-2 py-1 text-left">Fonte</th>
                  <th className="px-2 py-1 text-left">Entidade</th>
                  <th className="px-2 py-1 text-left">Status</th>
                  <th className="px-2 py-1 text-right">Registros</th>
                  <th className="px-2 py-1 text-left">Erro</th>
                  <th className="px-2 py-1 text-left">Quando</th>
                </tr>
              </thead>
              <tbody>
                {(data?.history || []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-2 py-1 uppercase">{s.source}</td>
                    <td className="px-2 py-1">{s.entity}</td>
                    <td className="px-2 py-1">{s.status}</td>
                    <td className="px-2 py-1 text-right">{s.records_synced || 0}</td>
                    <td className="px-2 py-1 text-red-500 truncate max-w-xs">{s.error_message || "—"}</td>
                    <td className="px-2 py-1 text-gray-400">{formatDateTime(s.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

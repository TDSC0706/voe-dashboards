"use client";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Loader, ErrorMessage } from "@/components/ui/Loader";
import { formatHours } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function TimeTrackingPage() {
  const { data: discrepancy, loading, error } = useApi(() => api.flowupDiscrepancy());

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Horas — VOE vs Flowup</h1>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Comparação por Projeto</h2></CardHeader>
        <CardContent>
          {(discrepancy || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, (discrepancy || []).length * 40)}>
              <BarChart data={discrepancy || []} layout="vertical" margin={{ left: 140 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="title" type="category" fontSize={11} width={135} />
                <Tooltip formatter={(value: any) => [formatHours(Number(value)), undefined]} />
                <Legend />
                <Bar dataKey="voe_total" name="VOE (horas)" fill="#3b82f6" />
                <Bar dataKey="fu_total" name="Flowup (horas)" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Sem dados comparativos (sincronize primeiro)</p>
          )}
        </CardContent>
      </Card>

      {(discrepancy || []).length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Tabela de Discrepâncias</h2></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Projeto</th>
                  <th className="px-3 py-2 text-right">VOE (h)</th>
                  <th className="px-3 py-2 text-right">Flowup (h)</th>
                  <th className="px-3 py-2 text-right">Diferença (h)</th>
                </tr>
              </thead>
              <tbody>
                {(discrepancy || []).map((d: any) => (
                  <tr key={d.project_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{d.title}</td>
                    <td className="px-3 py-2 text-right">{formatHours(d.voe_total)}</td>
                    <td className="px-3 py-2 text-right">{formatHours(d.fu_total)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${Math.abs(d.difference) > 10 ? "text-red-600" : "text-gray-500"}`}>
                      {formatHours(d.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";
export default function IterationError({ error }: { error: Error }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      Erro ao carregar iteração: {error.message}
    </div>
  );
}

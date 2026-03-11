import { cn } from "@/lib/utils";

export function ProgressBar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct >= 90 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct >= 25 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className={cn("w-full bg-gray-100 rounded-full h-2", className)}>
      <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

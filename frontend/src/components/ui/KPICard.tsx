import { Card } from "./Card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  color?: string;
}

export function KPICard({ title, value, subtitle, icon: Icon, color = "text-brand-600" }: KPICardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={cn("text-2xl font-bold mt-1", color)}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={cn("p-2 rounded-lg bg-gray-50", color)}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

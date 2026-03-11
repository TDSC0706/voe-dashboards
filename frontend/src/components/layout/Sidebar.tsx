"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderKanban, IterationCcw, Users,
  ListChecks, Clock, Settings, RefreshCw, Blocks, CalendarClock, ShoppingBag
} from "lucide-react";

const navItems = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/projects", label: "Projetos", icon: FolderKanban },
  { href: "/iterations", label: "Iterações", icon: IterationCcw },
  { href: "/team", label: "Equipe", icon: Users },
  { href: "/produtos", label: "Produtos", icon: ListChecks },
  { href: "/time-tracking", label: "Horas (Flowup)", icon: Clock },
  { href: "/user-hours", label: "Horas por Usuário", icon: CalendarClock },
  { href: "/dashboard", label: "Dashboard Builder", icon: Blocks },
  { href: "/settings", label: "Mapeamento", icon: Settings },
  { href: "/sync", label: "Sincronização", icon: RefreshCw },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-brand-900 text-white flex flex-col z-30">
      <div className="p-4 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight">VOE Dashboard</h1>
        <p className="text-xs text-white/60 mt-0.5">Gestão de Projetos</p>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                active ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

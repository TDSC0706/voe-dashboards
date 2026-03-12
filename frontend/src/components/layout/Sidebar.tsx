"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderKanban, IterationCcw,
  ListChecks, Settings, RefreshCw, CalendarClock, ShoppingBag,
  UserCog, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/",              label: "Visão Geral",      icon: LayoutDashboard },
  { href: "/pedidos",       label: "Pedidos",           icon: ShoppingBag },
  { href: "/projects",      label: "Projetos",          icon: FolderKanban },
  { href: "/iterations",    label: "Iterações",         icon: IterationCcw },
  { href: "/produtos",      label: "Produtos",          icon: ListChecks },
  { href: "/user-hours",    label: "Horas por Usuário", icon: CalendarClock },
  { href: "/settings",      label: "Mapeamento",        icon: Settings },
  { href: "/sync",          label: "Sincronização",     icon: RefreshCw },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen bg-brand-900 text-white flex flex-col z-30 transition-all duration-300"
      style={{ width: collapsed ? "56px" : "240px" }}
    >
      {/* Logo / Header */}
      <div className={cn(
        "flex items-center border-b border-white/10 transition-all duration-300",
        collapsed ? "justify-center p-3" : "px-4 py-3"
      )}>
        {collapsed ? (
          <Image
            src="/icon-logo.png"
            alt="Mekatronik"
            width={32}
            height={32}
            className="object-contain"
            style={{ filter: "invert(1)", mixBlendMode: "screen" }}
          />
        ) : (
          <Image
            src="/logo-mekatronik.png"
            alt="Mekatronik"
            width={140}
            height={32}
            className="object-contain brightness-0 invert"
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 py-2.5 text-sm transition-colors",
                collapsed ? "justify-center px-0" : "px-4",
                active
                  ? "bg-brand-500/30 text-white font-medium border-r-2 border-brand-400"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
        {user?.is_admin && (
          <Link
            href="/settings/users"
            title={collapsed ? "Usuários" : undefined}
            className={cn(
              "flex items-center gap-3 py-2.5 text-sm transition-colors",
              collapsed ? "justify-center px-0" : "px-4",
              pathname.startsWith("/settings/users")
                ? "bg-brand-500/30 text-white font-medium border-r-2 border-brand-400"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <UserCog size={18} className="shrink-0" />
            {!collapsed && "Usuários"}
          </Link>
        )}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 rounded-full bg-brand-500/50 flex items-center justify-center text-xs font-bold uppercase shrink-0">
              {(user?.full_name || user?.username || "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.full_name || user?.username}</p>
              {user?.is_admin && <p className="text-xs text-white/50">Admin</p>}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Sair"
          className={cn(
            "flex items-center gap-2 w-full py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors",
            collapsed ? "justify-center px-0" : "px-2"
          )}
        >
          <LogOut size={14} />
          {!collapsed && "Sair"}
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-md hover:bg-brand-400 transition-colors z-40"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && pathname === "/login") {
      router.replace(user.is_client ? "/client" : "/");
    }
    if (user?.is_client && !pathname.startsWith("/client")) {
      router.replace("/client");
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500 text-sm">Carregando...</div>
      </div>
    );
  }

  if (pathname === "/login") return <>{children}</>;
  if (!user) return null;

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main
        className="min-h-screen p-6 transition-all duration-300"
        style={{ marginLeft: collapsed ? "56px" : "240px" }}
      >
        {children}
      </main>
    </>
  );
}

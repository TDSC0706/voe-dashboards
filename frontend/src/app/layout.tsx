import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "VOE Dashboard",
  description: "Project management dashboard for VOE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Sidebar />
        <main className="ml-60 min-h-screen p-6">{children}</main>
      </body>
    </html>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col items-center justify-center w-1/2 bg-brand-900 px-16">
        <Image
          src="/logo-mekatronik.png"
          alt="Mekatronik"
          width={280}
          height={64}
          className="object-contain brightness-0 invert mb-8"
        />
        <p className="text-white/60 text-sm text-center max-w-xs leading-relaxed">
          Plataforma de gestão de projetos e KPIs da Mekatronik
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col items-center justify-center w-full lg:w-1/2 px-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Image
              src="/logo-mekatronik.png"
              alt="Mekatronik"
              width={180}
              height={42}
              className="object-contain"
            />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Bem-vindo</h2>
          <p className="text-sm text-gray-500 mb-8">Faça login para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                required
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-600 active:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

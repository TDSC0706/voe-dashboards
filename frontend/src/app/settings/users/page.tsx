"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { UserCog, Plus, Pencil, Trash2, X, Check } from "lucide-react";

interface AppUser {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  is_admin: boolean;
  is_client: boolean;
  is_active: boolean;
  customer_id: number | null;
  created_at: string;
  last_login: string | null;
}

interface Customer {
  id: number;
  name: string;
}

const emptyForm = {
  username: "",
  password: "",
  full_name: "",
  email: "",
  is_admin: false,
  is_client: false,
  customer_id: "" as string | number,
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<Partial<AppUser & { password: string }>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser?.is_admin) {
      router.replace("/");
      return;
    }
    loadUsers();
    api.customers().then(setCustomers).catch(() => {});
  }, [currentUser]);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.appUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.createAppUser({
        username: form.username,
        password: form.password,
        full_name: form.full_name || null,
        email: form.email || null,
        is_admin: form.is_admin,
        is_client: form.is_client,
        customer_id: form.customer_id !== "" ? Number(form.customer_id) : null,
      });
      setForm(emptyForm);
      setShowCreate(false);
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: number) {
    setSaving(true);
    setError("");
    try {
      const payload: any = {};
      if (editForm.full_name !== undefined) payload.full_name = editForm.full_name || null;
      if (editForm.email !== undefined) payload.email = editForm.email || null;
      if (editForm.is_admin !== undefined) payload.is_admin = editForm.is_admin;
      if (editForm.is_client !== undefined) payload.is_client = editForm.is_client;
      if (editForm.is_active !== undefined) payload.is_active = editForm.is_active;
      if ("customer_id" in editForm) payload.customer_id = editForm.customer_id || null;
      if (editForm.password) payload.password = editForm.password;
      await api.updateAppUser(id, payload);
      setEditId(null);
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, username: string) {
    if (!confirm(`Excluir o usuário "${username}"?`)) return;
    try {
      await api.deleteAppUser(id);
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEdit(u: AppUser) {
    setEditId(u.id);
    setEditForm({
      full_name: u.full_name || "",
      email: u.email || "",
      is_admin: u.is_admin,
      is_client: u.is_client,
      is_active: u.is_active,
      customer_id: u.customer_id ?? undefined,
      password: "",
    });
  }

  function formatDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function roleLabel(u: AppUser) {
    if (u.is_admin) return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Admin</span>;
    if (u.is_client) return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Cliente</span>;
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">Usuário</span>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog size={24} className="text-gray-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
            <p className="text-sm text-gray-500">Gerenciar acesso ao dashboard</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(""); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Novo Usuário
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Novo Usuário</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Usuário *</label>
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Senha *</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome Completo</label>
              <input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_admin}
                  onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked, is_client: e.target.checked ? false : f.is_client }))}
                  className="rounded"
                />
                Administrador
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_client}
                  onChange={e => setForm(f => ({ ...f, is_client: e.target.checked, is_admin: e.target.checked ? false : f.is_admin }))}
                  className="rounded"
                />
                Cliente
              </label>
            </div>
            {form.is_client && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cliente associado <span className="text-gray-400">(opcional — sem seleção verá todos os projetos)</span>
                </label>
                <select
                  value={form.customer_id}
                  onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Todos os clientes —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setError(""); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Criar Usuário"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Carregando...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nenhum usuário cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Perfil</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Último acesso</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => {
                const customerName = u.customer_id
                  ? customers.find(c => c.id === u.customer_id)?.name || `#${u.customer_id}`
                  : null;

                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    {editId === u.id ? (
                      <>
                        <td className="px-4 py-2 font-mono text-gray-700">{u.username}</td>
                        <td className="px-4 py-2">
                          <input
                            value={editForm.full_name || ""}
                            onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Nome completo"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="email"
                            value={editForm.email || ""}
                            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="E-mail"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.is_admin ?? false}
                                onChange={e => setEditForm(f => ({ ...f, is_admin: e.target.checked, is_client: e.target.checked ? false : f.is_client }))}
                              />
                              Admin
                            </label>
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.is_client ?? false}
                                onChange={e => setEditForm(f => ({ ...f, is_client: e.target.checked, is_admin: e.target.checked ? false : f.is_admin }))}
                              />
                              Cliente
                            </label>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editForm.customer_id ?? ""}
                            onChange={e => setEditForm(f => ({ ...f, customer_id: e.target.value ? Number(e.target.value) : undefined }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={!editForm.is_client}
                          >
                            <option value="">— Todos —</option>
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.is_active ?? true}
                              onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                            />
                            Ativo
                          </label>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="password"
                            value={editForm.password || ""}
                            onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Nova senha"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdate(u.id)}
                              disabled={saving}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Salvar"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                              title="Cancelar"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-gray-700">{u.username}</td>
                        <td className="px-4 py-3 text-gray-800">{u.full_name || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-gray-600">{u.email || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3">{roleLabel(u)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {customerName || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {u.is_active ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Ativo</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">Inativo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.last_login)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(u)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDelete(u.id, u.username)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

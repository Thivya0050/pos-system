"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  DollarSign,
  Inbox,
  Loader2,
  MapPin,
  Phone,
  Plus,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ModalCancelButton, ModalField, ModalForm } from "@/components/Modal";
import { formatRM } from "@/lib/utils";
import type { Branch } from "@/types/database";

type BranchStats = {
  orderCount: number;
  revenue: number;
  staffCount: number;
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Branch | null>(null);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from("branches").select("*").order("name");
    if (err) {
      setError(err.message);
      setBranches([]);
    } else {
      setBranches(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  async function openBranch(branch: Branch) {
    setSelected(branch);
    setStatsLoading(true);
    const [ordersRes, staffRes] = await Promise.all([
      supabase.from("orders").select("total").eq("branch_id", branch.id).eq("status", "completed"),
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("branch_id", branch.id),
    ]);
    const orders = (ordersRes.data ?? []) as { total: number }[];
    setStats({
      orderCount: orders.length,
      revenue: orders.reduce((s, o) => s + Number(o.total), 0),
      staffCount: staffRes.count ?? 0,
    });
    setStatsLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("branches").insert([
      {
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        is_active: true,
      },
    ] as never);
    if (err) setError(err.message);
    else {
      setModalOpen(false);
      setForm({ name: "", address: "", phone: "" });
      await fetchBranches();
    }
    setSaving(false);
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Branches</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">Manage pharmacy locations</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
          <Plus className="h-4 w-4" />
          Add Branch
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[#64748b]" /></div>
      ) : branches.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-[#64748b]">
          <Inbox className="mb-2 h-8 w-8 text-[#cbd5e1]" />
          <p className="text-sm">No branches yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => openBranch(b)}
              className="card text-left transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-[#0f172a]">{b.name}</p>
                  <span className={`text-xs font-medium ${b.is_active ? "text-emerald-600" : "text-[#64748b]"}`}>
                    {b.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              {b.address && (
                <p className="mb-1 flex items-start gap-2 text-sm text-[#64748b]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {b.address}
                </p>
              )}
              {b.phone && (
                <p className="flex items-center gap-2 text-sm text-[#64748b]">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {b.phone}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      <ModalForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Branch"
        onSubmit={handleAdd}
        footer={
          <>
            <ModalCancelButton onClick={() => setModalOpen(false)} />
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Add Branch"}
            </button>
          </>
        }
      >
        <ModalField label="Name *">
          <input required className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </ModalField>
        <ModalField label="Address">
          <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </ModalField>
        <ModalField label="Phone">
          <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </ModalField>
      </ModalForm>

      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelected(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <h3 className="text-base font-semibold text-[#0f172a]">{selected.name}</h3>
              <button type="button" onClick={() => setSelected(null)} className="text-[#64748b]"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {statsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#64748b]" /></div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="card border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="h-5 w-5 text-[#64748b]" />
                      <div>
                        <p className="text-2xl font-bold text-[#0f172a]">{stats.orderCount}</p>
                        <p className="text-xs text-[#64748b]">Completed Orders</p>
                      </div>
                    </div>
                  </div>
                  <div className="card border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-[#64748b]" />
                      <div>
                        <p className="text-2xl font-bold text-[#0f172a]">{formatRM(stats.revenue)}</p>
                        <p className="text-xs text-[#64748b]">Total Revenue</p>
                      </div>
                    </div>
                  </div>
                  <div className="card border-l-4 border-l-purple-500">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-[#64748b]" />
                      <div>
                        <p className="text-2xl font-bold text-[#0f172a]">{stats.staffCount}</p>
                        <p className="text-xs text-[#64748b]">Staff Members</p>
                      </div>
                    </div>
                  </div>
                  {selected.address && (
                    <p className="text-sm text-[#64748b]"><MapPin className="mr-1 inline h-4 w-4" />{selected.address}</p>
                  )}
                  {selected.phone && (
                    <p className="text-sm text-[#64748b]"><Phone className="mr-1 inline h-4 w-4" />{selected.phone}</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

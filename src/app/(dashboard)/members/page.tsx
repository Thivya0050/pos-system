"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Modal,
  ModalCancelButton,
  ModalField,
  ModalForm,
} from "@/components/Modal";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PinConfirmModal } from "@/components/PinConfirmModal";
import { useManagerPinGate } from "@/hooks/useManagerPinGate";
import {
  formatDate,
  formatRM,
  getInitials,
  getTierBadgeClass,
  normalizeTier,
  pointsToRM,
} from "@/lib/utils";
import type {
  Branch,
  Member,
  MemberTier,
  MemberVoucher,
  Order,
} from "@/types/database";

const TIERS: (MemberTier | "all")[] = ["all", "silver", "gold", "platinum"];
const TIER_OPTIONS: MemberTier[] = ["silver", "gold", "platinum"];

const emptyForm = {
  name: "",
  phone: "",
  ic_number: "",
  email: "",
  date_of_birth: "",
  branch_id: "",
  tier: "silver" as MemberTier,
};

function tierMatches(memberTier: string, filter: MemberTier | "all") {
  if (filter === "all") return true;
  return normalizeTier(memberTier) === filter;
}

function getAnnualSpendFromOrders(orders: { total: number }[]) {
  return orders.reduce((sum, o) => sum + Number(o.total), 0);
}

function getTierProgress(tier: MemberTier, annualSpend: number) {
  if (tier === "platinum") {
    return { label: "Max tier reached", percent: 100, remaining: 0, target: 0 };
  }
  if (tier === "gold") {
    const target = 8000;
    return {
      label: "Progress to Platinum",
      percent: Math.min(100, (annualSpend / target) * 100),
      remaining: Math.max(0, target - annualSpend),
      target,
    };
  }
  const target = 3000;
  return {
    label: "Progress to Gold",
    percent: Math.min(100, (annualSpend / target) * 100),
    remaining: Math.max(0, target - annualSpend),
    target,
  };
}

export default function MembersPage() {
  const session = getSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<MemberTier | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [profileOrders, setProfileOrders] = useState<Order[]>([]);
  const [annualSpend, setAnnualSpend] = useState(0);
  const [profileVouchers, setProfileVouchers] = useState<MemberVoucher[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { pinOpen, requestPin, closePin, onPinSuccess } = useManagerPinGate();

  const [form, setForm] = useState(emptyForm);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setMembers([]);
    } else {
      setMembers(
        (data ?? []).map((m) => ({
          ...m,
          tier: normalizeTier(m.tier),
        }))
      );
    }
    setLoading(false);
  }, []);

  const fetchBranches = useCallback(async () => {
    const { data } = await supabase.from("branches").select("*").order("name");
    setBranches(data ?? []);
  }, []);

  useEffect(() => {
    void fetchMembers();
    void fetchBranches();
  }, [fetchMembers, fetchBranches]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter((m) => {
      const matchesTier = tierMatches(m.tier, tierFilter);
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q);
      return matchesTier && matchesSearch;
    });
  }, [members, search, tierFilter]);

  const counts = useMemo(
    () => ({
      total: members.length,
      silver: members.filter((m) => normalizeTier(m.tier) === "silver").length,
      gold: members.filter((m) => normalizeTier(m.tier) === "gold").length,
      platinum: members.filter((m) => normalizeTier(m.tier) === "platinum").length,
    }),
    [members]
  );

  function openCreateModal() {
    setModalMode("create");
    setEditingMember(null);
    setForm({
      ...emptyForm,
      branch_id: session?.branchId ?? "",
    });
    setModalOpen(true);
  }

  function openEditModal(member: Member) {
    setModalMode("edit");
    setEditingMember(member);
    setForm({
      name: member.name,
      phone: member.phone,
      ic_number: member.ic_number ?? "",
      email: member.email ?? "",
      date_of_birth: member.date_of_birth?.slice(0, 10) ?? "",
      branch_id: member.branch_id ?? "",
      tier: normalizeTier(member.tier),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingMember(null);
    setForm(emptyForm);
  }

  async function openProfile(member: Member) {
    setSelected(member);
    setProfileLoading(true);
    const yearStart = `${new Date().getFullYear()}-01-01T00:00:00`;
    const [ordersRes, yearOrdersRes, vouchersRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, created_at, total")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("orders")
        .select("total")
        .eq("member_id", member.id)
        .gte("created_at", yearStart),
      supabase
        .from("member_vouchers")
        .select("*, promotions(name, voucher_code, expiry_date)")
        .eq("member_id", member.id)
        .eq("is_used", false)
        .order("created_at", { ascending: false }),
    ]);
    setProfileOrders((ordersRes.data ?? []) as Order[]);
    setAnnualSpend(getAnnualSpendFromOrders(yearOrdersRes.data ?? []));
    setProfileVouchers((vouchersRes.data ?? []) as MemberVoucher[]);
    setProfileLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (modalMode === "create") {
      const { data: member, error: insertErr } = await supabase
        .from("members")
        .insert([
          {
            branch_id: form.branch_id || session?.branchId || null,
            name: form.name.trim(),
            phone: form.phone.trim(),
            ic_number: form.ic_number.trim() || null,
            email: form.email.trim() || null,
            date_of_birth: form.date_of_birth || null,
            tier: "silver",
            points: 200,
            total_spend: 0,
          },
        ] as never)
        .select()
        .single();

      if (insertErr || !member) {
        setError(insertErr?.message ?? "Failed to create member");
        setSaving(false);
        return;
      }

      const newMember = member as Member;
      const { error: pointsErr } = await supabase.from("points_history").insert([
        {
          member_id: newMember.id,
          points: 200,
          description: "Welcome bonus",
          order_id: null,
        },
      ] as never);

      if (pointsErr) {
        setError(pointsErr.message);
      } else {
        closeModal();
        await fetchMembers();
        showToast("Member registered successfully");
      }
    } else if (editingMember) {
      const { error: updateErr } = await supabase
        .from("members")
        .update({
          name: form.name.trim(),
          phone: form.phone.trim(),
          ic_number: form.ic_number.trim() || null,
          email: form.email.trim() || null,
          date_of_birth: form.date_of_birth || null,
          branch_id: form.branch_id || null,
          tier: form.tier,
        } as never)
        .eq("id", editingMember.id);

      if (updateErr) {
        setError(updateErr.message);
      } else {
        closeModal();
        await fetchMembers();
        showToast("Member updated successfully");
      }
    }

    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    setError(null);

    const { error: deleteErr } = await supabase
      .from("members")
      .delete()
      .eq("id", deleteConfirm.id);

    if (deleteErr) {
      setError(deleteErr.message);
    } else {
      if (selected?.id === deleteConfirm.id) setSelected(null);
      setDeleteConfirm(null);
      await fetchMembers();
      showToast("Member removed successfully");
    }
    setDeleting(false);
  }

  const tierProgress = selected
    ? getTierProgress(normalizeTier(selected.tier), annualSpend)
    : null;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Members</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">
            Manage loyalty members and tiers
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Register Member
        </button>
      </div>

      {error && (
        <ErrorBanner error={error} onRetry={() => void fetchMembers()} />
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: counts.total, color: "border-l-blue-500" },
          { label: "Silver", value: counts.silver, color: "border-l-slate-400" },
          { label: "Gold", value: counts.gold, color: "border-l-amber-500" },
          { label: "Platinum", value: counts.platinum, color: "border-l-purple-500" },
        ].map((c) => (
          <div key={c.label} className={`card border-l-4 ${c.color}`}>
            <p className="text-2xl font-bold text-[#0f172a]">{c.value}</p>
            <p className="mt-1 text-xs text-[#64748b]">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as MemberTier | "all")}
          className="input-field w-full sm:w-40"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All Tiers" : t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-[#64748b]">
            <Inbox className="mb-2 h-8 w-8 text-[#cbd5e1]" />
            <p className="text-sm">No members found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Tier</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Points</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Total Spend</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Joined</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[#64748b]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="table-row group">
                  <td className="px-4 font-medium text-[#0f172a]">{m.name}</td>
                  <td className="px-4 text-[#64748b]">{m.phone}</td>
                  <td className="px-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getTierBadgeClass(m.tier)}`}
                    >
                      {normalizeTier(m.tier)}
                    </span>
                  </td>
                  <td className="px-4 text-[#0f172a]">{m.points.toLocaleString()}</td>
                  <td className="px-4 text-[#0f172a]">{formatRM(Number(m.total_spend))}</td>
                  <td className="px-4 text-[#64748b]">{formatDate(m.created_at)}</td>
                  <td className="px-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openProfile(m)}
                        className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#2563eb]"
                        title="View profile"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestPin(() => openEditModal(m))}
                        className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#2563eb]"
                        title="Edit member"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestPin(() => setDeleteConfirm(m))}
                        className="rounded p-1.5 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                        title="Delete member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PinConfirmModal open={pinOpen} onClose={closePin} onSuccess={onPinSuccess} />

      <ModalForm
        open={modalOpen}
        onClose={closeModal}
        title={modalMode === "create" ? "Register Member" : "Edit Member"}
        onSubmit={handleSubmit}
        footer={
          <>
            <ModalCancelButton onClick={closeModal} />
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : modalMode === "create" ? (
                "Register"
              ) : (
                "Save changes"
              )}
            </button>
          </>
        }
      >
        <ModalField label="Full Name *">
          <input
            required
            className="input-field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </ModalField>
        <ModalField label="Phone *">
          <input
            required
            className="input-field"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </ModalField>
        <ModalField label="IC Number">
          <input
            className="input-field"
            value={form.ic_number}
            onChange={(e) => setForm({ ...form, ic_number: e.target.value })}
          />
        </ModalField>
        <ModalField label="Email">
          <input
            type="email"
            className="input-field"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </ModalField>
        <ModalField label="Date of Birth">
          <input
            type="date"
            className="input-field"
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          />
        </ModalField>
        {modalMode === "edit" && (
          <>
            <ModalField label="Branch">
              <select
                className="input-field"
                value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
              >
                <option value="">No branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="Tier">
              <select
                className="input-field"
                value={form.tier}
                onChange={(e) =>
                  setForm({ ...form, tier: e.target.value as MemberTier })
                }
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </ModalField>
          </>
        )}
        {modalMode === "create" && (
          <p className="text-xs text-[#64748b]">New members receive 200 welcome points.</p>
        )}
      </ModalForm>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Remove member?"
        size="narrow"
        footer={
          <>
            <ModalCancelButton onClick={() => setDeleteConfirm(null)} />
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="btn-danger"
            >
              {deleting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Delete"}
            </button>
          </>
        }
      >
        <p className="text-sm text-[#64748b]">
          Are you sure you want to remove {deleteConfirm?.name} from members?
        </p>
      </Modal>

      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelected(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <h3 className="text-base font-semibold text-[#0f172a]">Member Profile</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[#64748b] hover:text-[#0f172a]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {profileLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
                </div>
              ) : (
                <>
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700">
                      {getInitials(selected.name)}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-[#0f172a]">{selected.name}</p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getTierBadgeClass(selected.tier)}`}
                      >
                        {normalizeTier(selected.tier)}
                      </span>
                    </div>
                  </div>

                  <dl className="mb-6 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-[#64748b]">Phone</dt>
                      <dd className="text-[#0f172a]">{selected.phone}</dd>
                    </div>
                    {selected.email && (
                      <div className="flex justify-between">
                        <dt className="text-[#64748b]">Email</dt>
                        <dd className="text-[#0f172a]">{selected.email}</dd>
                      </div>
                    )}
                    {selected.ic_number && (
                      <div className="flex justify-between">
                        <dt className="text-[#64748b]">IC</dt>
                        <dd className="text-[#0f172a]">{selected.ic_number}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="mb-6 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4 text-center">
                    <p className="text-3xl font-bold text-[#0f172a]">
                      {selected.points.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-[#64748b]">Points balance</p>
                    <p className="mt-2 text-sm font-medium text-emerald-600">
                      = {formatRM(pointsToRM(selected.points))} cashback
                    </p>
                  </div>

                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-[#64748b]">Annual spend</span>
                      <span className="font-medium text-[#0f172a]">{formatRM(annualSpend)}</span>
                    </div>
                    {tierProgress && (
                      <>
                        <div className="mb-1 flex items-center justify-between text-xs text-[#64748b]">
                          <span>{tierProgress.label}</span>
                          {tierProgress.target > 0 && (
                            <span>
                              {formatRM(annualSpend)} / {formatRM(tierProgress.target)}
                            </span>
                          )}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                          <div
                            className="h-full rounded-full bg-[#2563eb] transition-all"
                            style={{ width: `${tierProgress.percent}%` }}
                          />
                        </div>
                        {tierProgress.remaining > 0 && (
                          <p className="mt-1 text-xs text-[#64748b]">
                            {formatRM(tierProgress.remaining)} more to next tier
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mb-6">
                    <h4 className="mb-3 text-sm font-medium text-[#0f172a]">Last 5 Purchases</h4>
                    {profileOrders.length === 0 ? (
                      <p className="text-sm text-[#64748b]">No purchases yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {profileOrders.map((order) => (
                          <li
                            key={order.id}
                            className="flex items-center justify-between rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm"
                          >
                            <span className="text-[#64748b]">{formatDate(order.created_at)}</span>
                            <span className="font-medium text-[#0f172a]">
                              {formatRM(Number(order.total))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-3 text-sm font-medium text-[#0f172a]">Active Vouchers</h4>
                    {profileVouchers.length === 0 ? (
                      <p className="text-sm text-[#64748b]">No active vouchers</p>
                    ) : (
                      <ul className="space-y-2">
                        {profileVouchers.map((v) => {
                          const promo = v.promotions as {
                            name?: string;
                            voucher_code?: string;
                            expiry_date?: string;
                          } | null;
                          return (
                            <li
                              key={v.id}
                              className="rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm"
                            >
                              <p className="font-medium text-[#0f172a]">
                                {promo?.name ?? v.code}
                              </p>
                              <p className="text-xs text-[#64748b]">Code: {v.code}</p>
                              {promo?.expiry_date && (
                                <p className="text-xs text-[#64748b]">
                                  Expires: {formatDate(promo.expiry_date)}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] rounded-lg bg-[#0f172a] px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

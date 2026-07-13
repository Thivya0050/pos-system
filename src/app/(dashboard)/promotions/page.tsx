"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Gift,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Tag,
  Ticket,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { Modal, ModalCancelButton, ModalField, ModalForm } from "@/components/Modal";
import { supabase } from "@/lib/supabase";
import { formatDate, formatRM } from "@/lib/utils";
import type { MemberTier, Product, Promotion } from "@/types/database";

type Tab = "b2f1" | "pwp" | "voucher" | "active";
type ModalMode = "create" | "edit";

const TIER_OPTIONS: { value: MemberTier | "all"; label: string }[] = [
  { value: "all", label: "All tiers" },
  { value: "silver", label: "Silver (Member)" },
  { value: "gold", label: "Gold" },
  { value: "platinum", label: "Platinum" },
];

const emptyB2f1Form = {
  name: "",
  product_id: "",
  min_qty: "2",
  free_qty: "1",
  applies_to: "all" as MemberTier | "all",
};

const emptyPwpForm = {
  name: "",
  product_id: "",
  reward_product_id: "",
  reward_price: "",
  applies_to: "all" as MemberTier | "all",
  start_date: "",
  end_date: "",
  is_active: true,
};

const emptyVoucherForm = {
  name: "",
  voucher_code: "",
  discount_type: "fixed" as "fixed" | "percent",
  discount_value: "",
  min_spend: "",
  max_uses: "",
  max_uses_per_member: "",
  applies_to: "all" as MemberTier | "all",
  start_date: "",
  end_date: "",
  is_active: true,
};

function tierLabel(appliesTo: MemberTier | "all") {
  return TIER_OPTIONS.find((t) => t.value === appliesTo)?.label ?? appliesTo;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("b2f1");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Promotion | null>(null);
  const [deleteMode, setDeleteMode] = useState<"delete" | "deactivate">("delete");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [b2f1Form, setB2f1Form] = useState(emptyB2f1Form);
  const [pwpForm, setPwpForm] = useState(emptyPwpForm);
  const [voucherForm, setVoucherForm] = useState(emptyVoucherForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [promoRes, prodRes] = await Promise.all([
      supabase.from("promotions").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name").order("name"),
    ]);
    if (promoRes.error) setError(promoRes.error.message);
    else if (prodRes.error) setError(prodRes.error.message);
    setPromotions(promoRes.data ?? []);
    setProducts((prodRes.data ?? []) as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const productMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach((p) => {
      m[p.id] = p.name;
    });
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    if (tab === "active") return promotions.filter((p) => p.is_active);
    return promotions.filter((p) => p.type === tab);
  }, [promotions, tab]);

  function openCreateModal() {
    setModalMode("create");
    setEditingPromo(null);
    setModalError(null);
    if (tab === "b2f1") setB2f1Form(emptyB2f1Form);
    if (tab === "pwp") setPwpForm(emptyPwpForm);
    if (tab === "voucher") setVoucherForm(emptyVoucherForm);
    setModalOpen(true);
  }

  function openEditModal(promo: Promotion) {
    setModalMode("edit");
    setEditingPromo(promo);
    setModalError(null);
    if (promo.type === "pwp") {
      setPwpForm({
        name: promo.name,
        product_id: promo.product_id ?? "",
        reward_product_id: promo.reward_product_id ?? "",
        reward_price: String(promo.reward_price ?? ""),
        applies_to: promo.applies_to,
        start_date: promo.start_date ?? "",
        end_date: promo.end_date ?? "",
        is_active: promo.is_active,
      });
    } else if (promo.type === "voucher") {
      setVoucherForm({
        name: promo.name,
        voucher_code: promo.voucher_code ?? "",
        discount_type: promo.discount_type ?? "fixed",
        discount_value: String(promo.discount_value ?? ""),
        min_spend: promo.min_spend != null ? String(promo.min_spend) : "",
        max_uses: promo.max_uses != null ? String(promo.max_uses) : "",
        max_uses_per_member:
          promo.max_uses_per_member != null ? String(promo.max_uses_per_member) : "",
        applies_to: promo.applies_to,
        start_date: promo.start_date ?? "",
        end_date: promo.end_date ?? "",
        is_active: promo.is_active,
      });
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingPromo(null);
    setModalError(null);
  }

  async function toggleActive(promo: Promotion) {
    const { error: err } = await supabase
      .from("promotions")
      .update({ is_active: !promo.is_active } as never)
      .eq("id", promo.id);
    if (err) setError(err.message);
    else await fetchData();
  }

  async function openDeleteConfirm(promo: Promotion) {
    setDeleteError(null);
    if (promo.type === "voucher") {
      const { count } = await supabase
        .from("member_vouchers")
        .select("*", { count: "exact", head: true })
        .eq("promotion_id", promo.id);

      const hasRedemptions = (promo.uses_count ?? 0) > 0 || (count ?? 0) > 0;
      setDeleteMode(hasRedemptions ? "deactivate" : "delete");
    } else {
      setDeleteMode("delete");
    }
    setDeleteConfirm(promo);
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError(null);

    if (deleteMode === "deactivate") {
      const { error: err } = await supabase
        .from("promotions")
        .update({ is_active: false } as never)
        .eq("id", deleteConfirm.id);
      if (err) setDeleteError(err.message);
      else {
        setDeleteConfirm(null);
        await fetchData();
      }
    } else {
      const { error: err } = await supabase
        .from("promotions")
        .delete()
        .eq("id", deleteConfirm.id);
      if (err) {
        setDeleteError(err.message);
        setDeleteMode("deactivate");
      } else {
        setDeleteConfirm(null);
        await fetchData();
      }
    }

    setDeleting(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    let payload: Partial<Promotion> = { is_active: true };

    if (tab === "b2f1") {
      payload = {
        ...payload,
        type: "b2f1",
        name: b2f1Form.name.trim(),
        product_id: b2f1Form.product_id,
        min_qty: parseInt(b2f1Form.min_qty, 10),
        free_qty: parseInt(b2f1Form.free_qty, 10),
        applies_to: b2f1Form.applies_to,
      };
    } else if (tab === "pwp") {
      payload = {
        type: "pwp",
        name: pwpForm.name.trim(),
        product_id: pwpForm.product_id,
        reward_product_id: pwpForm.reward_product_id,
        reward_price: parseFloat(pwpForm.reward_price),
        applies_to: pwpForm.applies_to,
        start_date: pwpForm.start_date || null,
        end_date: pwpForm.end_date || null,
        is_active: pwpForm.is_active,
      };
    } else if (tab === "voucher") {
      payload = {
        type: "voucher",
        name: voucherForm.name.trim(),
        voucher_code: voucherForm.voucher_code.trim().toUpperCase(),
        discount_type: voucherForm.discount_type,
        discount_value: parseFloat(voucherForm.discount_value),
        min_spend: voucherForm.min_spend ? parseFloat(voucherForm.min_spend) : null,
        max_uses: voucherForm.max_uses ? parseInt(voucherForm.max_uses, 10) : null,
        max_uses_per_member: voucherForm.max_uses_per_member
          ? parseInt(voucherForm.max_uses_per_member, 10)
          : null,
        applies_to: voucherForm.applies_to,
        start_date: voucherForm.start_date || null,
        end_date: voucherForm.end_date || null,
        is_active: voucherForm.is_active,
        uses_count: modalMode === "create" ? 0 : editingPromo?.uses_count ?? 0,
      };
    } else {
      setSaving(false);
      return;
    }

    if (modalMode === "edit" && editingPromo) {
      const { error: err } = await supabase
        .from("promotions")
        .update(payload as never)
        .eq("id", editingPromo.id);
      if (err) setModalError(err.message);
      else {
        closeModal();
        await fetchData();
      }
    } else {
      const { error: err } = await supabase.from("promotions").insert([payload] as never);
      if (err) setModalError(err.message);
      else {
        closeModal();
        await fetchData();
      }
    }

    setSaving(false);
  }

  const tabs: { id: Tab; label: string; icon: typeof Tag }[] = [
    { id: "b2f1", label: "B2F1", icon: Gift },
    { id: "pwp", label: "PWP", icon: Tag },
    { id: "voucher", label: "Vouchers", icon: Ticket },
    { id: "active", label: "Active", icon: ToggleRight },
  ];

  const addLabel =
    tab === "b2f1" ? "B2F1" : tab === "pwp" ? "PWP" : tab === "voucher" ? "Voucher" : "";

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Promotions</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">Buy deals, PWP offers, and vouchers</p>
        </div>
        {tab !== "active" && (
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add {addLabel}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-lg border border-[#e2e8f0] bg-white p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === id ? "bg-[#2563eb] text-white" : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-[#64748b]">
          <Inbox className="mb-2 h-8 w-8 text-[#cbd5e1]" />
          <p className="text-sm">No promotions in this category</p>
        </div>
      ) : tab === "pwp" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[#0f172a]">{p.name}</h3>
                    <p className="mt-1 text-sm text-[#64748b]">
                      {productMap[p.product_id ?? ""] ?? "—"} →{" "}
                      {productMap[p.reward_product_id ?? ""] ?? "—"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#2563eb]">
                      Reward price: {formatRM(Number(p.reward_price))}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mb-4 space-y-1 text-xs text-[#64748b]">
                  <p>Tier: {tierLabel(p.applies_to)}</p>
                  {p.start_date && <p>Starts: {formatDate(p.start_date)}</p>}
                  {p.end_date && <p>Ends: {formatDate(p.end_date)}</p>}
                </div>
                <div className="flex items-center justify-end gap-1 border-t border-[#e2e8f0] pt-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
                    title="Toggle active"
                  >
                    {p.is_active ? (
                      <ToggleRight className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(p)}
                    className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#2563eb]"
                    title="Edit PWP"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void openDeleteConfirm(p)}
                    className="rounded p-1.5 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                    title="Delete PWP"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
      ) : tab === "voucher" ? (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Code</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Discount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Usage</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Tier</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Dates</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[#64748b]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="table-row group">
                  <td className="px-4 font-mono font-semibold text-[#0f172a]">
                    {p.voucher_code}
                  </td>
                  <td className="px-4 text-[#64748b]">{p.name}</td>
                  <td className="px-4 text-[#64748b]">
                    {p.discount_type === "percent"
                      ? `${p.discount_value}%`
                      : formatRM(Number(p.discount_value))}
                    {p.min_spend != null && p.min_spend > 0 && (
                      <span className="block text-xs text-[#94a3b8]">
                        Min spend {formatRM(Number(p.min_spend))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 text-[#64748b]">
                    {p.uses_count ?? 0}
                    {p.max_uses != null ? ` / ${p.max_uses}` : " / ∞"}
                    {p.max_uses_per_member != null && (
                      <span className="block text-xs text-[#94a3b8]">
                        {p.max_uses_per_member}/member
                      </span>
                    )}
                  </td>
                  <td className="px-4 capitalize text-[#64748b]">{tierLabel(p.applies_to)}</td>
                  <td className="px-4 text-xs text-[#64748b]">
                    {p.start_date ? formatDate(p.start_date) : "—"}
                    {p.end_date ? ` → ${formatDate(p.end_date)}` : ""}
                  </td>
                  <td className="px-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => toggleActive(p)}
                        className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
                        title="Toggle active"
                      >
                        {p.is_active ? (
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#2563eb]"
                        title="Edit voucher"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void openDeleteConfirm(p)}
                        className="rounded p-1.5 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                        title="Delete voucher"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PromoTable
          filtered={filtered}
          productMap={productMap}
          onToggle={toggleActive}
          onEdit={openEditModal}
          onDelete={(p) => void openDeleteConfirm(p)}
        />
      )}

      <ModalForm
        open={modalOpen && tab !== "active"}
        onClose={closeModal}
        title={
          modalMode === "edit"
            ? `Edit ${tab === "b2f1" ? "B2F1" : tab === "pwp" ? "PWP" : "Voucher"}`
            : `Add ${tab === "b2f1" ? "Buy 2 Free 1" : tab === "pwp" ? "Purchase with Purchase" : "Voucher"}`
        }
        onSubmit={handleCreate}
        footer={
          <>
            <ModalCancelButton onClick={closeModal} />
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : modalMode === "edit" ? (
                "Save changes"
              ) : (
                "Create"
              )}
            </button>
          </>
        }
      >
        {modalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {modalError}
          </div>
        )}

        {tab === "b2f1" && (
          <>
            <input
              required
              placeholder="Promotion name"
              className="input-field"
              value={b2f1Form.name}
              onChange={(e) => setB2f1Form({ ...b2f1Form, name: e.target.value })}
            />
            <select
              required
              className="input-field"
              value={b2f1Form.product_id}
              onChange={(e) => setB2f1Form({ ...b2f1Form, product_id: e.target.value })}
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                type="number"
                min="1"
                placeholder="Min qty"
                className="input-field"
                value={b2f1Form.min_qty}
                onChange={(e) => setB2f1Form({ ...b2f1Form, min_qty: e.target.value })}
              />
              <input
                required
                type="number"
                min="1"
                placeholder="Free qty"
                className="input-field"
                value={b2f1Form.free_qty}
                onChange={(e) => setB2f1Form({ ...b2f1Form, free_qty: e.target.value })}
              />
            </div>
            <select
              className="input-field"
              value={b2f1Form.applies_to}
              onChange={(e) =>
                setB2f1Form({ ...b2f1Form, applies_to: e.target.value as MemberTier | "all" })
              }
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </>
        )}

        {tab === "pwp" && (
          <>
            <ModalField label="Promotion name *">
              <input
                required
                className="input-field"
                value={pwpForm.name}
                onChange={(e) => setPwpForm({ ...pwpForm, name: e.target.value })}
              />
            </ModalField>
            <ModalField label="Trigger product *">
              <select
                required
                className="input-field"
                value={pwpForm.product_id}
                onChange={(e) => setPwpForm({ ...pwpForm, product_id: e.target.value })}
              >
                <option value="">Select qualifying product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="PWP reward product *">
              <select
                required
                className="input-field"
                value={pwpForm.reward_product_id}
                onChange={(e) =>
                  setPwpForm({ ...pwpForm, reward_product_id: e.target.value })
                }
              >
                <option value="">Select reward product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="Special reward price (RM) *">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={pwpForm.reward_price}
                onChange={(e) => setPwpForm({ ...pwpForm, reward_price: e.target.value })}
              />
            </ModalField>
            <ModalField label="Tier eligibility">
              <select
                className="input-field"
                value={pwpForm.applies_to}
                onChange={(e) =>
                  setPwpForm({ ...pwpForm, applies_to: e.target.value as MemberTier | "all" })
                }
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Start date">
                <input
                  type="date"
                  className="input-field"
                  value={pwpForm.start_date}
                  onChange={(e) => setPwpForm({ ...pwpForm, start_date: e.target.value })}
                />
              </ModalField>
              <ModalField label="End date">
                <input
                  type="date"
                  className="input-field"
                  value={pwpForm.end_date}
                  onChange={(e) => setPwpForm({ ...pwpForm, end_date: e.target.value })}
                />
              </ModalField>
            </div>
            <ModalField label="Status">
              <button
                type="button"
                onClick={() => setPwpForm({ ...pwpForm, is_active: !pwpForm.is_active })}
                className="inline-flex items-center gap-2 text-sm text-[#64748b]"
              >
                {pwpForm.is_active ? (
                  <ToggleRight className="h-6 w-6 text-emerald-500" />
                ) : (
                  <ToggleLeft className="h-6 w-6" />
                )}
                <span className={pwpForm.is_active ? "text-emerald-700" : "text-[#64748b]"}>
                  {pwpForm.is_active ? "Active" : "Inactive"}
                </span>
              </button>
            </ModalField>
          </>
        )}

        {tab === "voucher" && (
          <>
            <ModalField label="Voucher name *">
              <input
                required
                className="input-field"
                value={voucherForm.name}
                onChange={(e) => setVoucherForm({ ...voucherForm, name: e.target.value })}
              />
            </ModalField>
            <ModalField label="Voucher code *">
              <input
                required
                className="input-field uppercase"
                value={voucherForm.voucher_code}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, voucher_code: e.target.value })
                }
                placeholder="e.g. WELCOME10"
              />
            </ModalField>
            <ModalField label="Discount type">
              <select
                className="input-field"
                value={voucherForm.discount_type}
                onChange={(e) =>
                  setVoucherForm({
                    ...voucherForm,
                    discount_type: e.target.value as "fixed" | "percent",
                  })
                }
              >
                <option value="fixed">Fixed amount (RM)</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </ModalField>
            <ModalField label="Discount value *">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={voucherForm.discount_value}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, discount_value: e.target.value })
                }
              />
            </ModalField>
            <ModalField label="Minimum spend (optional)">
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={voucherForm.min_spend}
                onChange={(e) => setVoucherForm({ ...voucherForm, min_spend: e.target.value })}
                placeholder="Leave blank for no minimum"
              />
            </ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Total usage limit">
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={voucherForm.max_uses}
                  onChange={(e) => setVoucherForm({ ...voucherForm, max_uses: e.target.value })}
                  placeholder="Unlimited"
                />
              </ModalField>
              <ModalField label="Per-member limit">
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={voucherForm.max_uses_per_member}
                  onChange={(e) =>
                    setVoucherForm({ ...voucherForm, max_uses_per_member: e.target.value })
                  }
                  placeholder="Unlimited"
                />
              </ModalField>
            </div>
            <ModalField label="Tier eligibility">
              <select
                className="input-field"
                value={voucherForm.applies_to}
                onChange={(e) =>
                  setVoucherForm({
                    ...voucherForm,
                    applies_to: e.target.value as MemberTier | "all",
                  })
                }
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Start date">
                <input
                  type="date"
                  className="input-field"
                  value={voucherForm.start_date}
                  onChange={(e) =>
                    setVoucherForm({ ...voucherForm, start_date: e.target.value })
                  }
                />
              </ModalField>
              <ModalField label="End date">
                <input
                  type="date"
                  className="input-field"
                  value={voucherForm.end_date}
                  onChange={(e) => setVoucherForm({ ...voucherForm, end_date: e.target.value })}
                />
              </ModalField>
            </div>
            <ModalField label="Status">
              <button
                type="button"
                onClick={() =>
                  setVoucherForm({ ...voucherForm, is_active: !voucherForm.is_active })
                }
                className="inline-flex items-center gap-2 text-sm text-[#64748b]"
              >
                {voucherForm.is_active ? (
                  <ToggleRight className="h-6 w-6 text-emerald-500" />
                ) : (
                  <ToggleLeft className="h-6 w-6" />
                )}
                <span
                  className={voucherForm.is_active ? "text-emerald-700" : "text-[#64748b]"}
                >
                  {voucherForm.is_active ? "Active" : "Inactive"}
                </span>
              </button>
            </ModalField>
            <p className="text-xs text-[#94a3b8]">
              Vouchers are stored in the promotions table and apply at cashier checkout via the
              existing voucher code lookup.
            </p>
          </>
        )}
      </ModalForm>

      <Modal
        open={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteError(null);
        }}
        title={deleteMode === "deactivate" ? "Deactivate promotion?" : "Delete promotion?"}
        size="narrow"
        footer={
          <>
            <ModalCancelButton
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteError(null);
              }}
            />
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className={deleteMode === "deactivate" ? "btn-primary" : "btn-danger"}
            >
              {deleting ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : deleteMode === "deactivate" ? (
                "Deactivate"
              ) : (
                "Delete"
              )}
            </button>
          </>
        }
      >
        {deleteError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {deleteError}
          </div>
        )}
        <p className="text-sm text-[#64748b]">
          {deleteMode === "deactivate" ? (
            <>
              <span className="font-medium text-[#0f172a]">{deleteConfirm?.name}</span> has
              redemption history. It will be deactivated instead of deleted to preserve records.
            </>
          ) : (
            <>
              Are you sure you want to delete{" "}
              <span className="font-medium text-[#0f172a]">{deleteConfirm?.name}</span>? This
              action cannot be undone.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}

function PromoTable({
  filtered,
  productMap,
  onToggle,
  onEdit,
  onDelete,
}: {
  filtered: Promotion[];
  productMap: Record<string, string>;
  onToggle: (p: Promotion) => void;
  onEdit: (p: Promotion) => void;
  onDelete: (p: Promotion) => void;
}) {
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Details</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Applies To</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Status</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-[#64748b]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id} className="table-row group">
              <td className="px-4 font-medium text-[#0f172a]">{p.name}</td>
              <td className="px-4 text-[#64748b]">
                {p.type === "b2f1" &&
                  `Buy ${p.min_qty} get ${p.free_qty} free — ${productMap[p.product_id ?? ""] ?? "—"}`}
                {p.type === "pwp" &&
                  `${productMap[p.product_id ?? ""] ?? "—"} → ${productMap[p.reward_product_id ?? ""] ?? "—"} at ${formatRM(Number(p.reward_price))}`}
                {p.type === "voucher" &&
                  `${p.voucher_code} — ${p.discount_type === "percent" ? `${p.discount_value}%` : formatRM(Number(p.discount_value))}${p.end_date ? ` (ends ${formatDate(p.end_date)})` : ""}`}
              </td>
              <td className="px-4 capitalize text-[#64748b]">{p.applies_to}</td>
              <td className="px-4">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.is_active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onToggle(p)}
                    className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
                    title="Toggle active"
                  >
                    {p.is_active ? (
                      <ToggleRight className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  {(p.type === "pwp" || p.type === "voucher") && (
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#2563eb]"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    className="rounded p-1.5 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

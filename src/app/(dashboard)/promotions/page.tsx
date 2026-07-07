"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Inbox, Loader2, Plus, Tag, Ticket, ToggleLeft, ToggleRight } from "lucide-react";
import { ModalCancelButton, ModalForm } from "@/components/Modal";
import { supabase } from "@/lib/supabase";
import { formatDate, formatRM } from "@/lib/utils";
import type { MemberTier, Product, Promotion } from "@/types/database";

type Tab = "b2f1" | "pwp" | "voucher" | "active";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("b2f1");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [b2f1Form, setB2f1Form] = useState({ name: "", product_id: "", min_qty: "2", free_qty: "1", applies_to: "all" as MemberTier | "all" });
  const [pwpForm, setPwpForm] = useState({ name: "", product_id: "", reward_product_id: "", reward_price: "", applies_to: "all" as MemberTier | "all" });
  const [voucherForm, setVoucherForm] = useState({ name: "", voucher_code: "", discount_type: "fixed" as "fixed" | "percent", discount_value: "", max_uses: "", expiry_date: "" });

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

  useEffect(() => { fetchData(); }, [fetchData]);

  const productMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    if (tab === "active") return promotions.filter((p) => p.is_active);
    return promotions.filter((p) => p.type === tab);
  }, [promotions, tab]);

  async function toggleActive(promo: Promotion) {
    const { error: err } = await supabase.from("promotions").update({ is_active: !promo.is_active } as never).eq("id", promo.id);
    if (err) setError(err.message);
    else await fetchData();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let payload: Partial<Promotion> = { is_active: true };

    if (tab === "b2f1") {
      payload = {
        ...payload, type: "b2f1", name: b2f1Form.name.trim(),
        product_id: b2f1Form.product_id, min_qty: parseInt(b2f1Form.min_qty, 10),
        free_qty: parseInt(b2f1Form.free_qty, 10), applies_to: b2f1Form.applies_to,
      };
    } else if (tab === "pwp") {
      payload = {
        ...payload, type: "pwp", name: pwpForm.name.trim(),
        product_id: pwpForm.product_id, reward_product_id: pwpForm.reward_product_id,
        reward_price: parseFloat(pwpForm.reward_price), applies_to: pwpForm.applies_to,
      };
    } else if (tab === "voucher") {
      payload = {
        ...payload, type: "voucher", name: voucherForm.name.trim(),
        voucher_code: voucherForm.voucher_code.trim().toUpperCase(),
        discount_type: voucherForm.discount_type,
        discount_value: parseFloat(voucherForm.discount_value),
        max_uses: voucherForm.max_uses ? parseInt(voucherForm.max_uses, 10) : null,
        expiry_date: voucherForm.expiry_date || null, uses_count: 0,
      };
    } else return;

    const { error: err } = await supabase.from("promotions").insert([payload] as never);
    if (err) setError(err.message);
    else {
      setModalOpen(false);
      await fetchData();
    }
    setSaving(false);
  }

  const tabs: { id: Tab; label: string; icon: typeof Tag }[] = [
    { id: "b2f1", label: "B2F1", icon: Gift },
    { id: "pwp", label: "PWP", icon: Tag },
    { id: "voucher", label: "Vouchers", icon: Ticket },
    { id: "active", label: "Active", icon: ToggleRight },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Promotions</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">Buy deals, PWP offers, and vouchers</p>
        </div>
        {tab !== "active" && (
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="h-4 w-4" />
            Add {tab === "b2f1" ? "B2F1" : tab === "pwp" ? "PWP" : "Voucher"}
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

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

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#64748b]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-[#64748b]">
            <Inbox className="mb-2 h-8 w-8 text-[#cbd5e1]" />
            <p className="text-sm">No promotions in this category</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Details</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Applies To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="px-4 font-medium text-[#0f172a]">{p.name}</td>
                  <td className="px-4 text-[#64748b]">
                    {p.type === "b2f1" && `Buy ${p.min_qty} get ${p.free_qty} free — ${productMap[p.product_id ?? ""] ?? "—"}`}
                    {p.type === "pwp" && `${productMap[p.product_id ?? ""] ?? "—"} → ${productMap[p.reward_product_id ?? ""] ?? "—"} at ${formatRM(Number(p.reward_price))}`}
                    {p.type === "voucher" && `${p.voucher_code} — ${p.discount_type === "percent" ? `${p.discount_value}%` : formatRM(Number(p.discount_value))}${p.expiry_date ? ` (exp ${formatDate(p.expiry_date)})` : ""}`}
                  </td>
                  <td className="px-4 capitalize text-[#64748b]">{p.applies_to}</td>
                  <td className="px-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4">
                    <button type="button" onClick={() => toggleActive(p)} className="text-[#64748b] hover:text-[#2563eb]" title="Toggle active">
                      {p.is_active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalForm
        open={modalOpen && tab !== "active"}
        onClose={() => setModalOpen(false)}
        title={`Add ${tab === "b2f1" ? "Buy 2 Free 1" : tab === "pwp" ? "Purchase with Purchase" : "Voucher"}`}
        onSubmit={handleCreate}
        footer={
          <>
            <ModalCancelButton onClick={() => setModalOpen(false)} />
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create"}
            </button>
          </>
        }
      >
        {tab === "b2f1" && (
          <>
            <input required placeholder="Promotion name" className="input-field" value={b2f1Form.name} onChange={(e) => setB2f1Form({ ...b2f1Form, name: e.target.value })} />
            <select required className="input-field" value={b2f1Form.product_id} onChange={(e) => setB2f1Form({ ...b2f1Form, product_id: e.target.value })}>
              <option value="">Select product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input required type="number" min="1" placeholder="Min qty" className="input-field" value={b2f1Form.min_qty} onChange={(e) => setB2f1Form({ ...b2f1Form, min_qty: e.target.value })} />
              <input required type="number" min="1" placeholder="Free qty" className="input-field" value={b2f1Form.free_qty} onChange={(e) => setB2f1Form({ ...b2f1Form, free_qty: e.target.value })} />
            </div>
            <select className="input-field" value={b2f1Form.applies_to} onChange={(e) => setB2f1Form({ ...b2f1Form, applies_to: e.target.value as MemberTier | "all" })}>
              <option value="all">All tiers</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </>
        )}
        {tab === "pwp" && (
          <>
            <input required placeholder="Promotion name" className="input-field" value={pwpForm.name} onChange={(e) => setPwpForm({ ...pwpForm, name: e.target.value })} />
            <select required className="input-field" value={pwpForm.product_id} onChange={(e) => setPwpForm({ ...pwpForm, product_id: e.target.value })}>
              <option value="">Trigger product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select required className="input-field" value={pwpForm.reward_product_id} onChange={(e) => setPwpForm({ ...pwpForm, reward_product_id: e.target.value })}>
              <option value="">Reward product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input required type="number" step="0.01" min="0" placeholder="Reward price" className="input-field" value={pwpForm.reward_price} onChange={(e) => setPwpForm({ ...pwpForm, reward_price: e.target.value })} />
            <select className="input-field" value={pwpForm.applies_to} onChange={(e) => setPwpForm({ ...pwpForm, applies_to: e.target.value as MemberTier | "all" })}>
              <option value="all">All tiers</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </>
        )}
        {tab === "voucher" && (
          <>
            <input required placeholder="Voucher name" className="input-field" value={voucherForm.name} onChange={(e) => setVoucherForm({ ...voucherForm, name: e.target.value })} />
            <input required placeholder="Code" className="input-field uppercase" value={voucherForm.voucher_code} onChange={(e) => setVoucherForm({ ...voucherForm, voucher_code: e.target.value })} />
            <select className="input-field" value={voucherForm.discount_type} onChange={(e) => setVoucherForm({ ...voucherForm, discount_type: e.target.value as "fixed" | "percent" })}>
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percentage</option>
            </select>
            <input required type="number" step="0.01" min="0" placeholder="Value" className="input-field" value={voucherForm.discount_value} onChange={(e) => setVoucherForm({ ...voucherForm, discount_value: e.target.value })} />
            <input type="number" min="1" placeholder="Max uses (optional)" className="input-field" value={voucherForm.max_uses} onChange={(e) => setVoucherForm({ ...voucherForm, max_uses: e.target.value })} />
            <input type="date" className="input-field" value={voucherForm.expiry_date} onChange={(e) => setVoucherForm({ ...voucherForm, expiry_date: e.target.value })} />
          </>
        )}
      </ModalForm>
    </div>
  );
}

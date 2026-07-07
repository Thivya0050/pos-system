"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImageIcon, Inbox, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Modal, ModalCancelButton, ModalField, ModalForm } from "@/components/Modal";
import { PinConfirmModal } from "@/components/PinConfirmModal";
import { useManagerPinGate } from "@/hooks/useManagerPinGate";
import { supabase } from "@/lib/supabase";
import { formatRM } from "@/lib/utils";
import type { Category, Product } from "@/types/database";

function stockIndicator(stock: number) {
  if (stock === 0) return { color: "bg-red-500", label: "Out of stock" };
  if (stock <= 10) return { color: "bg-orange-500", label: "Low" };
  if (stock <= 50) return { color: "bg-amber-400", label: "Medium" };
  return { color: "bg-emerald-500", label: "Good" };
}

const emptyForm = {
  name: "",
  barcode: "",
  category_id: "",
  normal_price: "",
  member_price: "",
  gold_price: "",
  platinum_price: "",
  stock: "",
  requires_prescription: false,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { pinOpen, requestPin, closePin, onPinSuccess } = useManagerPinGate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [prodRes, catRes] = await Promise.all([
      supabase.from("products").select("*, categories(*)").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (prodRes.error) setError(prodRes.error.message);
    else if (catRes.error) setError(catRes.error.message);
    setProducts((prodRes.data ?? []) as Product[]);
    setCategories(catRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode?.includes(q) ?? false);
      const matchesCat =
        categoryFilter === "all" || p.category_id === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, search, categoryFilter]);

  function openCreateModal() {
    setModalMode("create");
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setModalMode("edit");
    setEditingProduct(product);
    setForm({
      name: product.name,
      barcode: product.barcode ?? "",
      category_id: product.category_id ?? "",
      normal_price: String(product.normal_price),
      member_price: String(product.member_price),
      gold_price: product.gold_price != null ? String(product.gold_price) : "",
      platinum_price: product.platinum_price != null ? String(product.platinum_price) : "",
      stock: String(product.stock),
      requires_prescription: product.requires_prescription,
    });
    setImageFile(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("product-images")
        .upload(path, imageFile);
      if (uploadErr) {
        setError(uploadErr.message);
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      category_id: form.category_id || null,
      normal_price: parseFloat(form.normal_price),
      member_price: parseFloat(form.member_price),
      gold_price: form.gold_price ? parseFloat(form.gold_price) : null,
      platinum_price: form.platinum_price ? parseFloat(form.platinum_price) : null,
      stock: parseInt(form.stock, 10) || 0,
      image_url: imageUrl ?? (modalMode === "edit" ? editingProduct?.image_url ?? null : null),
      requires_prescription: form.requires_prescription,
      ...(modalMode === "create" ? { is_active: true } : {}),
    };

    if (modalMode === "create") {
      const { error: insertErr } = await supabase.from("products").insert([payload] as never);
      if (insertErr) setError(insertErr.message);
      else {
        closeModal();
        await fetchData();
      }
    } else if (editingProduct) {
      const { error: updateErr } = await supabase
        .from("products")
        .update(payload as never)
        .eq("id", editingProduct.id);
      if (updateErr) setError(updateErr.message);
      else {
        closeModal();
        await fetchData();
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    setError(null);
    const { error: deleteErr } = await supabase
      .from("products")
      .delete()
      .eq("id", deleteConfirm.id);
    if (deleteErr) setError(deleteErr.message);
    else {
      setDeleteConfirm(null);
      await fetchData();
    }
    setDeleting(false);
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Products</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">Manage inventory and pricing</p>
        </div>
        <button type="button" onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {error && <ErrorBanner error={error} onRetry={() => void fetchData()} />}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input type="text" placeholder="Search products or barcode..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-field w-full sm:w-48">
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#64748b]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-[#64748b]">
            <Inbox className="mb-2 h-8 w-8 text-[#cbd5e1]" />
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Product</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Category</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Normal</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Member</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Stock</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Rx</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[#64748b]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stock = stockIndicator(p.stock);
                const cat = (p.categories as Category | null)?.name ?? "—";
                return (
                  <tr key={p.id} className="table-row group">
                    <td className="px-4">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f1f5f9]">
                            <ImageIcon className="h-4 w-4 text-[#94a3b8]" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-[#0f172a]">{p.name}</p>
                          {p.barcode && <p className="text-xs text-[#64748b]">{p.barcode}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 text-[#64748b]">{cat}</td>
                    <td className="px-4 text-[#0f172a]">{formatRM(Number(p.normal_price))}</td>
                    <td className="px-4 text-[#0f172a]">{formatRM(Number(p.member_price))}</td>
                    <td className="px-4">
                      <span className="inline-flex items-center gap-2 text-[#64748b]">
                        <span className={`h-2 w-2 rounded-full ${stock.color}`} />
                        {p.stock} ({stock.label})
                      </span>
                    </td>
                    <td className="px-4">
                      {p.requires_prescription ? (
                        <span title="Prescription required">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </span>
                      ) : (
                        <span className="text-[#94a3b8]">—</span>
                      )}
                    </td>
                    <td className="px-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => requestPin(() => openEditModal(p))}
                          className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#2563eb]"
                          title="Edit product"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestPin(() => setDeleteConfirm(p))}
                          className="rounded p-1.5 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                          title="Delete product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <PinConfirmModal open={pinOpen} onClose={closePin} onSuccess={onPinSuccess} />

      <ModalForm
        open={modalOpen}
        onClose={closeModal}
        title={modalMode === "create" ? "Add Product" : "Edit Product"}
        size="wide"
        onSubmit={handleSubmit}
        footer={
          <>
            <ModalCancelButton onClick={closeModal} />
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : modalMode === "create" ? (
                "Add Product"
              ) : (
                "Save changes"
              )}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ModalField label="Name *">
            <input required className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </ModalField>
          <ModalField label="Barcode">
            <input className="input-field" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </ModalField>
          <ModalField label="Category">
            <select className="input-field" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </ModalField>
          <ModalField label="Normal Price *">
            <input required type="number" step="0.01" min="0" className="input-field" value={form.normal_price} onChange={(e) => setForm({ ...form, normal_price: e.target.value })} />
          </ModalField>
          <ModalField label="Member Price *">
            <input required type="number" step="0.01" min="0" className="input-field" value={form.member_price} onChange={(e) => setForm({ ...form, member_price: e.target.value })} />
          </ModalField>
          <ModalField label="Gold Price">
            <input type="number" step="0.01" min="0" className="input-field" value={form.gold_price} onChange={(e) => setForm({ ...form, gold_price: e.target.value })} />
          </ModalField>
          <ModalField label="Platinum Price">
            <input type="number" step="0.01" min="0" className="input-field" value={form.platinum_price} onChange={(e) => setForm({ ...form, platinum_price: e.target.value })} />
          </ModalField>
          <ModalField label="Stock *">
            <input required type="number" min="0" className="input-field" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </ModalField>
          <ModalField label="Image">
            <input type="file" accept="image/*" className="input-field text-xs" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          </ModalField>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" id="rx" checked={form.requires_prescription} onChange={(e) => setForm({ ...form, requires_prescription: e.target.checked })} />
            <label htmlFor="rx" className="text-sm text-[#64748b]">Requires prescription</label>
          </div>
        </div>
      </ModalForm>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete product?"
        size="narrow"
        footer={
          <>
            <ModalCancelButton onClick={() => setDeleteConfirm(null)} />
            <button type="button" disabled={deleting} onClick={handleDelete} className="btn-danger">
              {deleting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Delete"}
            </button>
          </>
        }
      >
        <p className="text-sm text-[#64748b]">
          Are you sure you want to delete {deleteConfirm?.name}?
        </p>
      </Modal>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ImageIcon,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Modal, ModalCancelButton, ModalField, ModalForm } from "@/components/Modal";
import { PinConfirmModal } from "@/components/PinConfirmModal";
import { useManagerPinGate } from "@/hooks/useManagerPinGate";
import { supabase } from "@/lib/supabase";
import { formatRM } from "@/lib/utils";
import type { Category, Product } from "@/types/database";

const IMAGE_BUCKET = "product-images";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

const emptyForm = {
  name: "",
  barcode: "",
  category_id: "",
  normal_price: "",
  member_price: "",
  stock: "",
  low_stock_threshold: String(DEFAULT_LOW_STOCK_THRESHOLD),
  requires_prescription: false,
};

function stockIndicator(stock: number, lowStockThreshold: number | null) {
  const threshold = lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  const mediumCap = threshold * 5;

  if (stock === 0) return { color: "bg-red-500", label: "Out of stock" };
  if (stock <= threshold) return { color: "bg-orange-500", label: "Low" };
  if (stock <= mediumCap) return { color: "bg-amber-400", label: "Medium" };
  return { color: "bg-emerald-500", label: "Good" };
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type ProductImageUploadProps = {
  existingUrl: string | null;
  uploading: boolean;
  error: string;
  onFileSelect: (file: File | null) => void;
  onError: (message: string) => void;
};

function ProductImageUpload({
  existingUrl,
  uploading,
  error,
  onFileSelect,
  onError,
}: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(existingUrl);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setPreview(existingUrl);
  }, [existingUrl]);

  function validateAndSelect(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      onError("Only JPG, PNG, and WebP images are allowed.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onError("Image must be smaller than 5MB.");
      return;
    }
    onError("");
    onFileSelect(file);
    setPreview(URL.createObjectURL(file));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSelect(file);
  }

  function clearImage() {
    onFileSelect(null);
    onError("");
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="sm:col-span-2">
      <p className="modal-label mb-2">Product image</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
          dragOver
            ? "border-[#2563eb] bg-[#eff6ff]"
            : "border-[#e2e8f0] bg-[#f8fafc] hover:border-[#94a3b8]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) validateAndSelect(file);
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-[#64748b]">
            <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
            <p className="text-sm">Uploading image…</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={preview}
              alt="Product preview"
              className="max-h-24 max-w-full rounded-lg object-contain"
            />
            <p className="text-xs text-[#64748b]">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#64748b]">
            <Upload className="h-8 w-8 text-[#94a3b8]" />
            <p className="text-sm font-medium text-[#0f172a]">
              Click to browse or drag image here
            </p>
            <p className="text-xs">JPG, PNG, WebP · max 5MB</p>
          </div>
        )}
      </div>

      {preview && !uploading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clearImage();
          }}
          className="mt-2 inline-flex items-center gap-1 text-xs text-[#64748b] hover:text-red-600"
        >
          <X className="h-3.5 w-3.5" />
          Remove image
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [imageRemoved, setImageRemoved] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<string | null>(null);
  const { pinOpen, requestPin, closePin, onPinSuccess } = useManagerPinGate();

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

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
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode?.toLowerCase().includes(q) ?? false);
      const matchesCat =
        categoryFilter === "all" || p.category_id === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, search, categoryFilter]);

  const hasFilters = search.trim() !== "" || categoryFilter !== "all";

  function openCreateModal() {
    setModalMode("create");
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setImageError("");
    setImageRemoved(false);
    setModalError(null);
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
      stock: String(product.stock),
      low_stock_threshold:
        product.low_stock_threshold != null
          ? String(product.low_stock_threshold)
          : String(DEFAULT_LOW_STOCK_THRESHOLD),
      requires_prescription: product.requires_prescription,
    });
    setImageFile(null);
    setImageError("");
    setImageRemoved(false);
    setModalError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setImageError("");
    setImageRemoved(false);
    setModalError(null);
  }

  async function uploadProductImage(
    file: File,
    productId: string | number
  ): Promise<string | null> {
    const path = `products/${productId}-${sanitizeFilename(file.name)}`;
    const { error: uploadErr } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setModalError(uploadErr.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    let imageUrl: string | null = imageRemoved
      ? null
      : editingProduct?.image_url ?? null;

    if (imageFile) {
      setUploadingImage(true);
      const uploadId = editingProduct?.id ?? Date.now();
      const uploadedUrl = await uploadProductImage(imageFile, uploadId);
      setUploadingImage(false);
      if (!uploadedUrl) {
        setSaving(false);
        return;
      }
      imageUrl = uploadedUrl;
    }

    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      category_id: form.category_id || null,
      normal_price: parseFloat(form.normal_price),
      member_price: parseFloat(form.member_price),
      stock: parseInt(form.stock, 10) || 0,
      low_stock_threshold:
        parseInt(form.low_stock_threshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD,
      image_url: imageUrl,
      requires_prescription: form.requires_prescription,
      ...(modalMode === "edit" && editingProduct
        ? {
            gold_price: editingProduct.gold_price,
            platinum_price: editingProduct.platinum_price,
          }
        : { gold_price: null, platinum_price: null }),
      ...(modalMode === "create" ? { is_active: true } : {}),
    };

    if (modalMode === "create") {
      const { error: insertErr } = await supabase
        .from("products")
        .insert([payload] as never);
      if (insertErr) {
        setModalError(insertErr.message);
      } else {
        closeModal();
        showToast("Product added successfully");
        await fetchData();
      }
    } else if (editingProduct) {
      const { error: updateErr } = await supabase
        .from("products")
        .update(payload as never)
        .eq("id", editingProduct.id);
      if (updateErr) {
        setModalError(updateErr.message);
      } else {
        closeModal();
        showToast("Product updated successfully");
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
    if (deleteErr) {
      setError(deleteErr.message);
    } else {
      setDeleteConfirm(null);
      showToast("Product deleted");
      await fetchData();
    }
    setDeleting(false);
  }

  const previewImageUrl =
    imageRemoved ? null : editingProduct?.image_url ?? null;

  return (
    <div className="h-full overflow-auto p-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] rounded-lg bg-[#0f172a] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Products</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">
            Manage inventory and pricing
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {error && <ErrorBanner error={error} onRetry={() => void fetchData()} />}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="search-bar flex-1">
          <Search className="search-bar-icon" />
          <input
            type="text"
            placeholder="Search products or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-bar-input"
            autoComplete="off"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field w-full sm:w-48"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-7 w-7 animate-spin text-[#64748b]" />
            <p className="text-sm text-[#64748b]">Loading products…</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-[#64748b]">
            <Inbox className="mb-3 h-10 w-10 text-[#cbd5e1]" />
            <p className="text-sm font-medium text-[#0f172a]">No products yet</p>
            <p className="mt-1 text-sm">Add your first product to get started.</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-[#64748b]">
            <Search className="mb-3 h-10 w-10 text-[#cbd5e1]" />
            <p className="text-sm font-medium text-[#0f172a]">
              No products match your filters
            </p>
            <p className="mt-1 text-sm">
              Try a different search term or category.
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("all");
                }}
                className="btn-secondary mt-4 px-4 py-2 text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                  Product
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                  Category
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                  Normal
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                  Member
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                  Stock
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                  Rx
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[#64748b]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stock = stockIndicator(
                  p.stock,
                  p.low_stock_threshold
                );
                const cat = (p.categories as Category | null)?.name ?? "—";
                return (
                  <tr key={p.id} className="table-row">
                    <td className="px-4">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            className="h-9 w-9 rounded-lg border border-[#e2e8f0] object-cover bg-white"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f1f5f9]">
                            <ImageIcon className="h-4 w-4 text-[#94a3b8]" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-[#0f172a]">{p.name}</p>
                          {p.barcode && (
                            <p className="text-xs text-[#64748b]">{p.barcode}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 text-[#64748b]">{cat}</td>
                    <td className="px-4 text-[#0f172a]">
                      {formatRM(Number(p.normal_price))}
                    </td>
                    <td className="px-4 text-[#0f172a]">
                      {formatRM(Number(p.member_price))}
                    </td>
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
                      <div className="flex items-center justify-end gap-1">
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
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="btn-primary px-4 py-2 text-sm"
            >
              {saving || uploadingImage ? (
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
        {modalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {modalError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <ProductImageUpload
            existingUrl={previewImageUrl}
            uploading={uploadingImage}
            error={imageError}
            onFileSelect={(file) => {
              setImageFile(file);
              if (!file) setImageRemoved(true);
              else setImageRemoved(false);
            }}
            onError={setImageError}
          />

          <ModalField label="Product name *">
            <input
              required
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </ModalField>
          <ModalField label="Barcode / SKU">
            <input
              className="input-field"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </ModalField>
          <ModalField label="Category">
            <select
              className="input-field"
              value={form.category_id}
              onChange={(e) =>
                setForm({ ...form, category_id: e.target.value })
              }
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Normal price *">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={form.normal_price}
              onChange={(e) =>
                setForm({ ...form, normal_price: e.target.value })
              }
            />
          </ModalField>
          <ModalField label="Member price *">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={form.member_price}
              onChange={(e) =>
                setForm({ ...form, member_price: e.target.value })
              }
            />
          </ModalField>
          <ModalField label="Stock quantity *">
            <input
              required
              type="number"
              min="0"
              className="input-field"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </ModalField>
          <ModalField label="Low-stock threshold *">
            <input
              required
              type="number"
              min="1"
              className="input-field"
              value={form.low_stock_threshold}
              onChange={(e) =>
                setForm({ ...form, low_stock_threshold: e.target.value })
              }
            />
          </ModalField>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="rx"
              checked={form.requires_prescription}
              onChange={(e) =>
                setForm({ ...form, requires_prescription: e.target.checked })
              }
            />
            <label htmlFor="rx" className="text-sm text-[#64748b]">
              Prescription required (Rx)
            </label>
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
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="btn-danger"
            >
              {deleting ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </button>
          </>
        }
      >
        <p className="text-sm text-[#64748b]">
          Are you sure you want to delete{" "}
          <span className="font-medium text-[#0f172a]">
            {deleteConfirm?.name}
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

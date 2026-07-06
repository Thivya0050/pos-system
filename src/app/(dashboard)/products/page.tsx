"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ProductRow } from "@/types/database";

type Category = "Food" | "Drinks" | "Snacks" | "Others";

type Product = {
  id: string;
  name: string;
  category: Category;
  price: number;
  stock: number;
};

const CATEGORIES: Category[] = ["Food", "Drinks", "Snacks", "Others"];

type FormState = {
  name: string;
  category: Category;
  price: string;
  stock: string;
};

const emptyForm: FormState = {
  name: "",
  category: "Food",
  price: "",
  stock: "",
};

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    price: Number(row.price),
    stock: row.stock,
  };
}

function formatRM(amount: number) {
  return `RM${amount.toFixed(2)}`;
}

function getStockStatus(stock: number) {
  if (stock === 0) {
    return { label: "Out of Stock", dot: "bg-red-500" };
  }
  if (stock <= 10) {
    return { label: "Low Stock", dot: "bg-amber-500" };
  }
  return { label: "In Stock", dot: "bg-gray-400" };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "All">("All");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (fetchError) {
      setError(fetchError.message);
      setProducts([]);
    } else {
      setProducts((data ?? []).map(mapProduct));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch = !query || p.name.toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "All" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      stock: product.stock.toString(),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const price = parseFloat(form.price);
    const stock = parseInt(form.stock, 10);

    if (!form.name.trim() || isNaN(price) || isNaN(stock)) return;

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      category: form.category,
      price,
      stock,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("products")
        .insert(payload);

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    await fetchProducts();
    setSaving(false);
    closeModal();
  }

  async function handleDelete(id: string) {
    setError(null);

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="p-8">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-[#0f0f0f]">Products</h2>
          <button
            type="button"
            onClick={openAddModal}
            disabled={loading}
            className="btn-primary shrink-0 px-4 py-2 text-sm"
          >
            + Add Product
          </button>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name..."
              disabled={loading}
              className="input-field h-11 pl-11 disabled:opacity-60"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as Category | "All")
            }
            disabled={loading}
            className="input-field h-11 disabled:opacity-60 sm:w-44"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="max-h-[calc(100vh-280px)] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="table-head border-b border-[#f0f0f0]">
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                      Name
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                      Category
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                      Price
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product.stock);
                    return (
                      <tr key={product.id} className="table-row group">
                        <td className="px-6 font-medium text-[#0f0f0f]">
                          {product.name}
                        </td>
                        <td className="px-6 text-[#6b7280]">
                          {product.category}
                        </td>
                        <td className="px-6 text-[#0f0f0f]">
                          {formatRM(product.price)}
                        </td>
                        <td className="px-6 text-[#6b7280]">
                          {product.stock}
                        </td>
                        <td className="px-6">
                          <span className="inline-flex items-center gap-2 text-xs text-[#6b7280]">
                            <span
                              className={`h-2 w-2 rounded-full ${status.dot}`}
                            />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6">
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="rounded-md p-2 text-[#6b7280] transition-colors hover:bg-[#f5f5f5] hover:text-[#0f0f0f]"
                              aria-label="Edit product"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(product.id)}
                              className="rounded-md p-2 text-[#6b7280] transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label="Delete product"
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
            </div>

            {filteredProducts.length === 0 && (
              <p className="py-12 text-center text-sm text-[#6b7280]">
                {products.length === 0
                  ? 'No products yet. Click "Add Product" to get started.'
                  : "No products match your filters."}
              </p>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-6 py-4">
              <h3 className="text-base font-semibold text-[#0f0f0f]">
                {editingId ? "Edit Product" : "Add Product"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-[#0f0f0f]"
                >
                  Product name
                </label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  disabled={saving}
                  placeholder="e.g. Nasi Lemak"
                  className="input-field disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="mb-1.5 block text-sm font-medium text-[#0f0f0f]"
                >
                  Category
                </label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      category: e.target.value as Category,
                    }))
                  }
                  disabled={saving}
                  className="input-field disabled:opacity-60"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="price"
                  className="mb-1.5 block text-sm font-medium text-[#0f0f0f]"
                >
                  Price (RM)
                </label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, price: e.target.value }))
                  }
                  required
                  disabled={saving}
                  placeholder="0.00"
                  className="input-field disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="stock"
                  className="mb-1.5 block text-sm font-medium text-[#0f0f0f]"
                >
                  Stock quantity
                </label>
                <input
                  id="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, stock: e.target.value }))
                  }
                  required
                  disabled={saving}
                  placeholder="0"
                  className="input-field disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-[#f0f0f0] px-4 py-2 text-sm font-medium text-[#6b7280] transition-colors hover:bg-[#fafafa] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

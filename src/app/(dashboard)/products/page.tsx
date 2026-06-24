"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
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
    return {
      label: "Out of Stock",
      className: "bg-red-500/10 text-red-600 ring-1 ring-red-500/20",
    };
  }
  if (stock <= 10) {
    return {
      label: "Low Stock",
      className: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20",
    };
  }
  return {
    label: "In Stock",
    className: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20",
  };
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

  const stats = useMemo(() => {
    const inStock = products.filter((p) => p.stock > 10).length;
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 10).length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    return {
      total: products.length,
      inStock,
      lowStock,
      outOfStock,
    };
  }, [products]);

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

  const statCards = [
    {
      label: "Total Products",
      value: stats.total,
      icon: Package,
      color: "text-[#6366f1]",
      bg: "bg-indigo-50",
    },
    {
      label: "In Stock",
      value: stats.inStock,
      icon: Package,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Low Stock",
      value: stats.lowStock,
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Out of Stock",
      value: stats.outOfStock,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => (
              <div key={stat.label} className="card rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}
                  >
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name..."
                disabled={loading}
                className="w-full rounded-xl bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as Category | "All")
              }
              disabled={loading}
              className="rounded-xl bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60 sm:w-44"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            disabled={loading}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#6366f1]" />
          </div>
        ) : (
          <div className="card overflow-hidden rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-6 py-4 font-semibold text-gray-600">
                    Name
                  </th>
                  <th className="px-6 py-4 font-semibold text-gray-600">
                    Category
                  </th>
                  <th className="px-6 py-4 font-semibold text-gray-600">
                    Price (RM)
                  </th>
                  <th className="px-6 py-4 font-semibold text-gray-600">
                    Stock quantity
                  </th>
                  <th className="px-6 py-4 font-semibold text-gray-600">
                    Status
                  </th>
                  <th className="px-6 py-4 font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => {
                  const status = getStockStatus(product.stock);
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors hover:bg-indigo-50/30 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                      }`}
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {product.category}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {formatRM(product.price)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {product.stock}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 active:scale-[0.97]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 active:scale-[0.97]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredProducts.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-500">
                {products.length === 0
                  ? 'No products yet. Click "Add Product" to get started.'
                  : "No products match your filters."}
              </p>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit Product" : "Add Product"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
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
                  className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
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
                  className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60"
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
                  className="mb-1.5 block text-sm font-medium text-slate-700"
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
                  className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="stock"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
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
                  className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60"
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

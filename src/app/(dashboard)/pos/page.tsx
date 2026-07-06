"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { setCartCount } from "@/lib/auth";
import {
  calculateOrderTotals,
  formatRM,
  PAYMENT_OPTIONS,
  type PaymentMethod,
} from "@/lib/order-utils";
import { supabase } from "@/lib/supabase";
import type { ProductRow } from "@/types/database";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
};

type CartItem = Product & { quantity: number };

type ReceiptData = {
  orderId: string;
  createdAt: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
};

const CATEGORY_FILTERS = ["All", "Food", "Drinks", "Snacks", "Others"] as const;

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    category: row.category,
    stock: row.stock,
  };
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<(typeof CATEGORY_FILTERS)[number]>("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentMethod>("cash");

  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [discountInput, setDiscountInput] = useState("");

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .gt("stock", 0)
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

  const itemsTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const totals = useMemo(
    () => calculateOrderTotals(itemsTotal, discountAmount),
    [itemsTotal, discountAmount]
  );

  useEffect(() => {
    const count = cart.reduce((n, i) => n + i.quantity, 0);
    setCartCount(count);
  }, [cart]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  function updateQuantity(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }

  function clearCart() {
    setCart([]);
    setDiscountAmount(0);
  }

  function openChargeModal() {
    if (cart.length === 0) return;
    setSelectedPayment("cash");
    setPaymentModalOpen(true);
  }

  function applyDiscount() {
    const value = parseFloat(discountInput);
    if (isNaN(value) || value < 0) return;

    let amount = 0;
    if (discountType === "percentage") {
      amount = itemsTotal * (Math.min(value, 100) / 100);
    } else {
      amount = value;
    }

    setDiscountAmount(Math.min(amount, itemsTotal));
    setDiscountModalOpen(false);
    setDiscountInput("");
  }

  function removeDiscount() {
    setDiscountAmount(0);
  }

  async function confirmPayment() {
    if (cart.length === 0) return;

    setProcessing(true);
    setError(null);

    const cartSnapshot = [...cart];
    const { itemsTotal: gross, discount, tax, total } = totals;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        subtotal: gross,
        discount,
        tax,
        total,
        payment_method: selectedPayment,
      })
      .select()
      .single();

    if (orderError || !order) {
      setError(orderError?.message ?? "Failed to create order.");
      setProcessing(false);
      return;
    }

    const orderItems = cartSnapshot.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      setError(itemsError.message);
      setProcessing(false);
      return;
    }

    setPaymentModalOpen(false);
    setReceipt({
      orderId: order.id,
      createdAt: order.created_at,
      items: cartSnapshot,
      subtotal: gross,
      discount,
      tax,
      total,
      paymentMethod: selectedPayment,
    });
    setProcessing(false);
    await fetchProducts();
  }

  function handleReceiptDone() {
    clearCart();
    setReceipt(null);
  }

  function handlePrint() {
    window.print();
  }

  const isBusy = processing;

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="shrink-0 bg-red-50 px-6 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex w-[60%] min-w-0 flex-col border-r border-[#f0f0f0] p-8">
          <div className="relative mb-6 shrink-0">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              disabled={loading}
              className="input-field h-11 pl-11 disabled:opacity-60"
            />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                disabled={loading}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                  categoryFilter === cat
                    ? "bg-black text-white"
                    : "border border-[#f0f0f0] text-[#6b7280] hover:border-black hover:text-black"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className="card flex min-h-[100px] flex-col p-4 text-left transition-all hover:border-black hover:shadow-md"
                    >
                      <span className="text-[15px] font-semibold text-[#0f0f0f]">
                        {product.name}
                      </span>
                      <span className="mt-2 text-lg font-bold text-black">
                        {formatRM(product.price)}
                      </span>
                      <span className="mt-auto pt-2 text-[11px] font-medium uppercase tracking-wide text-[#9ca3af]">
                        {product.category}
                      </span>
                    </button>
                  ))}
                </div>

                {filteredProducts.length === 0 && (
                  <p className="py-16 text-center text-sm text-[#6b7280]">
                    {products.length === 0
                      ? "No in-stock products available."
                      : "No products match your search."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex w-[40%] min-w-0 flex-col bg-white">
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-6 py-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#0f0f0f]">
                Order Summary
              </h3>
              {cart.length > 0 && (
                <span className="text-xs text-[#9ca3af]">
                  ({cart.reduce((n, i) => n + i.quantity, 0)} items)
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                disabled={isBusy}
                className="text-xs font-medium text-[#9ca3af] transition-colors hover:text-red-600 disabled:opacity-60"
              >
                Clear
              </button>
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-b border-[#f0f0f0] px-6 py-3">
              <button
                type="button"
                onClick={() => setDiscountModalOpen(true)}
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f0f0f0] py-2 text-sm font-medium text-[#6b7280] transition-colors hover:bg-[#fafafa] disabled:opacity-60"
              >
                <Tag className="h-4 w-4" />
                Add Discount
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShoppingCart className="mb-3 h-8 w-8 text-[#d1d5db]" />
                <p className="text-sm text-[#6b7280]">
                  Cart is empty. Tap a product to add it.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#f0f0f0]">
                {cart.map((item) => (
                  <li key={item.id} className="py-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[#0f0f0f]">{item.name}</p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        disabled={isBusy}
                        className="text-[#d1d5db] transition-colors hover:text-red-600 disabled:opacity-60"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          disabled={isBusy}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#f0f0f0] text-[#9ca3af] transition-colors hover:bg-[#fafafa] disabled:opacity-60"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm text-[#6b7280]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={isBusy}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#f0f0f0] text-[#9ca3af] transition-colors hover:bg-[#fafafa] disabled:opacity-60"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-[#0f0f0f]">
                        {formatRM(item.price * item.quantity)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-[#f0f0f0] bg-[#fafafa] px-6 py-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#6b7280]">
                <span>Subtotal</span>
                <span className="text-[#0f0f0f]">{formatRM(totals.itemsTotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-[#6b7280]">
                  <button
                    type="button"
                    onClick={removeDiscount}
                    className="hover:text-[#0f0f0f] hover:underline"
                  >
                    Discount
                  </button>
                  <span>-{formatRM(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#6b7280]">
                <span>Tax (8%)</span>
                <span className="text-[#0f0f0f]">{formatRM(totals.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-[#f0f0f0] pt-3 text-base font-semibold text-[#0f0f0f]">
                <span>Total</span>
                <span>{formatRM(totals.total)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={cart.length === 0 || isBusy}
              onClick={openChargeModal}
              className="btn-primary mt-5 flex h-12 w-full items-center justify-center text-base"
            >
              Place Order {formatRM(totals.total)}
            </button>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {paymentModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg card">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-6 py-4">
              <h3 className="text-base font-semibold text-[#111827]">
                Select Payment Method
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                disabled={processing}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-6">
              {PAYMENT_OPTIONS.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedPayment(method.id)}
                  disabled={processing}
                  className={`flex flex-col items-center rounded-lg border p-4 transition-colors ${
                    selectedPayment === method.id
                      ? "border-[#2563eb] bg-blue-50"
                      : "border-[#e5e7eb] hover:bg-gray-50"
                  }`}
                >
                  <method.Icon
                    className={`h-5 w-5 ${
                      selectedPayment === method.id
                        ? "text-[#2563eb]"
                        : "text-[#6b7280]"
                    }`}
                  />
                  <span className="mt-2 text-sm font-medium text-[#111827]">
                    {method.label}
                  </span>
                  <span className="mt-1 text-xs text-[#6b7280]">
                    {formatRM(totals.total)}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t border-[#f0f0f0] px-6 py-4">
              <button
                type="button"
                onClick={confirmPayment}
                disabled={processing}
                className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Payment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount modal */}
      {discountModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm card">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-6 py-4">
              <h3 className="text-base font-semibold text-[#111827]">
                Add Discount
              </h3>
              <button
                type="button"
                onClick={() => setDiscountModalOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex rounded-lg border border-[#f0f0f0] p-0.5">
                <button
                  type="button"
                  onClick={() => setDiscountType("percentage")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    discountType === "percentage"
                      ? "bg-black text-white"
                      : "text-[#6b7280]"
                  }`}
                >
                  Percentage %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("fixed")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    discountType === "fixed"
                      ? "bg-black text-white"
                      : "text-[#6b7280]"
                  }`}
                >
                  Fixed Amount RM
                </button>
              </div>

              <input
                type="number"
                min="0"
                step={discountType === "percentage" ? "1" : "0.01"}
                max={discountType === "percentage" ? "100" : undefined}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder={
                  discountType === "percentage" ? "e.g. 10" : "e.g. 5.00"
                }
                className="input-field"
              />

              <button
                type="button"
                onClick={applyDiscount}
                className="btn-primary w-full py-2.5 text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {receipt && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm card">
            <div className="receipt-print p-6 text-[#111827]">
              <div className="text-center">
                <h3 className="text-lg font-semibold">POS System</h3>
                <p className="mt-1 text-xs text-[#6b7280]">
                  {new Date(receipt.createdAt).toLocaleString("en-MY")}
                </p>
                <p className="mt-1 font-mono text-xs text-[#6b7280]">
                  Order #{receipt.orderId.slice(0, 8)}
                </p>
              </div>

              <div className="my-4 border-t border-dashed border-[#e5e7eb]" />

              <ul className="space-y-2 text-sm">
                {receipt.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span className="text-[#6b7280]">
                      {item.name} x{item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatRM(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="my-4 border-t border-dashed border-[#e5e7eb]" />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-[#6b7280]">
                  <span>Subtotal</span>
                  <span>{formatRM(receipt.subtotal)}</span>
                </div>
                {receipt.discount > 0 && (
                  <div className="flex justify-between text-[#6b7280]">
                    <span>Discount</span>
                    <span>-{formatRM(receipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#6b7280]">
                  <span>Tax (8%)</span>
                  <span>{formatRM(receipt.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-[#e5e7eb] pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatRM(receipt.total)}</span>
                </div>
                <div className="flex justify-between pt-1 text-[#6b7280]">
                  <span>Payment</span>
                  <span>
                    {PAYMENT_OPTIONS.find((p) => p.id === receipt.paymentMethod)
                      ?.label ?? receipt.paymentMethod}
                  </span>
                </div>
              </div>

              <p className="mt-6 text-center text-sm text-[#6b7280]">
                Thank you for your purchase!
              </p>
            </div>

            <div className="flex gap-3 border-t border-[#e5e7eb] p-4">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 rounded-md border border-[#e5e7eb] py-2.5 text-sm font-medium text-[#6b7280] hover:bg-gray-50"
              >
                Print Receipt
              </button>
              <button
                type="button"
                onClick={handleReceiptDone}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

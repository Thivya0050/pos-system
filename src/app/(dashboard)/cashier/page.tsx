"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Search,
  X,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Modal, ModalCancelButton } from "@/components/Modal";
import { getSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import {
  formatRM,
  formatTime,
  getInitials,
  getMemberPrice,
  getMemberPriceLabel,
  getTierBadgeClass,
  getTierPriceBadgeLabel,
  normalizeTier,
} from "@/lib/utils";
import type {
  Category,
  Member,
  PaymentMethod,
  Product,
  Promotion,
} from "@/types/database";

type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
  isFree: boolean;
  promoType: "b2f1" | "pwp" | null;
};

type ReceiptData = {
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  savings: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  pointsEarned: number;
  newBalance: number;
  member: Member | null;
};

const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  label: string;
  icon?: typeof CreditCard;
  variant?: "tng" | "qr";
}[] = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "touch_n_go", label: "TnG eWallet", variant: "tng" },
  { id: "qr_pay", label: "DuitNow QR", icon: QrCode, variant: "qr" },
];

function applyB2F1(items: CartItem[], promos: Promotion[]): CartItem[] {
  const result = items.map((i) => ({ ...i, isFree: false, promoType: null as CartItem["promoType"] }));
  promos
    .filter((p) => p.type === "b2f1" && p.is_active)
    .forEach((promo) => {
      const idx = result.findIndex((i) => i.product.id === promo.product_id);
      if (idx === -1 || !promo.min_qty || !promo.free_qty) return;
      const item = result[idx];
      const sets = Math.floor(item.quantity / promo.min_qty);
      const freeCount = sets * promo.free_qty;
      if (freeCount > 0) {
        result[idx] = { ...item, promoType: "b2f1" };
      }
    });
  return result;
}

function getFreeQuantity(item: CartItem, promos: Promotion[]): number {
  if (item.promoType !== "b2f1") return 0;
  const promo = promos.find(
    (p) => p.type === "b2f1" && p.product_id === item.product.id
  );
  if (!promo?.min_qty || !promo.free_qty) return 0;
  const sets = Math.floor(item.quantity / promo.min_qty);
  return sets * promo.free_qty;
}

function PaymentMethodLogo({
  option,
  isSelected,
}: {
  option: (typeof PAYMENT_OPTIONS)[number];
  isSelected: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (option.id === "cash") {
    return (
      <span
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: isSelected ? "#2563eb" : "#0f172a",
          lineHeight: 1,
        }}
      >
        RM
      </span>
    );
  }

  if (failed) {
    if (option.variant === "tng") {
      return (
        <span
          className="text-2xl font-bold leading-none"
          style={{ color: "#00A3E0" }}
        >
          TnG
        </span>
      );
    }
    if (option.icon) {
      return <option.icon className="h-7 w-7 text-[#64748b]" />;
    }
    return null;
  }

  if (option.id === "card") {
    return (
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="https://sgozgsnuadijxideszuu.supabase.co/storage/v1/object/public/payment-logos/visa-logo.png"
          style={{ height: 18, objectFit: "contain" }}
          alt="Visa"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            setFailed(true);
          }}
        />
        <img
          src="https://sgozgsnuadijxideszuu.supabase.co/storage/v1/object/public/payment-logos/mastercard-logo.png"
          style={{ height: 18, objectFit: "contain" }}
          alt="Mastercard"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            setFailed(true);
          }}
        />
      </div>
    );
  }

  if (option.id === "touch_n_go") {
    return (
      <img
        src="https://sgozgsnuadijxideszuu.supabase.co/storage/v1/object/public/payment-logos/tng-logo.png"
        style={{ height: 28, objectFit: "contain" }}
        alt="TnG eWallet"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          setFailed(true);
        }}
      />
    );
  }

  if (option.id === "qr_pay") {
    return (
      <img
        src="https://sgozgsnuadijxideszuu.supabase.co/storage/v1/object/public/payment-logos/duitnow-logo.png"
        style={{ height: 28, objectFit: "contain" }}
        alt="DuitNow QR"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          setFailed(true);
        }}
      />
    );
  }

  if (option.icon) {
    return <option.icon className="h-7 w-7 text-[#64748b]" />;
  }

  return null;
}

export default function CashierPage() {
  const session = getSession();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [memberSearch, setMemberSearch] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [memberResults, setMemberResults] = useState<Member[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<Promotion | null>(null);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherError, setVoucherError] = useState("");
  const [pointsRedeemed, setPointsRedeemed] = useState(false);
  const [pointsUsed, setPointsUsed] = useState(0);
  const [pointsDiscount, setPointsDiscount] = useState(0);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [branchName, setBranchName] = useState("Pharmacy");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: testData, error: testError } = await supabase
      .from("products")
      .select("*");

    console.log("=== PRODUCTS DEBUG ===");
    console.log("Data:", testData);
    console.log("Error:", testError);
    console.log("Count:", testData?.length);

    if (testError) {
      console.error("Supabase error:", testError.message);
      setError(testError.message);
      setLoading(false);
      return;
    }

    if (!testData || testData.length === 0) {
      console.log("No products found in database");
      setProducts([]);
      setLoading(false);
      return;
    }

    const [productRes, catRes, promoRes] = await Promise.all([
      supabase
        .from("products")
        .select(`
        *,
        categories (
          id,
          name
        )
      `)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("promotions").select("*").eq("is_active", true),
    ]);

    console.log("Products with categories:", productRes.data);
    console.log("Error:", productRes.error);

    if (productRes.error) {
      setError(productRes.error.message);
    } else if (catRes.error) {
      setError(catRes.error.message);
    } else if (promoRes.error) {
      setError(promoRes.error.message);
    } else {
      setProducts(productRes.data || []);
      setCategories(catRes.data ?? []);
      setPromotions(promoRes.data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (session?.branchId) {
      void (async () => {
        const { data } = await supabase
          .from("branches")
          .select("name")
          .eq("id", session.branchId)
          .single();
        const branch = data as { name?: string } | null;
        if (branch?.name) setBranchName(branch.name);
      })();
    }
  }, [session?.branchId]);

  useEffect(() => {
    if (!memberSearch.trim() || memberSearch.trim().length < 3) {
      setMemberResults([]);
      return;
    }
    const q = memberSearch.trim();
    supabase
      .from("members")
      .select("*")
      .or(`phone.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(5)
      .then(({ data }) => setMemberResults((data ?? []) as Member[]));
  }, [memberSearch]);

  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        unitPrice: getMemberPrice(item.product, member),
      }))
    );
  }, [member]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode?.toLowerCase().includes(q) ?? false);
      const matchCat =
        categoryFilter === "All" ||
        p.category_id === categoryFilter ||
        (p.categories as Category | null)?.name === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const cartWithPromos = useMemo(
    () => applyB2F1(cart, promotions),
    [cart, promotions]
  );

  const b2f1Savings = useMemo(() => {
    let savings = 0;
    cartWithPromos.forEach((item) => {
      if (item.promoType !== "b2f1") return;
      const promo = promotions.find(
        (p) => p.type === "b2f1" && p.product_id === item.product.id
      );
      if (!promo?.min_qty || !promo.free_qty) return;
      const sets = Math.floor(item.quantity / promo.min_qty);
      savings += sets * promo.free_qty * item.unitPrice;
    });
    return savings;
  }, [cartWithPromos, promotions]);

  const subtotal = useMemo(
    () =>
      cartWithPromos.reduce(
        (s, i) => s + i.unitPrice * i.quantity,
        0
      ),
    [cartWithPromos]
  );

  const memberSavings = useMemo(
    () =>
      cart.reduce((s, i) => {
        const normal = Number(i.product.normal_price) * i.quantity;
        const paid = i.unitPrice * i.quantity;
        return s + Math.max(0, normal - paid);
      }, 0),
    [cart]
  );

  const totalSavings =
    b2f1Savings + memberSavings + voucherDiscount + pointsDiscount;
  const settings = getSettings();
  const afterDiscounts = Math.max(0, subtotal - voucherDiscount - pointsDiscount);
  const tax = afterDiscounts * (settings.taxRate / 100);
  const total = afterDiscounts + tax;

  function getProductPromo(productId: string) {
    return promotions.find(
      (p) =>
        p.is_active &&
        (p.product_id === productId || p.reward_product_id === productId)
    );
  }

  function addToCart(product: Product) {
    const price = getMemberPrice(product, member);
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1, unitPrice: price }
            : i
        );
      }
      return [
        ...prev,
        { product, quantity: 1, unitPrice: price, isFree: false, promoType: null },
      ];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function resetVoucher() {
    setVoucherCode("");
    setAppliedVoucher(null);
    setVoucherDiscount(0);
    setVoucherError("");
  }

  function resetPoints() {
    setPointsRedeemed(false);
    setPointsUsed(0);
    setPointsDiscount(0);
  }

  function clearCart() {
    setCart([]);
    resetVoucher();
    resetPoints();
  }

  async function applyVoucher() {
    const code = voucherCode.trim();
    setVoucherError("");

    if (!code) {
      setVoucherError("Enter a voucher code");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: promo, error: fetchErr } = await supabase
      .from("promotions")
      .select("*")
      .eq("type", "voucher")
      .ilike("voucher_code", code)
      .eq("is_active", true)
      .single();

    if (fetchErr || !promo) {
      setVoucherError("Invalid or expired voucher code");
      return;
    }

    const voucher = promo as Promotion;

    if (voucher.end_date && voucher.end_date < today) {
      setVoucherError("Invalid or expired voucher code");
      return;
    }

    if (
      voucher.max_uses != null &&
      (voucher.uses_count ?? 0) >= voucher.max_uses
    ) {
      setVoucherError("Invalid or expired voucher code");
      return;
    }

    let discount = 0;
    if (voucher.discount_type === "fixed") {
      discount = Number(voucher.discount_value);
    } else if (voucher.discount_type === "percent") {
      discount = subtotal * (Number(voucher.discount_value) / 100);
    }

    setVoucherDiscount(Math.min(discount, subtotal));
    setAppliedVoucher(voucher);
    setVoucherError("");
  }

  function redeemPoints() {
    if (!member) return;
    if (member.points < 500) return;

    const maxPoints = Math.floor(subtotal * 0.3 * 100);
    const used = Math.min(member.points, maxPoints);
    setPointsUsed(used);
    setPointsDiscount(used / 100);
    setPointsRedeemed(true);
  }

  function removePoints() {
    resetPoints();
  }

  useEffect(() => {
    if (!appliedVoucher) return;
    if (appliedVoucher.discount_type === "fixed") {
      setVoucherDiscount(
        Math.min(Number(appliedVoucher.discount_value), subtotal)
      );
    } else if (appliedVoucher.discount_type === "percent") {
      setVoucherDiscount(
        Math.min(
          subtotal * (Number(appliedVoucher.discount_value) / 100),
          subtotal
        )
      );
    }
  }, [subtotal, appliedVoucher]);

  useEffect(() => {
    if (pointsRedeemed && member) {
      const maxPoints = Math.floor(subtotal * 0.3 * 100);
      const used = Math.min(member.points, maxPoints);
      setPointsUsed(used);
      setPointsDiscount(used / 100);
    }
  }, [subtotal, member, pointsRedeemed]);

  async function confirmPayment() {
    if (cart.length === 0 || !selectedPayment) return;
    setProcessing(true);
    setError(null);

    const currentSession = getSession();
    const branchId = currentSession?.branchId ?? null;
    const staffId = currentSession?.staffId ?? null;
    const orderNumber = "ORD-" + Date.now();
    const discountAmount = b2f1Savings + memberSavings;
    const pointsEarned = member
      ? Math.floor(
          total *
            (normalizeTier(member.tier) === "platinum"
              ? settings.pointsPerRmPlatinum
              : normalizeTier(member.tier) === "gold"
                ? settings.pointsPerRmGold
                : settings.pointsPerRmSilver)
        )
      : 0;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        branch_id: branchId,
        staff_id: staffId,
        member_id: member?.id ?? null,
        subtotal,
        discount_amount: discountAmount,
        voucher_discount: voucherDiscount,
        points_discount: pointsDiscount,
        tax,
        total,
        payment_method: selectedPayment,
        status: "completed",
        points_earned: pointsEarned,
        points_redeemed: pointsUsed,
      })
      .select()
      .single();

    if (orderErr || !order) {
      setError(orderErr?.message ?? "Failed to create order");
      setProcessing(false);
      return;
    }

    const orderItems = cartWithPromos.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      normal_price: Number(item.product.normal_price),
      sold_price: item.unitPrice,
      quantity: item.quantity,
      free_quantity: getFreeQuantity(item, promotions),
      promo_applied: item.promoType,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) {
      setError(itemsErr.message);
      setProcessing(false);
      return;
    }

    for (const item of cartWithPromos) {
      const { error: stockErr } = await supabase
        .from("products")
        .update({ stock: item.product.stock - item.quantity })
        .eq("id", item.product.id);
      if (stockErr) {
        setError(stockErr.message);
        setProcessing(false);
        return;
      }
    }

    let newBalance = member?.points ?? 0;
    if (member) {
      newBalance = member.points - pointsUsed + pointsEarned;
      const { error: memberErr } = await supabase
        .from("members")
        .update({
          points: newBalance,
          total_spend: member.total_spend + total,
        })
        .eq("id", member.id);

      if (memberErr) {
        setError(memberErr.message);
        setProcessing(false);
        return;
      }

      if (pointsEarned > 0) {
        await supabase.from("points_history").insert({
          member_id: member.id,
          order_id: order.id,
          points: pointsEarned,
          description: `Earned from order ${orderNumber}`,
        });
      }
      if (pointsUsed > 0) {
        await supabase.from("points_history").insert({
          member_id: member.id,
          order_id: order.id,
          points: -pointsUsed,
          description: `Redeemed on order ${orderNumber}`,
        });
      }
    }

    if (appliedVoucher) {
      await supabase
        .from("promotions")
        .update({ uses_count: (appliedVoucher.uses_count ?? 0) + 1 })
        .eq("id", appliedVoucher.id);
    }

    setPaymentOpen(false);
    setReceipt({
      orderNumber,
      items: cartWithPromos,
      subtotal,
      savings: totalSavings,
      tax,
      total,
      paymentMethod: selectedPayment,
      pointsEarned,
      newBalance,
      member,
    });
    setProcessing(false);
  }

  function handleDone() {
    setPaymentOpen(false);
    setReceipt(null);
    clearCart();
    setMember(null);
    setMemberSearch("");
    void (async () => {
      const { data } = await supabase
        .from("products")
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .eq("is_active", true)
        .order("name", { ascending: true });
      setProducts(data || []);
    })();
  }

  const itemCount = cart.reduce((n, i) => n + i.quantity, 0);
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const cashChange = cashReceivedNum - total;

  function openPaymentModal() {
    setSelectedPayment(null);
    setCashReceived("");
    setPaymentOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      {error && (
        <ErrorBanner
          error={error}
          onRetry={() => void fetchData()}
          className="shrink-0 rounded-none border-x-0 border-t-0"
        />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="flex w-[65%] min-w-0 flex-col border-r border-[#e2e8f0] p-4">
          <div className="search-bar mb-3">
            <Search className="search-bar-icon" />
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search member by phone or name..."
              className="search-bar-input"
              autoComplete="off"
            />
            {memberResults.length > 0 && !member && memberSearch.trim().length >= 3 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white shadow-lg">
                {memberResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMember({ ...m, tier: normalizeTier(m.tier) });
                      setMemberSearch("");
                      setMemberResults([]);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#f8fafc]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                      {getInitials(m.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-[#64748b]">{m.phone}</p>
                    </div>
                    <span className={`tier-badge shrink-0 ${getTierBadgeClass(m.tier)}`}>
                      {m.tier}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3">
            {member ? (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                    {getInitials(member.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0f172a]">{member.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`tier-badge ${getTierBadgeClass(member.tier)}`}>
                        {member.tier}
                      </span>
                      <span className="text-xs text-[#64748b]">{member.points} pts</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMember(null);
                    resetPoints();
                  }}
                  className="rounded p-1 text-[#64748b] hover:bg-blue-100 hover:text-[#0f172a]"
                  aria-label="Remove member"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8]">No member attached</p>
            )}
          </div>

          <div
            className="scrollbar-hide mb-3 flex gap-1.5 overflow-x-auto whitespace-nowrap"
            style={{ gap: "6px" }}
          >
            <button
              type="button"
              onClick={() => setCategoryFilter("All")}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                categoryFilter === "All"
                  ? "bg-[#2563eb] text-white"
                  : "border border-[#e2e8f0] text-[#64748b]"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  categoryFilter === c.id
                    ? "bg-[#2563eb] text-white"
                    : "border border-[#e2e8f0] text-[#64748b]"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="search-bar mb-3">
            <Search className="search-bar-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or barcode..."
              className="search-bar-input"
              autoComplete="off"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
              </div>
            ) : products.length === 0 ? (
              <p className="py-20 text-center text-sm text-[#64748b]">
                No products found
              </p>
            ) : filteredProducts.length === 0 ? (
              <p className="py-20 text-center text-sm text-[#64748b]">
                No products match your search
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product) => {
                  const promo = getProductPromo(product.id);
                  const normalPrice = Number(product.normal_price);
                  const price = getMemberPrice(product, member);
                  const showMemberPrice =
                    member != null && price < normalPrice;
                  const categoryName =
                    (product.categories as Category | null)?.name ?? "Uncategorized";
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className="flex min-h-[160px] flex-col overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white p-0 text-left transition-all hover:border-[#2563eb] hover:shadow-md"
                    >
                      <div className="px-2 pt-2">
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-[#94a3b8]">
                          {categoryName}
                        </span>
                      </div>
                      <div className="relative w-full">
                        {product.image_url ? (
                          <div
                            style={{
                              width: "100%",
                              height: "130px",
                              background: "#fff",
                              borderRadius: "8px 8px 0 0",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "8px",
                            }}
                          >
                            <img
                              src={product.image_url}
                              alt={product.name}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.parentElement!.innerHTML =
                                  '<div style="color:#cbd5e1;font-size:32px;display:flex;align-items:center;justify-content:center;height:100%">💊</div>';
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "130px",
                              background: "#f1f5f9",
                              borderRadius: "8px 8px 0 0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: "32px" }}>💊</span>
                          </div>
                        )}
                        {promo?.type === "b2f1" && (
                          <span className="absolute right-2 top-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            B2F1
                          </span>
                        )}
                        {promo?.type === "pwp" && (
                          <span className="absolute right-2 top-2 rounded bg-purple-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            PWP
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-3 pt-2">
                        <p className="line-clamp-2 text-[13px] font-bold text-[#0f172a]">
                          {product.name}
                        </p>
                        <div className="mt-auto pt-1">
                          {showMemberPrice && (
                            <p className="text-[11px] text-[#94a3b8] line-through">
                              {formatRM(normalPrice)}
                            </p>
                          )}
                          <p className="text-[15px] font-bold text-[#0f172a]">
                            {formatRM(showMemberPrice ? price : normalPrice)}
                          </p>
                          {showMemberPrice && member && (
                            <span className="mt-0.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              {getTierPriceBadgeLabel(member)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex w-[35%] min-w-0 flex-col bg-white">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
            <h3 className="font-semibold text-[#0f172a]">
              Order {itemCount > 0 && `(${itemCount})`}
            </h3>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-[#64748b] hover:text-red-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            {cart.length === 0 ? (
              <p className="py-16 text-center text-sm text-[#64748b]">
                Cart is empty
              </p>
            ) : (
              <ul className="divide-y divide-[#e2e8f0]">
                {cartWithPromos.map((item) => {
                  const priceLabel = getMemberPriceLabel(member);
                  const hasDiscount =
                    member != null &&
                    item.unitPrice < Number(item.product.normal_price);
                  return (
                  <li key={item.product.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      {item.product.image_url ? (
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            flexShrink: 0,
                            background: "#fff",
                            borderRadius: "6px",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px",
                          }}
                        >
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            style={{
                              maxWidth: "100%",
                              maxHeight: "100%",
                              objectFit: "contain",
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            flexShrink: 0,
                            background: "#f1f5f9",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: "20px" }}>💊</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#0f172a]">
                          {item.product.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#64748b]">
                          {formatRM(item.unitPrice)} each
                          {hasDiscount && priceLabel ? ` · ${priceLabel}` : ""}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQty(item.product.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded border border-[#e2e8f0] hover:bg-[#f8fafc]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.product.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded border border-[#e2e8f0] hover:bg-[#f8fafc]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-[#0f172a]">
                        {formatRM(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>

          {cart.length > 0 && (
            <div className="shrink-0 border-t border-[#e2e8f0] px-4 py-3">
              <div style={{ marginBottom: member ? "12px" : 0 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#64748b",
                    marginBottom: "6px",
                  }}
                >
                  Voucher Code
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    placeholder="Enter voucher code"
                    value={voucherCode}
                    onChange={(e) => {
                      setVoucherCode(e.target.value);
                      setVoucherError("");
                    }}
                    style={{
                      flex: 1,
                      border: "1px solid #e2e8f0",
                      borderRadius: "7px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void applyVoucher()}
                    style={{
                      padding: "8px 14px",
                      background: "#0f172a",
                      color: "white",
                      border: "none",
                      borderRadius: "7px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Apply
                  </button>
                </div>
                {voucherError && (
                  <div style={{ color: "red", fontSize: "11px", marginTop: "4px" }}>
                    {voucherError}
                  </div>
                )}
                {appliedVoucher && (
                  <div style={{ color: "green", fontSize: "11px", marginTop: "4px" }}>
                    ✓ {appliedVoucher.voucher_code} applied — RM
                    {voucherDiscount.toFixed(2)} off
                  </div>
                )}
              </div>

              {member && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#64748b",
                        }}
                      >
                        Redeem Points
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {member.points} pts available = RM
                        {(member.points / 100).toFixed(2)}
                      </div>
                      {member.points < 500 && (
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                          Minimum 500 pts required
                        </div>
                      )}
                    </div>
                    {!pointsRedeemed ? (
                      <button
                        type="button"
                        onClick={redeemPoints}
                        disabled={member.points < 500 || subtotal === 0}
                        style={{
                          fontSize: "11px",
                          color: "#2563eb",
                          background: "none",
                          border: "none",
                          cursor:
                            member.points < 500 || subtotal === 0
                              ? "not-allowed"
                              : "pointer",
                          opacity: member.points < 500 || subtotal === 0 ? 0.5 : 1,
                        }}
                      >
                        Use points
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={removePoints}
                        style={{
                          fontSize: "11px",
                          color: "#dc2626",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {pointsRedeemed && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#059669",
                        marginTop: "4px",
                      }}
                    >
                      ✓ {pointsUsed} pts redeemed = RM{pointsDiscount.toFixed(2)} off
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {cart.length > 0 && (
            <div className="shrink-0 border-t border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-[#64748b]">
                  <span>Subtotal</span>
                  <span>{formatRM(subtotal)}</span>
                </div>
                {voucherDiscount > 0 && appliedVoucher && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Voucher ({appliedVoucher.voucher_code})</span>
                    <span>-{formatRM(voucherDiscount)}</span>
                  </div>
                )}
                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Points redeemed</span>
                    <span>-{formatRM(pointsDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#64748b]">
                  <span>SST {settings.taxRate}%</span>
                  <span>{formatRM(tax)}</span>
                </div>
                <div className="flex justify-between border-t border-[#e2e8f0] pt-2 text-base font-semibold text-[#0f172a]">
                  <span>Total</span>
                  <span>{formatRM(total)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={openPaymentModal}
                className="btn-primary mt-4 flex h-12 w-full items-center justify-center text-base font-semibold"
              >
                Charge {formatRM(total)}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="no-print">
        <Modal
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          title="Select payment method"
          bodyClassName="modal-body--payment"
          footer={
            <>
              <ModalCancelButton onClick={() => setPaymentOpen(false)} />
              <button
                type="button"
                disabled={!selectedPayment || processing}
                onClick={confirmPayment}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPayment && !processing
                    ? "btn-primary"
                    : "cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8]"
                }`}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Confirm — ${formatRM(total)}`
                )}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_OPTIONS.map((opt) => {
              const isSelected = selectedPayment === opt.id;
              const isTng = opt.variant === "tng";
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedPayment(opt.id);
                    if (opt.id !== "cash") setCashReceived("");
                  }}
                  className={`payment-method-btn ${isSelected ? "payment-method-btn--selected" : ""} ${
                    isSelected && isTng ? "payment-method-btn--tng-selected" : ""
                  }`}
                >
                  <PaymentMethodLogo option={opt} isSelected={isSelected} />
                  <span className="payment-method-label">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {selectedPayment === "cash" && (
            <div className="payment-cash-row">
              <span className="shrink-0 font-medium text-[#64748b]">Cash received:</span>
              <input
                id="cash-received"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="payment-cash-input"
              />
              {cashReceivedNum > total && (
                <span className="shrink-0 font-medium text-[#059669]">
                  Change: {formatRM(cashChange)}
                </span>
              )}
            </div>
          )}
        </Modal>

        <Modal
          open={!!receipt}
          onClose={() => setReceipt(null)}
          title="Receipt"
          size="narrow"
          footer={
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary flex-1"
              >
                Print receipt
              </button>
              <button type="button" onClick={handleDone} className="btn-primary flex-1">
                Done
              </button>
            </div>
          }
        >
          {receipt && (
            <div className="receipt-print">
              <div className="text-center">
                <h3 className="text-lg font-bold">PharmaPOS</h3>
                <p className="text-xs text-[#64748b]">{branchName}</p>
                <p className="mt-2 font-mono text-sm">{receipt.orderNumber}</p>
                <p className="text-xs text-[#64748b]">
                  {new Date().toLocaleDateString("en-MY")} · {formatTime(new Date().toISOString())}
                </p>
                <p className="mt-1 text-sm">
                  {receipt.member
                    ? `${receipt.member.name} (${receipt.member.tier})`
                    : "Walk-in"}
                </p>
              </div>
              <div className="my-4 border-t border-dashed border-[#e2e8f0]" />
              <ul className="space-y-1 text-sm">
                {receipt.items.map((item) => (
                  <li key={item.product.id} className="flex justify-between">
                    <span>
                      {item.product.name} x{item.quantity}
                    </span>
                    <span>{formatRM(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="my-4 border-t border-dashed border-[#e2e8f0]" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRM(receipt.subtotal)}</span>
                </div>
                {receipt.savings > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Savings</span>
                    <span>-{formatRM(receipt.savings)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>SST</span>
                  <span>{formatRM(receipt.tax)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatRM(receipt.total)}</span>
                </div>
                {receipt.member && (
                  <>
                    <div className="flex justify-between text-emerald-600">
                      <span>Points earned</span>
                      <span>+{receipt.pointsEarned}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>New balance</span>
                      <span>{receipt.newBalance} pts</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

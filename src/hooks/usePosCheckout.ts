"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/auth";
import {
  applyB2F1,
  getFreeQuantity,
  type CartItem,
  type ReceiptData,
} from "@/lib/pos-checkout";
import { getSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import { getMemberPrice, normalizeTier } from "@/lib/utils";
import type {
  Category,
  Member,
  PaymentMethod,
  Product,
  Promotion,
} from "@/types/database";

async function resolveCheckoutContext() {
  const session = getSession();
  if (session?.branchId) {
    return {
      branchId: session.branchId,
      staffId: session.staffId ?? null,
    };
  }

  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("is_active", true)
    .order("name")
    .limit(1);

  return {
    branchId: data?.[0]?.id ?? null,
    staffId: session?.staffId ?? null,
  };
}

export type PosCheckoutOptions = {
  excludeRx?: boolean;
  allowVouchers?: boolean;
  allowPointsRedemption?: boolean;
};

export type AddToCartResult = "added" | "blocked_rx";

export function usePosCheckout(options: PosCheckoutOptions = {}) {
  const excludeRx = options.excludeRx ?? false;
  const allowVouchers = options.allowVouchers ?? true;
  const allowPointsRedemption = options.allowPointsRedemption ?? true;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("Pharmacy");
  const [branchId, setBranchId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [memberPhone, setMemberPhone] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [memberLookupError, setMemberLookupError] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<Promotion | null>(null);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherError, setVoucherError] = useState("");
  const [pointsRedeemed, setPointsRedeemed] = useState(false);
  const [pointsUsed, setPointsUsed] = useState(0);
  const [pointsDiscount, setPointsDiscount] = useState(0);

  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(
    null
  );
  const [cashReceived, setCashReceived] = useState("");
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const settings = getSettings();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [productRes, catRes, promoRes] = await Promise.all([
      supabase
        .from("products")
        .select(
          `
          *,
          categories (
            id,
            name
          )
        `
        )
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("promotions").select("*").eq("is_active", true),
    ]);

    if (productRes.error) {
      setError(productRes.error.message);
    } else if (catRes.error) {
      setError(catRes.error.message);
    } else if (promoRes.error) {
      setError(promoRes.error.message);
    } else {
      setProducts((productRes.data ?? []) as Product[]);
      setCategories(catRes.data ?? []);
      setPromotions(promoRes.data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void (async () => {
      const ctx = await resolveCheckoutContext();
      if (!ctx.branchId) return;

      setBranchId(ctx.branchId);

      const { data } = await supabase
        .from("branches")
        .select("name")
        .eq("id", ctx.branchId)
        .single();
      const branch = data as { name?: string } | null;
      if (branch?.name) setBranchName(branch.name);
    })();
  }, []);

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
      if (excludeRx && p.requires_prescription) return false;
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
  }, [products, search, categoryFilter, excludeRx]);

  const rxProductLookup = useMemo(() => {
    if (!excludeRx || !search.trim()) return null;
    const q = search.trim().toLowerCase();

    const barcodeMatch = products.find(
      (p) =>
        p.requires_prescription && p.barcode?.toLowerCase() === q
    );
    if (barcodeMatch) return barcodeMatch;

    if (filteredProducts.length > 0) return null;

    return (
      products.find(
        (p) =>
          p.requires_prescription &&
          (p.name.toLowerCase().includes(q) ||
            (p.barcode?.toLowerCase().includes(q) ?? false))
      ) ?? null
    );
  }, [excludeRx, search, products, filteredProducts]);

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
      cartWithPromos.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
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

  const effectiveVoucherDiscount = allowVouchers ? voucherDiscount : 0;
  const effectivePointsDiscount = allowPointsRedemption ? pointsDiscount : 0;
  const effectivePointsUsed = allowPointsRedemption ? pointsUsed : 0;

  const totalSavings =
    b2f1Savings +
    memberSavings +
    effectiveVoucherDiscount +
    effectivePointsDiscount;
  const afterDiscounts = Math.max(
    0,
    subtotal - effectiveVoucherDiscount - effectivePointsDiscount
  );
  const tax = afterDiscounts * (settings.taxRate / 100);
  const total = afterDiscounts + tax;
  const itemCount = cart.reduce((n, i) => n + i.quantity, 0);
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const cashChange = cashReceivedNum - total;

  function getProductPromo(productId: string) {
    return promotions.find(
      (p) =>
        p.is_active &&
        (p.product_id === productId || p.reward_product_id === productId)
    );
  }

  function addToCart(product: Product): AddToCartResult {
    if (excludeRx && product.requires_prescription) {
      return "blocked_rx";
    }

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
        {
          product,
          quantity: 1,
          unitPrice: price,
          isFree: false,
          promoType: null,
        },
      ];
    });
    return "added";
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
    if (!allowVouchers) return false;

    const code = voucherCode.trim();
    setVoucherError("");

    if (!code) {
      setVoucherError("Enter a voucher code");
      return false;
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
      return false;
    }

    const voucher = promo as Promotion;

    if (voucher.end_date && voucher.end_date < today) {
      setVoucherError("Invalid or expired voucher code");
      return false;
    }

    if (
      voucher.max_uses != null &&
      (voucher.uses_count ?? 0) >= voucher.max_uses
    ) {
      setVoucherError("Invalid or expired voucher code");
      return false;
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
    return true;
  }

  function redeemPoints() {
    if (!allowPointsRedemption) return;
    if (!member || member.points < 500) return;
    const maxPoints = Math.floor(subtotal * 0.3 * 100);
    const used = Math.min(member.points, maxPoints);
    setPointsUsed(used);
    setPointsDiscount(used / 100);
    setPointsRedeemed(true);
  }

  function removePoints() {
    resetPoints();
  }

  async function lookupMemberByPhone(phone: string) {
    setMemberLookupError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      setMemberLookupError("Enter a valid phone number");
      return null;
    }

    const { data, error: lookupErr } = await supabase
      .from("members")
      .select("*")
      .ilike("phone", `%${digits}%`)
      .limit(1)
      .maybeSingle();

    if (lookupErr || !data) {
      setMemberLookupError("Member not found");
      return null;
    }

    const found = { ...(data as Member), tier: normalizeTier((data as Member).tier) };
    setMember(found);
    setMemberPhone("");
    setMemberLookupError("");
    return found;
  }

  function removeMember() {
    setMember(null);
    setMemberPhone("");
    resetPoints();
    setMemberLookupError("");
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
    if (cart.length === 0 || !selectedPayment) return false;
    setProcessing(true);
    setError(null);

    const ctx = await resolveCheckoutContext();
    if (!ctx.branchId) {
      setError("No active branch configured");
      setProcessing(false);
      return false;
    }

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
        branch_id: ctx.branchId,
        staff_id: ctx.staffId,
        member_id: member?.id ?? null,
        subtotal,
        discount_amount: discountAmount,
        voucher_discount: effectiveVoucherDiscount,
        points_discount: effectivePointsDiscount,
        tax,
        total,
        payment_method: selectedPayment,
        status: "completed",
        points_earned: pointsEarned,
        points_redeemed: effectivePointsUsed,
      })
      .select()
      .single();

    if (orderErr || !order) {
      setError(orderErr?.message ?? "Failed to create order");
      setProcessing(false);
      return false;
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
      return false;
    }

    for (const item of cartWithPromos) {
      const { error: stockErr } = await supabase
        .from("products")
        .update({ stock: item.product.stock - item.quantity })
        .eq("id", item.product.id);
      if (stockErr) {
        setError(stockErr.message);
        setProcessing(false);
        return false;
      }
    }

    let newBalance = member?.points ?? 0;
    if (member) {
      newBalance = member.points - effectivePointsUsed + pointsEarned;
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
        return false;
      }

      if (pointsEarned > 0) {
        await supabase.from("points_history").insert({
          member_id: member.id,
          order_id: order.id,
          points: pointsEarned,
          description: `Earned from order ${orderNumber}`,
        });
      }
      if (effectivePointsUsed > 0) {
        await supabase.from("points_history").insert({
          member_id: member.id,
          order_id: order.id,
          points: -effectivePointsUsed,
          description: `Redeemed on order ${orderNumber}`,
        });
      }
    }

    if (allowVouchers && appliedVoucher) {
      await supabase
        .from("promotions")
        .update({ uses_count: (appliedVoucher.uses_count ?? 0) + 1 })
        .eq("id", appliedVoucher.id);
    }

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
    return true;
  }

  const resetSession = useCallback(() => {
    setReceipt(null);
    setSelectedPayment(null);
    setCashReceived("");
    setCart([]);
    setVoucherCode("");
    setAppliedVoucher(null);
    setVoucherDiscount(0);
    setVoucherError("");
    setPointsRedeemed(false);
    setPointsUsed(0);
    setPointsDiscount(0);
    setMember(null);
    setMemberPhone("");
    setMemberLookupError("");
    setSearch("");
    setCategoryFilter("All");
    void fetchData();
  }, [fetchData]);

  return {
    products,
    categories,
    promotions,
    filteredProducts,
    rxProductLookup,
    loading,
    error,
    branchId,
    branchName,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    memberPhone,
    setMemberPhone,
    member,
    memberLookupError,
    cart,
    cartWithPromos,
    voucherCode,
    setVoucherCode,
    appliedVoucher,
    voucherDiscount,
    voucherError,
    pointsRedeemed,
    pointsUsed,
    pointsDiscount,
    selectedPayment,
    setSelectedPayment,
    cashReceived,
    setCashReceived,
    processing,
    receipt,
    subtotal,
    tax,
    total,
    totalSavings,
    itemCount,
    cashReceivedNum,
    cashChange,
    fetchData,
    getProductPromo,
    addToCart,
    updateQty,
    applyVoucher,
    redeemPoints,
    removePoints,
    lookupMemberByPhone,
    removeMember,
    confirmPayment,
    resetSession,
    clearCart,
    resetVoucher,
  };
}

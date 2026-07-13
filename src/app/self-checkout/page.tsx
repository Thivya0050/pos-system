"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  Check,
  Loader2,
  Minus,
  Pill,
  Plus,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { PAYMENT_OPTIONS } from "@/lib/pos-checkout";
import {
  RX_BLOCK_MESSAGE,
  SELF_CHECKOUT_ALLOW_POINTS_REDEMPTION,
  SELF_CHECKOUT_ALLOW_VOUCHERS,
  STAFF_CALL_CONFIRM_MESSAGE,
} from "@/lib/kiosk-config";
import { createStaffCall } from "@/lib/staff-calls";
import { usePosCheckout } from "@/hooks/usePosCheckout";
import { formatRM, getMemberPrice, getTierBadgeClass } from "@/lib/utils";
import type { Category } from "@/types/database";
import "./kiosk.css";

type KioskStep = "shop" | "member" | "payment" | "receipt";

const RESET_DELAY_MS = 10_000;
const STAFF_CONFIRM_DISMISS_MS = 8_000;

export default function SelfCheckoutPage() {
  const kioskSessionId = useId();
  const checkout = usePosCheckout({
    excludeRx: true,
    allowVouchers: SELF_CHECKOUT_ALLOW_VOUCHERS,
    allowPointsRedemption: SELF_CHECKOUT_ALLOW_POINTS_REDEMPTION,
  });
  const [step, setStep] = useState<KioskStep>("shop");
  const [resetCountdown, setResetCountdown] = useState(RESET_DELAY_MS / 1000);
  const [rxBlockMessage, setRxBlockMessage] = useState<string | null>(null);
  const [staffCallConfirm, setStaffCallConfirm] = useState(false);
  const [staffCallPending, setStaffCallPending] = useState(false);
  const recentStaffCallsRef = useRef<Set<string>>(new Set());
  const staffCallInFlightRef = useRef(false);

  const callForStaff = useCallback(
    async (reason?: string | null) => {
      if (!checkout.branchId || staffCallInFlightRef.current) return;

      const dedupeKey =
        reason === "rx_blocked"
          ? `rx_blocked:${checkout.rxProductLookup?.id ?? "unknown"}:${checkout.search.trim()}`
          : "manual";

      if (recentStaffCallsRef.current.has(dedupeKey)) return;

      staffCallInFlightRef.current = true;
      setStaffCallPending(true);
      recentStaffCallsRef.current.add(dedupeKey);

      const { error } = await createStaffCall({
        branchId: checkout.branchId,
        kioskSessionId,
        reason: reason ?? null,
      });

      staffCallInFlightRef.current = false;
      setStaffCallPending(false);

      if (error) {
        recentStaffCallsRef.current.delete(dedupeKey);
        return;
      }

      setStaffCallConfirm(true);
      window.setTimeout(() => {
        setStaffCallConfirm(false);
        recentStaffCallsRef.current.delete(dedupeKey);
      }, STAFF_CONFIRM_DISMISS_MS);
    },
    [checkout.branchId, checkout.rxProductLookup, checkout.search, kioskSessionId]
  );

  function handleRxBlocked() {
    setRxBlockMessage(RX_BLOCK_MESSAGE);
    void callForStaff("rx_blocked");
  }

  function handleAddToCart(product: Parameters<typeof checkout.addToCart>[0]) {
    const result = checkout.addToCart(product);
    if (result === "blocked_rx") {
      handleRxBlocked();
    }
  }

  useEffect(() => {
    if (!checkout.rxProductLookup) {
      setRxBlockMessage(null);
      return;
    }

    setRxBlockMessage(RX_BLOCK_MESSAGE);
    void callForStaff("rx_blocked");
  }, [checkout.rxProductLookup, callForStaff]);

  useEffect(() => {
    if (checkout.receipt) {
      setStep("receipt");
    }
  }, [checkout.receipt]);

  useEffect(() => {
    if (step !== "receipt") return;

    setResetCountdown(RESET_DELAY_MS / 1000);
    const interval = window.setInterval(() => {
      setResetCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    const timeout = window.setTimeout(() => {
      checkout.resetSession();
      setStep("shop");
    }, RESET_DELAY_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [step, checkout.resetSession]);

  function handleStartNewOrder() {
    checkout.resetSession();
    setStep("shop");
  }

  function appendPhoneDigit(digit: string) {
    if (digit === "clear") {
      checkout.setMemberPhone("");
      return;
    }
    if (digit === "back") {
      checkout.setMemberPhone(checkout.memberPhone.slice(0, -1));
      return;
    }
    if (checkout.memberPhone.length >= 15) return;
    checkout.setMemberPhone(checkout.memberPhone + digit);
  }

  async function handleMemberLookup() {
    const found = await checkout.lookupMemberByPhone(checkout.memberPhone);
    if (found) setStep("shop");
  }

  async function handlePay() {
    const ok = await checkout.confirmPayment();
    if (ok) setStep("receipt");
  }

  const staffCallButton = (
    <button
      type="button"
      onClick={() => void callForStaff()}
      disabled={staffCallPending || !checkout.branchId}
      className="kiosk-staff-call-btn"
      aria-label="Call for staff assistance"
    >
      <Bell className="h-5 w-5 shrink-0" />
      Call for staff
    </button>
  );

  const staffCallConfirmBanner = staffCallConfirm ? (
    <div className="kiosk-staff-confirm" role="status" aria-live="polite">
      <Check className="h-5 w-5 shrink-0 text-emerald-600" />
      <span>{STAFF_CALL_CONFIRM_MESSAGE}</span>
    </div>
  ) : null;

  if (step === "receipt" && checkout.receipt) {
    const r = checkout.receipt;
    return (
      <div className="kiosk-page">
        {staffCallConfirmBanner}
        {staffCallButton}
        <div className="kiosk-receipt-screen">
          <div className="kiosk-receipt-card">
            <div className="kiosk-receipt-check">
              <Check className="h-10 w-10" strokeWidth={2.5} />
            </div>
            <h1 className="kiosk-receipt-title">Thank you!</h1>
            <p className="kiosk-receipt-order">{r.orderNumber}</p>

            <div className="space-y-2 text-base">
              {r.items.map((item) => (
                <div key={item.product.id} className="flex justify-between gap-3">
                  <span>
                    {item.product.name} × {item.quantity}
                  </span>
                  <span className="font-semibold">
                    {formatRM(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-1 border-t border-[#e2e8f0] pt-4">
              {r.savings > 0 && (
                <div className="flex justify-between text-[#059669]">
                  <span>You saved</span>
                  <span>{formatRM(r.savings)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#64748b]">
                <span>Tax</span>
                <span>{formatRM(r.tax)}</span>
              </div>
              <div className="flex justify-between text-xl font-extrabold text-[#0f172a]">
                <span>Total paid</span>
                <span>{formatRM(r.total)}</span>
              </div>
            </div>

            {r.member && r.pointsEarned > 0 && (
              <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                +{r.pointsEarned} points earned · Balance: {r.newBalance} pts
              </p>
            )}
          </div>

          <p className="mt-6 text-sm text-white/60">
            Returning to start in {resetCountdown}s…
          </p>
          <button
            type="button"
            onClick={handleStartNewOrder}
            className="kiosk-btn kiosk-btn--primary mt-4 max-w-sm"
          >
            Start new order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-page">
      {staffCallConfirmBanner}
      {staffCallButton}
      <header className="kiosk-header">
        <div className="kiosk-brand">
          <div className="kiosk-brand-mark">
            <Pill className="h-5 w-5" />
          </div>
          <span className="kiosk-brand-text">PharmaPOS</span>
        </div>
        <span className="kiosk-header-sub">Self Checkout · {checkout.branchName}</span>
      </header>

      {checkout.error && (
        <div className="kiosk-error mx-6 mt-4 shrink-0">{checkout.error}</div>
      )}

      <div className="kiosk-body">
        <section className="kiosk-products-pane" aria-label="Products">
          <div className="kiosk-search">
            <Search className="kiosk-search-icon h-5 w-5" />
            <input
              type="search"
              value={checkout.search}
              onChange={(e) => checkout.setSearch(e.target.value)}
              placeholder="Search products…"
              autoComplete="off"
            />
          </div>

          {rxBlockMessage && (
            <div className="kiosk-rx-block" role="alert">
              {rxBlockMessage}
            </div>
          )}

          <div className="kiosk-categories">
            <button
              type="button"
              onClick={() => checkout.setCategoryFilter("All")}
              className={`kiosk-cat-btn ${
                checkout.categoryFilter === "All"
                  ? "kiosk-cat-btn--active"
                  : "kiosk-cat-btn--idle"
              }`}
            >
              All
            </button>
            {checkout.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => checkout.setCategoryFilter(c.id)}
                className={`kiosk-cat-btn ${
                  checkout.categoryFilter === c.id
                    ? "kiosk-cat-btn--active"
                    : "kiosk-cat-btn--idle"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="kiosk-grid">
            {checkout.loading ? (
              <div className="col-span-full flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#64748b]" />
              </div>
            ) : checkout.filteredProducts.length === 0 ? (
              <p className="col-span-full py-16 text-center text-lg text-[#64748b]">
                No products found
              </p>
            ) : (
              checkout.filteredProducts.map((product) => {
                const normalPrice = Number(product.normal_price);
                const price = getMemberPrice(product, checkout.member);
                const categoryName =
                  (product.categories as Category | null)?.name ?? "General";
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    className="kiosk-product-card"
                  >
                    <div className="kiosk-product-img">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <span className="text-4xl">💊</span>
                      )}
                    </div>
                    <div className="kiosk-product-body">
                      <span className="mb-1 text-xs text-[#94a3b8]">
                        {categoryName}
                      </span>
                      <span className="kiosk-product-name line-clamp-2">
                        {product.name}
                      </span>
                      <span className="kiosk-product-price">{formatRM(price)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <aside className="kiosk-cart-pane" aria-label="Cart">
          <div className="kiosk-cart-header">
            <h2 className="kiosk-cart-title">
              Your order
              {checkout.itemCount > 0 ? ` (${checkout.itemCount})` : ""}
            </h2>
            {checkout.cart.length > 0 && (
              <button
                type="button"
                onClick={checkout.clearCart}
                className="kiosk-btn kiosk-btn--secondary px-3 py-2 text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {checkout.member ? (
            <div className="px-5 pt-3">
              <div className="kiosk-member-badge">
                <div>
                  <p className="font-bold text-[#0f172a]">{checkout.member.name}</p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getTierBadgeClass(checkout.member.tier)}`}
                  >
                    {checkout.member.tier} · {checkout.member.points} pts
                  </span>
                </div>
                <button
                  type="button"
                  onClick={checkout.removeMember}
                  className="kiosk-qty-btn"
                  aria-label="Remove member"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="kiosk-cart-list">
            {checkout.cart.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-[#94a3b8]">
                <ShoppingBag className="mb-3 h-10 w-10" />
                <p className="text-lg">Tap products to add them</p>
              </div>
            ) : (
              checkout.cartWithPromos.map((item) => (
                <div key={item.product.id} className="kiosk-cart-item">
                  <div className="min-w-0 flex-1">
                    <p className="kiosk-cart-item-name">{item.product.name}</p>
                    <p className="kiosk-cart-item-meta">
                      {formatRM(item.unitPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => checkout.updateQty(item.product.id, -1)}
                      className="kiosk-qty-btn"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="kiosk-qty-value">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => checkout.updateQty(item.product.id, 1)}
                      className="kiosk-qty-btn"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="kiosk-cart-footer">
            <div className="kiosk-total-row">
              <span>Subtotal</span>
              <span>{formatRM(checkout.subtotal)}</span>
            </div>
            {checkout.totalSavings > 0 && (
              <div className="kiosk-total-row text-emerald-600">
                <span>Savings</span>
                <span>-{formatRM(checkout.totalSavings)}</span>
              </div>
            )}
            <div className="kiosk-total-row">
              <span>Tax</span>
              <span>{formatRM(checkout.tax)}</span>
            </div>
            <div className="kiosk-total-row kiosk-total-row--grand">
              <span>Total</span>
              <span>{formatRM(checkout.total)}</span>
            </div>

            <div className="kiosk-btn-row">
              <button
                type="button"
                onClick={() => setStep("member")}
                className="kiosk-btn kiosk-btn--secondary flex-1"
              >
                <User className="h-5 w-5" />
                Member
              </button>
              <button
                type="button"
                disabled={checkout.cart.length === 0}
                onClick={() => setStep("payment")}
                className="kiosk-btn kiosk-btn--primary flex-[2]"
              >
                Pay {formatRM(checkout.total)}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {step === "member" && (
        <div className="kiosk-overlay" role="presentation" onClick={() => setStep("shop")}>
          <div
            className="kiosk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="member-title" className="kiosk-modal-title">
              Member lookup
            </h2>
            <p className="kiosk-modal-sub">
              Enter your phone number to earn and redeem loyalty points.
            </p>

            <div className="kiosk-phone-display">
              {checkout.memberPhone || "—"}
            </div>

            {checkout.memberLookupError && (
              <p className="mb-3 text-center text-sm text-red-600">
                {checkout.memberLookupError}
              </p>
            )}

            <div className="kiosk-numpad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => appendPhoneDigit(key)}
                  >
                    {key === "clear" ? "C" : key === "back" ? "⌫" : key}
                  </button>
                )
              )}
            </div>

            <div className="kiosk-btn-row mt-4">
              <button
                type="button"
                onClick={() => setStep("shop")}
                className="kiosk-btn kiosk-btn--secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMemberLookup}
                className="kiosk-btn kiosk-btn--primary flex-1"
              >
                Look up
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "payment" && (
        <div className="kiosk-overlay" role="presentation">
          <div
            className="kiosk-modal"
            style={{ maxWidth: 560 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
          >
            <h2 id="payment-title" className="kiosk-modal-title">
              Choose payment
            </h2>
            <p className="kiosk-modal-sub">
              Total due: <strong>{formatRM(checkout.total)}</strong>
            </p>

            <div className="kiosk-payment-grid">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => checkout.setSelectedPayment(opt.id)}
                  className={`kiosk-payment-btn ${
                    checkout.selectedPayment === opt.id
                      ? "kiosk-payment-btn--selected"
                      : ""
                  }`}
                >
                  {opt.id === "cash" ? (
                    <span className="text-2xl font-extrabold">RM</span>
                  ) : null}
                  {opt.label}
                </button>
              ))}
            </div>

            {checkout.selectedPayment === "cash" && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-semibold text-[#64748b]">
                  Cash received
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={checkout.cashReceived}
                  onChange={(e) => checkout.setCashReceived(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-[#e2e8f0] px-4 text-lg"
                  placeholder="0.00"
                />
                {checkout.cashReceivedNum > checkout.total && (
                  <p className="mt-2 text-sm font-medium text-emerald-600">
                    Change: {formatRM(checkout.cashChange)}
                  </p>
                )}
              </div>
            )}

            {SELF_CHECKOUT_ALLOW_VOUCHERS && (
              <>
                <div className="kiosk-voucher-row">
                  <input
                    type="text"
                    value={checkout.voucherCode}
                    onChange={(e) => checkout.setVoucherCode(e.target.value)}
                    placeholder="Voucher code"
                  />
                  <button
                    type="button"
                    onClick={() => void checkout.applyVoucher()}
                    className="kiosk-btn kiosk-btn--secondary shrink-0 px-5"
                  >
                    Apply
                  </button>
                </div>
                {checkout.voucherError && (
                  <p className="mt-2 text-sm text-red-600">{checkout.voucherError}</p>
                )}
                {checkout.appliedVoucher && (
                  <p className="mt-2 text-sm text-emerald-600">
                    {checkout.appliedVoucher.voucher_code} applied
                  </p>
                )}
              </>
            )}

            {SELF_CHECKOUT_ALLOW_POINTS_REDEMPTION &&
              checkout.member &&
              checkout.member.points >= 500 &&
              !checkout.pointsRedeemed && (
                <button
                  type="button"
                  onClick={checkout.redeemPoints}
                  className="kiosk-btn kiosk-btn--secondary mt-3 w-full"
                >
                  Redeem points ({checkout.member.points} available)
                </button>
              )}

            <div className="kiosk-btn-row mt-5">
              <button
                type="button"
                onClick={() => setStep("shop")}
                className="kiosk-btn kiosk-btn--secondary flex-1"
              >
                Back
              </button>
              <button
                type="button"
                disabled={
                  !checkout.selectedPayment ||
                  checkout.processing ||
                  (checkout.selectedPayment === "cash" &&
                    checkout.cashReceivedNum < checkout.total)
                }
                onClick={() => void handlePay()}
                className="kiosk-btn kiosk-btn--primary flex-[2]"
              >
                {checkout.processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `Confirm ${formatRM(checkout.total)}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

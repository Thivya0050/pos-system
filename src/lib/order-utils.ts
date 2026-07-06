import type { LucideIcon } from "lucide-react";
import { Banknote, CreditCard, QrCode, Smartphone } from "lucide-react";

export type PaymentMethod = "cash" | "card" | "touch_n_go" | "qr_code";

export const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  label: string;
  Icon: LucideIcon;
}[] = [
  { id: "cash", label: "Cash", Icon: Banknote },
  { id: "card", label: "Card", Icon: CreditCard },
  { id: "touch_n_go", label: "Touch n Go", Icon: Smartphone },
  { id: "qr_code", label: "QR Code", Icon: QrCode },
];

export function formatRM(amount: number) {
  return `RM${amount.toFixed(2)}`;
}

export function formatOrderId(id: string) {
  return `#${id.slice(0, 8)}`;
}

export function formatOrderDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatOrderTime(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function getPaymentLabel(method: string) {
  return (
    PAYMENT_OPTIONS.find((p) => p.id === method)?.label ??
    method.replace(/_/g, " ")
  );
}

export function getPaymentDotClass(method: string) {
  switch (method) {
    case "cash":
      return "bg-emerald-500";
    case "card":
      return "bg-blue-500";
    case "touch_n_go":
      return "bg-orange-500";
    case "qr_code":
      return "bg-purple-500";
    default:
      return "bg-gray-400";
  }
}

export function calculateOrderTotals(
  itemsTotal: number,
  discountAmount: number
) {
  const discount = Math.min(Math.max(discountAmount, 0), itemsTotal);
  const taxable = itemsTotal - discount;
  const tax = taxable * 0.08;
  const total = taxable + tax;
  return { itemsTotal, discount, taxable, tax, total };
}

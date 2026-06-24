export type PaymentMethod = "cash" | "card" | "touch_n_go" | "qr_code";

export const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  label: string;
  icon: string;
}[] = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "card", label: "Card", icon: "💳" },
  { id: "touch_n_go", label: "Touch n Go", icon: "📱" },
  { id: "qr_code", label: "QR Code", icon: "📲" },
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

export function getPaymentLabel(method: string) {
  return (
    PAYMENT_OPTIONS.find((p) => p.id === method)?.label ??
    method.replace(/_/g, " ")
  );
}

export function getPaymentBadgeClass(method: string) {
  switch (method) {
    case "cash":
      return "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20";
    case "card":
      return "bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20";
    case "touch_n_go":
      return "bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/20";
    case "qr_code":
      return "bg-teal-500/10 text-teal-700 ring-1 ring-teal-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 ring-1 ring-gray-500/20";
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

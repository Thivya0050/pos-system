import type { Member, MemberTier, PaymentMethod } from "@/types/database";

export function formatRM(amount: number) {
  return `RM${amount.toFixed(2)}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getTierBadgeClass(tier: MemberTier | string) {
  const t = tier.toLowerCase();
  switch (t) {
    case "gold":
      return "bg-[#fef3c7] text-[#92400e]";
    case "platinum":
      return "bg-[#ede9fe] text-[#5b21b6]";
    default:
      return "bg-[#f1f5f9] text-[#475569]";
  }
}

export function normalizeTier(tier: string): MemberTier {
  const t = tier.toLowerCase();
  if (t === "gold" || t === "platinum") return t;
  return "silver";
}

export function getPaymentLabel(method: PaymentMethod | string) {
  switch (method) {
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    case "touch_n_go":
      return "Touch n Go";
    case "qr_pay":
      return "QR Pay";
    default:
      return method;
  }
}

export function getPaymentDotClass(method: string) {
  switch (method) {
    case "cash":
      return "bg-emerald-500";
    case "card":
      return "bg-blue-500";
    case "touch_n_go":
      return "bg-orange-500";
    case "qr_pay":
      return "bg-purple-500";
    default:
      return "bg-slate-400";
  }
}

function effectiveTierPrice(value: number | null | undefined): number | null {
  if (value == null || Number(value) === 0) return null;
  return Number(value);
}

export function getMemberPrice(
  product: {
    normal_price: number;
    member_price: number;
    gold_price: number | null;
    platinum_price: number | null;
  },
  member: Member | null
): number {
  const normal = Number(product.normal_price) || 0;
  if (!member) return normal;

  const tier = normalizeTier(member.tier);
  let price: number | null = null;

  if (tier === "platinum") {
    price = effectiveTierPrice(product.platinum_price);
  } else if (tier === "gold") {
    price = effectiveTierPrice(product.gold_price);
  } else {
    price = effectiveTierPrice(product.member_price);
  }

  if (price == null) {
    price = effectiveTierPrice(product.member_price);
  }
  if (price == null) {
    return normal;
  }
  return price;
}

export function getTierPriceBadgeLabel(member: Member): string {
  const tier = normalizeTier(member.tier);
  if (tier === "silver") return "Member";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function getMemberPriceLabel(member: Member | null): string | null {
  if (!member) return null;
  const tier = normalizeTier(member.tier);
  if (tier === "silver") return "Member price";
  return `${tier.charAt(0).toUpperCase() + tier.slice(1)} price`;
}

export const CONNECTION_ERROR_MESSAGE =
  "Cannot connect to database. Please check your internet connection or contact your administrator.";

export function isConnectionError(message: string | null | undefined): boolean {
  return !!message?.includes("Failed to fetch");
}

export function getFriendlyErrorMessage(message: string | null | undefined): string {
  if (!message) return "An unexpected error occurred.";
  if (isConnectionError(message)) return CONNECTION_ERROR_MESSAGE;
  return message;
}

export function getTodayStart() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

export function pointsToRM(points: number, rate = 100) {
  return points / rate;
}

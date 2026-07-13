import type { Member, PaymentMethod, Product, Promotion } from "@/types/database";

export type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
  isFree: boolean;
  promoType: "b2f1" | "pwp" | null;
};

export type ReceiptData = {
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

export const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  label: string;
  variant?: "tng" | "qr";
}[] = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "touch_n_go", label: "TnG eWallet", variant: "tng" },
  { id: "qr_pay", label: "DuitNow QR", variant: "qr" },
];

export function applyB2F1(items: CartItem[], promos: Promotion[]): CartItem[] {
  const result = items.map((i) => ({
    ...i,
    isFree: false,
    promoType: null as CartItem["promoType"],
  }));
  promos
    .filter((p) => p.type === "b2f1" && p.is_active)
    .forEach((promo) => {
      const idx = result.findIndex((i) => i.product.id === promo.product_id);
      if (idx === -1 || !promo.min_qty || !promo.free_qty) return;
      const item = result[idx];
      const sets = Math.floor(item.quantity / promo.min_qty);
      if (sets * promo.free_qty > 0) {
        result[idx] = { ...item, promoType: "b2f1" };
      }
    });
  return result;
}

export function getFreeQuantity(item: CartItem, promos: Promotion[]): number {
  if (item.promoType !== "b2f1") return 0;
  const promo = promos.find(
    (p) => p.type === "b2f1" && p.product_id === item.product.id
  );
  if (!promo?.min_qty || !promo.free_qty) return 0;
  const sets = Math.floor(item.quantity / promo.min_qty);
  return sets * promo.free_qty;
}

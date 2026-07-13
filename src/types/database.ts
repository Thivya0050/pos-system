export type MemberTier = "silver" | "gold" | "platinum";
export type PaymentMethod = "cash" | "card" | "touch_n_go" | "qr_pay";
export type PromoType = "b2f1" | "pwp" | "voucher";
export type VoucherType = "fixed" | "percent";
export type OrderStatus = "completed" | "pending" | "cancelled";

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Staff {
  id: string;
  branch_id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  branch_id: string | null;
  name: string;
  phone: string;
  ic_number: string | null;
  email: string | null;
  date_of_birth: string | null;
  tier: MemberTier;
  points: number;
  total_spend: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  barcode: string | null;
  normal_price: number;
  member_price: number;
  gold_price: number | null;
  platinum_price: number | null;
  stock: number;
  low_stock_threshold: number | null;
  is_active: boolean;
  image_url: string | null;
  requires_prescription: boolean;
  created_at: string;
  categories?: Category | null;
}

export interface Promotion {
  id: string;
  type: PromoType;
  name: string;
  product_id: string | null;
  reward_product_id: string | null;
  min_qty: number | null;
  free_qty: number | null;
  reward_price: number | null;
  applies_to: MemberTier | "all";
  voucher_code: string | null;
  discount_type: VoucherType | null;
  discount_value: number | null;
  max_uses: number | null;
  uses_count: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  branch_id: string | null;
  staff_id: string | null;
  member_id: string | null;
  subtotal: number;
  discount_amount: number;
  voucher_discount: number;
  points_discount: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  points_earned: number;
  points_redeemed: number;
  created_at: string;
  members?: Member | null;
  branches?: Branch | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  normal_price: number;
  sold_price: number;
  quantity: number;
  free_quantity: number;
  promo_applied: PromoType | null;
  created_at: string;
}

export interface PointsHistory {
  id: string;
  member_id: string;
  order_id: string | null;
  points: number;
  description: string;
  created_at: string;
}

export interface MemberVoucher {
  id: string;
  member_id: string;
  promotion_id: string;
  code: string;
  is_used: boolean;
  used_at: string | null;
  created_at: string;
  promotions?: Promotion | null;
}

export type StaffCallStatus = "pending" | "acknowledged" | "resolved";

export interface StaffCall {
  id: string;
  branch_id: string;
  kiosk_session_id: string;
  reason: string | null;
  status: StaffCallStatus;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      branches: { Row: Branch; Insert: Omit<Branch, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Branch> };
      staff: { Row: Staff; Insert: Omit<Staff, "id" | "created_at" | "password"> & { id?: string; created_at?: string; password?: string }; Update: Partial<Omit<Staff, "password">> & { password?: string } };
      members: { Row: Member; Insert: Omit<Member, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Member> };
      categories: { Row: Category; Insert: Omit<Category, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Category> };
      products: { Row: Product; Insert: Omit<Product, "id" | "created_at" | "categories"> & { id?: string; created_at?: string }; Update: Partial<Omit<Product, "categories">> };
      promotions: { Row: Promotion; Insert: Omit<Promotion, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Promotion> };
      orders: { Row: Order; Insert: Omit<Order, "id" | "created_at" | "members" | "branches"> & { id?: string; created_at?: string }; Update: Partial<Omit<Order, "members" | "branches">> };
      order_items: { Row: OrderItem; Insert: Omit<OrderItem, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<OrderItem> };
      points_history: { Row: PointsHistory; Insert: Omit<PointsHistory, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<PointsHistory> };
      member_vouchers: { Row: MemberVoucher; Insert: Omit<MemberVoucher, "id" | "created_at" | "promotions"> & { id?: string; created_at?: string }; Update: Partial<Omit<MemberVoucher, "promotions">> };
      staff_calls: { Row: StaffCall; Insert: Omit<StaffCall, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<StaffCall> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

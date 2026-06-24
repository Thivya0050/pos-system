export type ProductRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  created_at: string;
};

export type OrderRow = {
  id: string;
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
  payment_method: string;
  created_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      products: {
        Row: ProductRow;
        Insert: {
          id?: string;
          name: string;
          category: string;
          price: number;
          stock: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          price?: number;
          stock?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: {
          id?: string;
          subtotal: number;
          tax: number;
          total: number;
          discount?: number;
          payment_method?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          subtotal?: number;
          tax?: number;
          total?: number;
          discount?: number;
          payment_method?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: OrderItemRow;
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          price?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

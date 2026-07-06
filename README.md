# POS System — Point of Sale for F&B & Retail

A modern, full-featured Point of Sale system built for food & beverage and retail businesses. Manage products, process sales at the cashier, track orders, apply discounts, accept multiple payment methods, print receipts, and view real-time sales analytics — all in one clean dashboard.

---

## Live Demo

[![Live Demo](https://img.shields.io/badge/Live%20Demo-pos--system--my.netlify.app-6366f1?style=for-the-badge&logo=netlify&logoColor=white)](https://pos-system-my.netlify.app)

**URL:** [https://pos-system-my.netlify.app](https://pos-system-my.netlify.app)

| Field    | Value            |
| -------- | ---------------- |
| Email    | `admin@pos.com`  |
| Password | `admin123`       |

---

## Screenshots

![POS Cashier Screen](./public/screenshot-pos.png)

![Reports Dashboard](./public/screenshot-reports.png)

---

## Features

- Secure login with role-based access
- Cashier screen with product grid and cart
- Product management with stock tracking
- Sales reports and analytics dashboard
- Printable receipts after every order
- Multiple payment methods (Cash, Card, TnG, QR)
- Discount support (% or fixed amount)
- Full order history with expandable details
- Search and filter across all pages

---

## Tech Stack

![Next.js 14](https://img.shields.io/badge/Next.js%2014-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase%20(PostgreSQL)-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=flat-square&logo=netlify&logoColor=white)

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account

### Installation

```bash
git clone https://github.com/Thivya0050/pos-system.git
cd pos-system
npm install
cp .env.local.example .env.local
# Add your Supabase keys to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Setup

Run the following SQL in your **Supabase SQL Editor** to create the required tables:

```sql
-- Products table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (allow public access for demo)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on products" ON products FOR ALL USING (true);
CREATE POLICY "Allow all on orders" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all on order_items" ON order_items FOR ALL USING (true);
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

| Variable                         | Description                    |
| -------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`       | Your Supabase project URL      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Your Supabase anon/public key  |

---

Built with care by Thivya

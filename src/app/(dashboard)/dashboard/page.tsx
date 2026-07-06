"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  DollarSign,
  Loader2,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import {
  formatOrderId,
  formatOrderTime,
  formatRM,
  getPaymentLabel,
} from "@/lib/order-utils";
import { getSupabaseErrorMessage, supabase } from "@/lib/supabase";
import type { OrderRow, ProductRow } from "@/types/database";

type DashboardStats = {
  todaySales: number;
  ordersToday: number;
  totalProducts: number;
  lowStockCount: number;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayStart() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function getFullDate() {
  return new Date().toLocaleDateString("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getStockIndicator(stock: number) {
  if (stock === 0) {
    return { dot: "bg-red-500", label: "Out of stock" };
  }
  if (stock <= 5) {
    return { dot: "bg-orange-500", label: `${stock} left` };
  }
  return { dot: "bg-amber-400", label: `${stock} left` };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    ordersToday: 0,
    totalProducts: 0,
    lowStockCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<ProductRow[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const todayStart = getTodayStart();

      const [ordersResult, productsResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("name"),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (productsResult.error) throw productsResult.error;

      const orders = ordersResult.data ?? [];
      const products = productsResult.data ?? [];

      const todayOrders = orders.filter(
        (order) => new Date(order.created_at) >= new Date(todayStart)
      );

      const todaySales = todayOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0
      );

      const lowStock = products.filter((product) => product.stock <= 10);

      setStats({
        todaySales,
        ordersToday: todayOrders.length,
        totalProducts: products.length,
        lowStockCount: lowStock.length,
      });
      setRecentOrders(orders.slice(0, 5));
      setLowStockProducts(lowStock);
    } catch (err) {
      setError(getSupabaseErrorMessage(err));
      setStats({
        todaySales: 0,
        ordersToday: 0,
        totalProducts: 0,
        lowStockCount: 0,
      });
      setRecentOrders([]);
      setLowStockProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const kpiCards = useMemo(
    () => [
      {
        label: "Today's Sales",
        value: formatRM(stats.todaySales),
        icon: DollarSign,
        border: "border-l-[#2563eb]",
      },
      {
        label: "Orders Today",
        value: stats.ordersToday.toString(),
        icon: ShoppingBag,
        border: "border-l-emerald-500",
      },
      {
        label: "Total Products",
        value: stats.totalProducts.toString(),
        icon: Package,
        border: "border-l-violet-500",
      },
      {
        label: "Low Stock Items",
        value: stats.lowStockCount.toString(),
        icon: AlertTriangle,
        border: "border-l-amber-500",
      },
    ],
    [stats]
  );

  const quickActions = [
    { href: "/pos", label: "New Sale", icon: ShoppingBag },
    { href: "/products", label: "Add Product", icon: Plus },
    { href: "/reports", label: "View Reports", icon: BarChart3 },
    { href: "/orders", label: "View Orders", icon: Receipt },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="p-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#111827]">
              {getGreeting()}, Admin 👋
            </h2>
            <p className="mt-1 text-sm text-[#6b7280]">{getFullDate()}</p>
          </div>
          <Link
            href="/pos"
            className="inline-flex items-center gap-2 rounded-md bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Go to Cashier
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-lg border border-[#e5e7eb] border-l-4 bg-white p-5 ${card.border}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-2xl font-bold text-[#111827]">
                        {card.value}
                      </p>
                      <p className="mt-1 text-sm text-[#6b7280]">
                        {card.label}
                      </p>
                    </div>
                    <card.icon className="h-4 w-4 text-[#6b7280]" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
                <div className="border-b border-[#e5e7eb] px-6 py-4">
                  <h3 className="text-base font-semibold text-[#111827]">
                    Recent Orders
                  </h3>
                </div>
                {recentOrders.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-[#6b7280]">
                    No orders yet
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#e5e7eb]">
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                          Order ID
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                          Time
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                          Total
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                          Payment
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e7eb]">
                      {recentOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="transition-colors hover:bg-gray-50"
                        >
                          <td className="px-6 py-3 font-mono text-[#111827]">
                            {formatOrderId(order.id)}
                          </td>
                          <td className="px-6 py-3 text-[#6b7280]">
                            {formatOrderTime(order.created_at)}
                          </td>
                          <td className="px-6 py-3 font-medium text-[#111827]">
                            {formatRM(Number(order.total))}
                          </td>
                          <td className="px-6 py-3 text-[#6b7280]">
                            {getPaymentLabel(order.payment_method ?? "cash")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
                <div className="border-b border-[#e5e7eb] px-6 py-4">
                  <h3 className="text-base font-semibold text-[#111827]">
                    Stock Alerts
                  </h3>
                </div>
                {lowStockProducts.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-[#6b7280]">
                    All products well stocked
                  </p>
                ) : (
                  <ul className="divide-y divide-[#e5e7eb]">
                    {lowStockProducts.map((product) => {
                      const indicator = getStockIndicator(product.stock);
                      return (
                        <li
                          key={product.id}
                          className="flex items-center justify-between px-6 py-4"
                        >
                          <span className="font-medium text-[#111827]">
                            {product.name}
                          </span>
                          <span className="inline-flex items-center gap-2 text-sm text-[#6b7280]">
                            <span
                              className={`h-2 w-2 rounded-full ${indicator.dot}`}
                            />
                            {indicator.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-medium text-[#6b7280]">
                Quick actions
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white p-4 transition-colors hover:bg-gray-50"
                  >
                    <action.icon className="h-4 w-4 text-[#6b7280]" />
                    <span className="text-sm font-medium text-[#111827]">
                      {action.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

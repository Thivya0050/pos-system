"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  DollarSign,
  Loader2,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { OrderItemRow, OrderRow } from "@/types/database";

const DATE_FILTERS = ["Today", "This Week", "This Month"] as const;

const weeklySales = [
  { day: "Mon", amount: 120 },
  { day: "Tue", amount: 95 },
  { day: "Wed", amount: 180 },
  { day: "Thu", amount: 140 },
  { day: "Fri", amount: 210 },
  { day: "Sat", amount: 280 },
  { day: "Sun", amount: 156 },
];

const maxSales = Math.max(...weeklySales.map((d) => d.amount));

type TopProduct = {
  name: string;
  unitsSold: number;
  revenue: number;
  percentOfTotal: number;
};

function formatRM(amount: number) {
  return `RM ${amount.toFixed(2)}`;
}

function getFilterStartDate(filter: (typeof DATE_FILTERS)[number]) {
  const now = new Date();
  const start = new Date();

  if (filter === "Today") {
    start.setHours(0, 0, 0, 0);
  } else if (filter === "This Week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return start;
}

function getRankDisplay(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}`;
}

function getSalesTitle(filter: (typeof DATE_FILTERS)[number]) {
  if (filter === "Today") return "Total Sales Today";
  if (filter === "This Week") return "Total Sales This Week";
  return "Total Sales This Month";
}

export default function ReportsPage() {
  const [activeFilter, setActiveFilter] =
    useState<(typeof DATE_FILTERS)[number]>("Today");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [ordersResult, itemsResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("order_items").select("*"),
    ]);

    if (ordersResult.error) {
      setError(ordersResult.error.message);
      setOrders([]);
      setOrderItems([]);
      setLoading(false);
      return;
    }

    if (itemsResult.error) {
      setError(itemsResult.error.message);
      setOrders([]);
      setOrderItems([]);
      setLoading(false);
      return;
    }

    setOrders(ordersResult.data ?? []);
    setOrderItems(itemsResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const filteredOrders = useMemo(() => {
    const start = getFilterStartDate(activeFilter);
    return orders.filter((order) => new Date(order.created_at) >= start);
  }, [orders, activeFilter]);

  const filteredOrderIds = useMemo(
    () => new Set(filteredOrders.map((o) => o.id)),
    [filteredOrders]
  );

  const filteredItems = useMemo(
    () => orderItems.filter((item) => filteredOrderIds.has(item.order_id)),
    [orderItems, filteredOrderIds]
  );

  const totalSales = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + Number(order.total), 0),
    [filteredOrders]
  );

  const transactionCount = filteredOrders.length;

  const averageOrderValue =
    transactionCount > 0 ? totalSales / transactionCount : 0;

  const topProducts = useMemo(() => {
    const map = new Map<string, TopProduct>();

    filteredItems.forEach((item) => {
      const revenue = Number(item.price) * item.quantity;
      const existing = map.get(item.product_name);

      if (existing) {
        existing.unitsSold += item.quantity;
        existing.revenue += revenue;
      } else {
        map.set(item.product_name, {
          name: item.product_name,
          unitsSold: item.quantity,
          revenue,
          percentOfTotal: 0,
        });
      }
    });

    const itemsRevenue = Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((product) => ({
        ...product,
        percentOfTotal:
          totalSales > 0
            ? Math.round((product.revenue / totalSales) * 100)
            : 0,
      }));

    return itemsRevenue;
  }, [filteredItems, totalSales]);

  const bestSellingItem =
    topProducts.length > 0
      ? [...topProducts].sort((a, b) => b.unitsSold - a.unitsSold)[0].name
      : "—";

  const summaryCards = [
    {
      title: getSalesTitle(activeFilter),
      value: formatRM(totalSales),
      icon: DollarSign,
      gradient: "from-indigo-500 to-indigo-700",
    },
    {
      title: "Total Transactions",
      value: transactionCount.toString(),
      icon: ShoppingBag,
      gradient: "from-teal-500 to-teal-700",
    },
    {
      title: "Average Order Value",
      value: formatRM(averageOrderValue),
      icon: TrendingUp,
      gradient: "from-amber-500 to-amber-700",
    },
    {
      title: "Best Selling Item",
      value: bestSellingItem,
      icon: Award,
      gradient: "from-rose-500 to-rose-700",
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="p-6">
        <div className="mb-6 flex justify-end">
          <div className="flex rounded-xl bg-white p-1 shadow-sm">
            {DATE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                disabled={loading}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60 ${
                  activeFilter === filter
                    ? "bg-[#6366f1] text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#6366f1]" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.title}
                  className={`rounded-2xl bg-gradient-to-br ${card.gradient} p-5 text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-white/80">
                        {card.title}
                      </p>
                      <p className="mt-2 text-2xl font-bold">{card.value}</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                      <card.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card mt-6 rounded-2xl p-6">
              <div className="mb-6 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#6366f1]" />
                <div>
                  <h3 className="font-bold text-gray-900">
                    Sales — Last 7 Days
                  </h3>
                  <p className="text-sm text-gray-500">
                    Sample daily revenue overview
                  </p>
                </div>
              </div>

              <div className="flex h-80 gap-4 pb-2">
                {weeklySales.map((item) => {
                  const heightPercent = (item.amount / maxSales) * 100;
                  return (
                    <div
                      key={item.day}
                      className="flex h-full flex-1 flex-col items-center"
                    >
                      <span className="mb-2 text-xs font-semibold text-gray-600">
                        RM{item.amount}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full min-h-[12px] rounded-t-xl bg-gradient-to-t from-[#6366f1] to-indigo-400 transition-all hover:from-indigo-600 hover:to-indigo-300"
                          style={{ height: `${heightPercent}%` }}
                          title={`${item.day}: RM${item.amount}`}
                        />
                      </div>
                      <span className="mt-3 text-xs font-semibold text-gray-500">
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card mt-6 overflow-hidden rounded-2xl">
              <div className="px-6 py-5">
                <h3 className="font-bold text-gray-900">Top Products</h3>
                <p className="text-sm text-gray-500">
                  Best performers by revenue
                </p>
              </div>

              {topProducts.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">
                  No sales data for this period yet.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="px-6 py-4 font-semibold text-gray-600">
                        Product name
                      </th>
                      <th className="px-6 py-4 font-semibold text-gray-600">
                        Units sold
                      </th>
                      <th className="px-6 py-4 font-semibold text-gray-600">
                        Revenue (RM)
                      </th>
                      <th className="px-6 py-4 font-semibold text-gray-600">
                        % of total sales
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((product, index) => (
                      <tr
                        key={product.name}
                        className={`transition-colors duration-150 hover:bg-indigo-50/40 ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center text-lg">
                              {getRankDisplay(index)}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {product.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {product.unitsSold}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {formatRM(product.revenue)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 w-28 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-[#6366f1]"
                                style={{ width: `${product.percentOfTotal}%` }}
                              />
                            </div>
                            <span className="font-medium text-gray-600">
                              {product.percentOfTotal}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

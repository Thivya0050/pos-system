"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
  return `RM${amount.toFixed(2)}`;
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
    },
    {
      title: "Total Transactions",
      value: transactionCount.toString(),
    },
    {
      title: "Average Order Value",
      value: formatRM(averageOrderValue),
    },
    {
      title: "Best Selling Item",
      value: bestSellingItem,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="p-8">
        <div className="mb-6 flex justify-end">
          <div className="flex rounded-md border border-[#e5e7eb] bg-white p-0.5">
            {DATE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                disabled={loading}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                  activeFilter === filter
                    ? "bg-[#111827] text-white"
                    : "text-[#6b7280] hover:text-[#111827]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg border border-[#e5e7eb] bg-white p-6"
                >
                  <p className="text-2xl font-bold text-[#111827]">
                    {card.value}
                  </p>
                  <p className="mt-1 text-sm text-[#6b7280]">{card.title}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-lg border border-[#e5e7eb] bg-white p-6">
              <h3 className="text-base font-semibold text-[#111827]">
                Sales — Last 7 Days
              </h3>
              <p className="mt-0.5 text-sm text-[#6b7280]">
                Sample daily revenue overview
              </p>

              <div className="mt-8 flex h-64 items-end gap-3">
                {weeklySales.map((item) => {
                  const heightPercent = (item.amount / maxSales) * 100;
                  return (
                    <div
                      key={item.day}
                      className="flex h-full flex-1 flex-col items-center justify-end"
                    >
                      <div
                        className="w-full rounded-t bg-[#2563eb]"
                        style={{
                          height: `${heightPercent}%`,
                          minHeight: "8px",
                        }}
                        title={`${item.day}: RM${item.amount}`}
                      />
                      <span className="mt-3 text-xs text-[#6b7280]">
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
              <div className="border-b border-[#e5e7eb] px-6 py-4">
                <h3 className="text-base font-semibold text-[#111827]">
                  Top Products
                </h3>
                <p className="mt-0.5 text-sm text-[#6b7280]">
                  Best performers by revenue
                </p>
              </div>

              {topProducts.length === 0 ? (
                <p className="py-12 text-center text-sm text-[#6b7280]">
                  No sales data for this period yet.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                        #
                      </th>
                      <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                        Product
                      </th>
                      <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                        Units sold
                      </th>
                      <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                        % of total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {topProducts.map((product, index) => (
                      <tr
                        key={product.name}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 font-mono text-sm text-[#6b7280]">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 font-medium text-[#111827]">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 text-[#6b7280]">
                          {product.unitsSold}
                        </td>
                        <td className="px-6 py-4 text-[#111827]">
                          {formatRM(product.revenue)}
                        </td>
                        <td className="px-6 py-4 text-[#6b7280]">
                          {product.percentOfTotal}%
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

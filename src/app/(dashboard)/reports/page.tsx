"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CreditCard,
  DollarSign,
  Inbox,
  Loader2,
  ShoppingCart,
  Users,
} from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { supabase } from "@/lib/supabase";
import {
  formatRM,
  getPaymentDotClass,
  getPaymentLabel,
} from "@/lib/utils";
import type { Order, OrderItem } from "@/types/database";

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = `${dateFrom}T00:00:00`;
    const to = `${dateTo}T23:59:59`;

    const [ordersRes, itemsRes, membersRes] = await Promise.all([
      supabase.from("orders").select("*").gte("created_at", from).lte("created_at", to).eq("status", "completed"),
      supabase.from("order_items").select("*"),
      supabase.from("members").select("id", { count: "exact", head: true }),
    ]);

    if (ordersRes.error) setError(ordersRes.error.message);
    else if (itemsRes.error) setError(itemsRes.error.message);
    setOrders(ordersRes.data ?? []);
    setOrderItems(itemsRes.data ?? []);
    setMemberCount(membersRes.count ?? 0);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const orderIds = useMemo(() => new Set(orders.map((o) => o.id)), [orders]);

  const filteredItems = useMemo(
    () => orderItems.filter((i) => orderIds.has(i.order_id)),
    [orderItems, orderIds]
  );

  const kpis = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const count = orders.length;
    const avg = count > 0 ? revenue / count : 0;
    return { revenue, count, avg, members: memberCount };
  }, [orders, memberCount]);

  const chartData = useMemo(() => {
    const days: { label: string; value: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        label: d.toLocaleDateString("en-MY", { weekday: "short" }),
        date: key,
        value: orders
          .filter((o) => o.created_at.slice(0, 10) === key)
          .reduce((s, o) => s + Number(o.total), 0),
      });
    }
    return days;
  }, [orders]);

  const maxBar = Math.max(...chartData.map((d) => d.value), 1);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    filteredItems.forEach((item) => {
      if (!map[item.product_id]) {
        map[item.product_id] = { name: item.product_name, qty: 0, revenue: 0 };
      }
      map[item.product_id].qty += item.quantity;
      map[item.product_id].revenue +=
        Number(item.sold_price) * Number(item.quantity);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredItems]);

  const paymentBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    orders.forEach((o) => {
      if (!map[o.payment_method]) map[o.payment_method] = { count: 0, total: 0 };
      map[o.payment_method].count += 1;
      map[o.payment_method].total += Number(o.total);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [orders]);

  const kpiCards = [
    { label: "Revenue", value: formatRM(kpis.revenue), icon: DollarSign, border: "border-l-blue-500" },
    { label: "Orders", value: kpis.count.toString(), icon: ShoppingCart, border: "border-l-emerald-500" },
    { label: "Avg Order", value: formatRM(kpis.avg), icon: BarChart3, border: "border-l-purple-500" },
    { label: "Members", value: kpis.members.toString(), icon: Users, border: "border-l-amber-500" },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Reports</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">Sales analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field w-36" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field w-36" />
        </div>
      </div>

      {error && <ErrorBanner error={error} onRetry={() => void fetchData()} />}

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[#64748b]" /></div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((k) => (
              <div key={k.label} className={`card border-l-4 ${k.border}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[#0f172a]">{k.value}</p>
                    <p className="mt-1 text-xs text-[#64748b]">{k.label}</p>
                  </div>
                  <k.icon className="h-4 w-4 text-[#cbd5e1]" />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 text-sm font-medium text-[#0f172a]">7-Day Revenue</h3>
              <div className="flex h-40 items-end justify-between gap-2">
                {chartData.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-[#64748b]">{d.value > 0 ? formatRM(d.value) : ""}</span>
                    <div
                      className="w-full rounded-t bg-[#2563eb] transition-all"
                      style={{ height: `${Math.max((d.value / maxBar) * 100, d.value > 0 ? 4 : 0)}%`, minHeight: d.value > 0 ? 4 : 0 }}
                    />
                    <span className="text-[10px] text-[#64748b]">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="mb-4 text-sm font-medium text-[#0f172a]">Payment Breakdown</h3>
              {paymentBreakdown.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-[#64748b]">
                  <CreditCard className="mb-2 h-8 w-8 text-[#cbd5e1]" />
                  <p className="text-sm">No payment data</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {paymentBreakdown.map(([method, data]) => {
                    const pct = kpis.revenue > 0 ? (data.total / kpis.revenue) * 100 : 0;
                    return (
                      <li key={method}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-2 text-[#0f172a]">
                            <span className={`h-2 w-2 rounded-full ${getPaymentDotClass(method)}`} />
                            {getPaymentLabel(method)}
                          </span>
                          <span className="text-[#64748b]">{formatRM(data.total)} ({data.count})</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
                          <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="border-b border-[#e2e8f0] px-4 py-3">
              <h3 className="text-sm font-medium text-[#0f172a]">Top Products</h3>
            </div>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-[#64748b]">
                <Inbox className="mb-2 h-8 w-8 text-[#cbd5e1]" />
                <p className="text-sm">No product sales in range</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Qty Sold</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.name} className="table-row">
                      <td className="px-4 font-medium text-[#0f172a]">{p.name}</td>
                      <td className="px-4 text-[#64748b]">{p.qty}</td>
                      <td className="px-4 text-[#0f172a]">{formatRM(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

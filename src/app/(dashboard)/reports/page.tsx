"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  getTierBadgeClass,
} from "@/lib/utils";
import type { Member, Order, OrderItem, PaymentMethod } from "@/types/database";

const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "touch_n_go",
  "qr_pay",
];

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  cash: "#10b981",
  card: "#2563eb",
  touch_n_go: "#f97316",
  qr_pay: "#a855f7",
};

function formatChartDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString("en-MY", { weekday: "short" });
}

function buildLastSevenDays(endDateKey: string) {
  const end = new Date(`${endDateKey}T12:00:00`);
  const days: { label: string; value: number; date: string }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      label: formatChartDateLabel(key),
      date: key,
      value: 0,
    });
  }

  return days;
}

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [topMembers, setTopMembers] = useState<Member[]>([]);
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

    const [ordersRes, membersRes, topMembersRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .gte("created_at", from)
        .lte("created_at", to)
        .eq("status", "completed"),
      supabase.from("members").select("id", { count: "exact", head: true }),
      supabase
        .from("members")
        .select("*")
        .order("total_spend", { ascending: false })
        .limit(5),
    ]);

    if (ordersRes.error) {
      setError(ordersRes.error.message);
      setLoading(false);
      return;
    }
    if (membersRes.error) {
      setError(membersRes.error.message);
      setLoading(false);
      return;
    }
    if (topMembersRes.error) {
      setError(topMembersRes.error.message);
      setLoading(false);
      return;
    }

    const nextOrders = (ordersRes.data ?? []) as Order[];
    setOrders(nextOrders);
    setMemberCount(membersRes.count ?? 0);
    setTopMembers((topMembersRes.data ?? []) as Member[]);

    const orderIds = nextOrders.map((o) => o.id);
    if (orderIds.length === 0) {
      setOrderItems([]);
      setLoading(false);
      return;
    }

    const itemsRes = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    if (itemsRes.error) setError(itemsRes.error.message);
    setOrderItems((itemsRes.data ?? []) as OrderItem[]);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const kpis = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const count = orders.length;
    const avg = count > 0 ? revenue / count : 0;
    return { revenue, count, avg, members: memberCount };
  }, [orders, memberCount]);

  const chartData = useMemo(() => {
    const days = buildLastSevenDays(dateTo);
    const revenueByDay = new Map(days.map((d) => [d.date, 0]));

    orders.forEach((order) => {
      const key = order.created_at.slice(0, 10);
      if (revenueByDay.has(key)) {
        revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(order.total));
      }
    });

    return days.map((day) => ({
      ...day,
      value: revenueByDay.get(day.date) ?? 0,
    }));
  }, [orders, dateTo]);

  const sevenDayTotal = useMemo(
    () => chartData.reduce((sum, day) => sum + day.value, 0),
    [chartData]
  );

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    orderItems.forEach((item) => {
      if (!map[item.product_id]) {
        map[item.product_id] = { name: item.product_name, qty: 0, revenue: 0 };
      }
      map[item.product_id].qty += item.quantity;
      map[item.product_id].revenue +=
        Number(item.sold_price) * Number(item.quantity);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orderItems]);

  const paymentBreakdown = useMemo(() => {
    const map: Record<PaymentMethod, { count: number; total: number }> = {
      cash: { count: 0, total: 0 },
      card: { count: 0, total: 0 },
      touch_n_go: { count: 0, total: 0 },
      qr_pay: { count: 0, total: 0 },
    };

    orders.forEach((order) => {
      const method = order.payment_method as PaymentMethod;
      if (!map[method]) return;
      map[method].count += 1;
      map[method].total += Number(order.total);
    });

    return PAYMENT_METHODS.map((method) => ({
      method,
      label: getPaymentLabel(method),
      count: map[method].count,
      total: map[method].total,
      color: PAYMENT_COLORS[method],
    }));
  }, [orders]);

  const paymentChartTotal = useMemo(
    () => paymentBreakdown.reduce((sum, item) => sum + item.total, 0),
    [paymentBreakdown]
  );

  const kpiCards = [
    {
      label: "Revenue",
      value: formatRM(kpis.revenue),
      icon: DollarSign,
      border: "border-l-blue-500",
    },
    {
      label: "Orders",
      value: kpis.count.toString(),
      icon: ShoppingCart,
      border: "border-l-emerald-500",
    },
    {
      label: "Avg Order",
      value: formatRM(kpis.avg),
      icon: BarChart3,
      border: "border-l-purple-500",
    },
    {
      label: "Members",
      value: kpis.members.toString(),
      icon: Users,
      border: "border-l-amber-500",
    },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Reports</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">Sales analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-field w-36"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-field w-36"
          />
        </div>
      </div>

      {error && <ErrorBanner error={error} onRetry={() => void fetchData()} />}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
        </div>
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
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-[#0f172a]">7-Day Revenue</h3>
                  <p className="mt-1 text-xs text-[#64748b]">
                    Last 7 days ending {formatChartDateLabel(dateTo)}, {dateTo}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[#2563eb]">
                  {formatRM(sevenDayTotal)}
                </p>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(value: number) =>
                        value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                      formatter={(value) => [formatRM(Number(value ?? 0)), "Revenue"]}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-[#0f172a]">Payment Breakdown</h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  Selected range {dateFrom} to {dateTo}
                </p>
              </div>
              {paymentChartTotal === 0 ? (
                <div className="flex flex-col items-center py-8 text-[#64748b]">
                  <CreditCard className="mb-2 h-8 w-8 text-[#cbd5e1]" />
                  <p className="text-sm">No payment data in range</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
                  <div className="mx-auto h-40 w-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentBreakdown.filter((item) => item.total > 0)}
                          dataKey="total"
                          nameKey="label"
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={2}
                        >
                          {paymentBreakdown
                            .filter((item) => item.total > 0)
                            .map((item) => (
                              <Cell key={item.method} fill={item.color} />
                            ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, _name, item) => {
                            const payload = item?.payload as
                              | { label: string; count: number }
                              | undefined;
                            return [
                              `${formatRM(Number(value ?? 0))} (${payload?.count ?? 0} orders)`,
                              payload?.label ?? "Payment",
                            ];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-3">
                    {paymentBreakdown.map((item) => {
                      const pct =
                        paymentChartTotal > 0 ? (item.total / paymentChartTotal) * 100 : 0;
                      return (
                        <li key={item.method}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="inline-flex items-center gap-2 text-[#0f172a]">
                              <span
                                className={`h-2 w-2 rounded-full ${getPaymentDotClass(item.method)}`}
                              />
                              {item.label}
                            </span>
                            <span className="text-[#64748b]">
                              {formatRM(item.total)} ({item.count})
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card overflow-hidden p-0">
              <div className="border-b border-[#e2e8f0] px-4 py-3">
                <h3 className="text-sm font-medium text-[#0f172a]">Top Products</h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  By revenue in selected range
                </p>
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
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                        Product
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                        Qty Sold
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                        Revenue
                      </th>
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

            <div className="card overflow-hidden p-0">
              <div className="border-b border-[#e2e8f0] px-4 py-3">
                <h3 className="text-sm font-medium text-[#0f172a]">Top Members</h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  By lifetime total spend
                </p>
              </div>
              {topMembers.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-[#64748b]">
                  <Users className="mb-2 h-8 w-8 text-[#cbd5e1]" />
                  <p className="text-sm">No member data yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                        Member
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                        Tier
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">
                        Total Spend
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMembers.map((member) => (
                      <tr key={member.id} className="table-row">
                        <td className="px-4">
                          <p className="font-medium text-[#0f172a]">{member.name}</p>
                          <p className="text-xs text-[#64748b]">{member.phone}</p>
                        </td>
                        <td className="px-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getTierBadgeClass(member.tier)}`}
                          >
                            {member.tier}
                          </span>
                        </td>
                        <td className="px-4 font-medium text-[#0f172a]">
                          {formatRM(Number(member.total_spend))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

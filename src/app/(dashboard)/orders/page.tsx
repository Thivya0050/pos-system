"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Inbox, Loader2, Search } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { supabase } from "@/lib/supabase";
import {
  formatDateTime,
  formatRM,
  getPaymentDotClass,
  getPaymentLabel,
} from "@/lib/utils";
import type { Member, Order, OrderItem } from "@/types/database";

function getOrderSavings(order: Order) {
  return (
    Number(order.discount_amount ?? 0) +
    Number(order.voucher_discount ?? 0) +
    Number(order.points_discount ?? 0)
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ordersRes, membersRes] = await Promise.all([
      supabase.from("orders").select("*, members(name)").order("created_at", { ascending: false }),
      supabase.from("members").select("id, name"),
    ]);
    if (ordersRes.error) setError(ordersRes.error.message);
    else if (membersRes.error) setError(membersRes.error.message);
    setOrders((ordersRes.data ?? []) as Order[]);
    setMembers((membersRes.data ?? []) as Member[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const memberMap = useMemo(() => {
    const m: Record<string, string> = {};
    members.forEach((mb) => { m[mb.id] = mb.name; });
    return m;
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      const memberName = o.member_id
        ? memberMap[o.member_id] ?? (o.members as { name?: string } | null)?.name ?? ""
        : "walk-in";
      const matchesSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        memberName.toLowerCase().includes(q);
      const created = new Date(o.created_at);
      const matchesFrom = !dateFrom || created >= new Date(dateFrom);
      const matchesTo = !dateTo || created <= new Date(`${dateTo}T23:59:59`);
      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [orders, search, dateFrom, dateTo, memberMap]);

  const summary = useMemo(() => ({
    count: filtered.length,
    revenue: filtered.reduce((s, o) => s + Number(o.total), 0),
    savings: filtered.reduce((s, o) => s + getOrderSavings(o), 0),
  }), [filtered]);

  async function toggleExpand(orderId: string) {
    if (expanded === orderId) {
      setExpanded(null);
      return;
    }
    setExpanded(orderId);
    if (!orderItems[orderId]) {
      setItemsLoading(orderId);
      const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      setOrderItems((prev) => ({ ...prev, [orderId]: data ?? [] }));
      setItemsLoading(null);
    }
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#0f172a]">Orders</h2>
        <p className="mt-0.5 text-sm text-[#64748b]">View and search transaction history</p>
      </div>

      {error && <ErrorBanner error={error} onRetry={() => void fetchData()} />}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card border-l-4 border-l-blue-500">
          <p className="text-2xl font-bold text-[#0f172a]">{summary.count}</p>
          <p className="mt-1 text-xs text-[#64748b]">Orders</p>
        </div>
        <div className="card border-l-4 border-l-emerald-500">
          <p className="text-2xl font-bold text-[#0f172a]">{formatRM(summary.revenue)}</p>
          <p className="mt-1 text-xs text-[#64748b]">Revenue</p>
        </div>
        <div className="card border-l-4 border-l-amber-500">
          <p className="text-2xl font-bold text-[#0f172a]">{formatRM(summary.savings)}</p>
          <p className="mt-1 text-xs text-[#64748b]">Member Savings</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input type="text" placeholder="Search order # or member..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field w-full lg:w-40" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field w-full lg:w-40" />
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#64748b]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-[#64748b]">
            <Inbox className="mb-2 h-8 w-8 text-[#cbd5e1]" />
            <p className="text-sm">No orders found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="w-8 px-2 py-2" />
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Order #</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Member</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Total</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Payment</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const isOpen = expanded === o.id;
                const items = orderItems[o.id] ?? [];
                return (
                  <Fragment key={o.id}>
                    <tr className="table-row cursor-pointer" onClick={() => toggleExpand(o.id)}>
                      <td className="px-2 text-[#64748b]">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 font-medium text-[#0f172a]">{o.order_number}</td>
                      <td className="px-4 text-[#64748b]">{formatDateTime(o.created_at)}</td>
                      <td className="px-4 text-[#0f172a]">
                        {o.member_id ? memberMap[o.member_id] ?? "Member" : "Walk-in"}
                      </td>
                      <td className="px-4 font-medium text-[#0f172a]">{formatRM(Number(o.total))}</td>
                      <td className="px-4">
                        <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                          <span className={`h-2 w-2 rounded-full ${getPaymentDotClass(o.payment_method)}`} />
                          {getPaymentLabel(o.payment_method)}
                        </span>
                      </td>
                      <td className="px-4 capitalize text-[#64748b]">{o.status}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-[#f8fafc]">
                        <td colSpan={7} className="px-6 py-3">
                          {itemsLoading === o.id ? (
                            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-[#64748b]" /></div>
                          ) : items.length === 0 ? (
                            <p className="text-sm text-[#64748b]">No line items</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="py-1 text-left text-[#64748b]">Product</th>
                                  <th className="py-1 text-left text-[#64748b]">Qty</th>
                                  <th className="py-1 text-left text-[#64748b]">Unit Price</th>
                                  <th className="py-1 text-left text-[#64748b]">Line Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="py-1 text-[#0f172a]">
                                      {item.product_name}
                                      {item.free_quantity > 0 && (
                                        <span className="ml-2 text-emerald-600">(Free)</span>
                                      )}
                                    </td>
                                    <td className="py-1 text-[#64748b]">{item.quantity}</td>
                                    <td className="py-1 text-[#64748b]">{formatRM(Number(item.sold_price))}</td>
                                    <td className="py-1 text-[#0f172a]">
                                      {formatRM(Number(item.sold_price) * Number(item.quantity))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <div className="mt-2 flex gap-4 text-xs text-[#64748b]">
                            <span>Subtotal: {formatRM(Number(o.subtotal))}</span>
                            <span>Tax: {formatRM(Number(o.tax))}</span>
                            {getOrderSavings(o) > 0 && (
                              <span className="text-emerald-600">
                                Savings: {formatRM(getOrderSavings(o))}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

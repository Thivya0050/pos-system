"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  DollarSign,
  Inbox,
  Loader2,
  PackageOpen,
  ShoppingCart,
  UserPlus,
  Users,
} from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  formatRM,
  formatTime,
  getGreeting,
  getPaymentDotClass,
  getPaymentLabel,
  getTodayStart,
} from "@/lib/utils";
import type { Member, Order, Product } from "@/types/database";

export default function DashboardPage() {
  const session = getSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todaySales, setTodaySales] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, Member>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const todayStart = getTodayStart().toISOString();

    const [ordersRes, membersRes, productsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, members(name)")
        .order("created_at", { ascending: false }),
      supabase.from("members").select("*"),
      supabase.from("products").select("*").order("name"),
    ]);

    if (ordersRes.error) setError(ordersRes.error.message);
    if (membersRes.error && !ordersRes.error) setError(membersRes.error.message);
    if (productsRes.error && !ordersRes.error) setError(productsRes.error.message);

    const orders = (ordersRes.data ?? []) as Order[];
    const members = (membersRes.data ?? []) as Member[];
    const products = (productsRes.data ?? []) as Product[];

    const todayOrders = orders.filter(
      (o) => new Date(o.created_at) >= new Date(todayStart)
    );

    setTodaySales(todayOrders.reduce((s, o) => s + Number(o.total), 0));
    setOrdersToday(todayOrders.length);
    setTotalMembers(members.length);
    setLowStockCount(products.filter((p) => p.stock <= 10).length);
    setRecentOrders(orders.slice(0, 5));
    setLowStock(products.filter((p) => p.stock <= 10).slice(0, 8));

    const map: Record<string, Member> = {};
    members.forEach((m) => {
      map[m.id] = m;
    });
    setMemberMap(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = [
    {
      label: "Today Sales",
      value: formatRM(todaySales),
      border: "border-l-blue-500",
      icon: DollarSign,
    },
    {
      label: "Orders Today",
      value: ordersToday.toString(),
      border: "border-l-emerald-500",
      icon: ShoppingCart,
    },
    {
      label: "Total Members",
      value: totalMembers.toString(),
      border: "border-l-purple-500",
      icon: Users,
    },
    {
      label: "Low Stock Items",
      value: lowStockCount.toString(),
      border: "border-l-amber-500",
      icon: AlertTriangle,
    },
  ];

  const actions = [
    { href: "/cashier", label: "Go to Cashier", icon: ShoppingCart },
    { href: "/members", label: "Add Member", icon: UserPlus },
    { href: "/products", label: "Add Product", icon: ArrowRight },
    { href: "/reports", label: "View Reports", icon: BarChart3 },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">
            {getGreeting()}, {session?.name ?? "Staff"}
          </h2>
          <p className="mt-0.5 text-sm text-[#64748b]">
            {new Date().toLocaleDateString("en-MY", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Link href="/cashier" className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
          Go to Cashier <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {error && <ErrorBanner error={error} onRetry={() => void fetchData()} />}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
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
            <div className="card overflow-hidden p-0">
              <div className="border-b border-[#e2e8f0] px-4 py-3">
                <h3 className="text-sm font-medium text-[#0f172a]">Recent Orders</h3>
              </div>
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-[#64748b]">
                  <Inbox className="mb-2 h-8 w-8 text-[#cbd5e1]" />
                  <p className="text-sm">No orders yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Time</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Member</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Payment</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="table-row">
                        <td className="px-4 text-[#64748b]">{formatTime(order.created_at)}</td>
                        <td className="px-4 text-[#0f172a]">
                          {order.member_id
                            ? memberMap[order.member_id]?.name ??
                              (order.members as { name?: string } | null)?.name ??
                              "Member"
                            : "Walk-in"}
                        </td>
                        <td className="px-4 font-medium">{formatRM(Number(order.total))}</td>
                        <td className="px-4">
                          <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                            <span className={`h-2 w-2 rounded-full ${getPaymentDotClass(order.payment_method)}`} />
                            {getPaymentLabel(order.payment_method)}
                          </span>
                        </td>
                        <td className="px-4 capitalize text-[#64748b]">{order.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card overflow-hidden p-0">
              <div className="border-b border-[#e2e8f0] px-4 py-3">
                <h3 className="text-sm font-medium text-[#0f172a]">Stock Alerts</h3>
              </div>
              {lowStock.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-[#64748b]">
                  <PackageOpen className="mb-2 h-8 w-8 text-[#cbd5e1]" />
                  <p className="text-sm">All products well stocked</p>
                </div>
              ) : (
                <ul className="divide-y divide-[#e2e8f0]">
                  {lowStock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-3 table-row">
                      <span className="font-medium text-[#0f172a]">{p.name}</span>
                      <span className="inline-flex items-center gap-2 text-sm text-[#64748b]">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            p.stock === 0
                              ? "bg-red-500"
                              : p.stock <= 5
                                ? "bg-orange-500"
                                : "bg-amber-400"
                          }`}
                        />
                        {p.stock} left
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="card flex items-center gap-3 transition-shadow hover:shadow-md"
              >
                <a.icon className="h-4 w-4 text-[#64748b]" />
                <span className="text-sm font-medium text-[#0f172a]">{a.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

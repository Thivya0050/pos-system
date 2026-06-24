"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Loader2,
  Search,
  ShoppingBag,
} from "lucide-react";
import {
  formatOrderDateTime,
  formatOrderId,
  formatRM,
  getPaymentBadgeClass,
  getPaymentLabel,
} from "@/lib/order-utils";
import { supabase } from "@/lib/supabase";
import type { OrderItemRow, OrderRow } from "@/types/database";

type OrderWithItems = OrderRow & {
  items: OrderItemRow[];
};

function formatItemsSummary(items: OrderItemRow[]) {
  return items
    .map((item) => `${item.product_name} x${item.quantity}`)
    .join(", ");
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [ordersResult, itemsResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("order_items").select("*"),
    ]);

    if (ordersResult.error) {
      setError(ordersResult.error.message);
      setOrders([]);
      setLoading(false);
      return;
    }

    if (itemsResult.error) {
      setError(itemsResult.error.message);
      setOrders([]);
      setLoading(false);
      return;
    }

    const itemsByOrder = (itemsResult.data ?? []).reduce<
      Record<string, OrderItemRow[]>
    >((acc, item) => {
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});

    const merged = (ordersResult.data ?? []).map((order) => ({
      ...order,
      discount: Number(order.discount ?? 0),
      payment_method: order.payment_method ?? "cash",
      items: itemsByOrder[order.id] ?? [],
    }));

    setOrders(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return orders;

    return orders.filter((order) => {
      const idMatch = order.id.toLowerCase().includes(query);
      const dateMatch = formatOrderDateTime(order.created_at)
        .toLowerCase()
        .includes(query);
      return idMatch || dateMatch;
    });
  }, [orders, search]);

  const totalRevenue = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total), 0),
    [orders]
  );

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="card rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Orders
                  </p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {orders.length}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
                  <ShoppingBag className="h-5 w-5 text-[#6366f1]" />
                </div>
              </div>
            </div>
            <div className="card rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Revenue
                  </p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {formatRM(totalRevenue)}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID or date..."
            disabled={loading}
            className="w-full rounded-xl bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#6366f1]" />
          </div>
        ) : (
          <div className="card overflow-hidden rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="w-8 px-4 py-4" />
                  <th className="px-4 py-4 font-semibold text-gray-600">
                    Order ID
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-600">
                    Date & Time
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-600">
                    Items
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-600">
                    Payment
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-600">
                    Total
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, index) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <Fragment key={order.id}>
                      <tr
                        onClick={() => toggleExpand(order.id)}
                        className={`cursor-pointer transition-colors hover:bg-indigo-50/40 ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                        }`}
                      >
                        <td className="px-4 py-4 text-gray-400">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-4 font-mono font-semibold text-[#6366f1]">
                          {formatOrderId(order.id)}
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          {formatOrderDateTime(order.created_at)}
                        </td>
                        <td className="max-w-xs truncate px-4 py-4 text-gray-600">
                          {formatItemsSummary(order.items) || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentBadgeClass(order.payment_method)}`}
                          >
                            {getPaymentLabel(order.payment_method)}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold text-gray-900">
                          {formatRM(Number(order.total))}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                            Completed
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-indigo-50/20">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="rounded-xl bg-white p-4 shadow-sm">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Order breakdown
                              </p>
                              <ul className="space-y-2 text-sm">
                                {order.items.map((item) => (
                                  <li
                                    key={item.id}
                                    className="flex justify-between text-gray-700"
                                  >
                                    <span>
                                      {item.product_name} × {item.quantity}
                                    </span>
                                    <span className="font-medium">
                                      {formatRM(
                                        Number(item.price) * item.quantity
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
                                <div className="flex justify-between text-gray-600">
                                  <span>Subtotal</span>
                                  <span>
                                    {formatRM(Number(order.subtotal))}
                                  </span>
                                </div>
                                {Number(order.discount) > 0 && (
                                  <div className="flex justify-between text-emerald-600">
                                    <span>Discount</span>
                                    <span>
                                      -{formatRM(Number(order.discount))}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between text-gray-600">
                                  <span>Tax</span>
                                  <span>{formatRM(Number(order.tax))}</span>
                                </div>
                                <div className="flex justify-between font-bold text-gray-900">
                                  <span>Total</span>
                                  <span>{formatRM(Number(order.total))}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {filteredOrders.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-500">
                {orders.length === 0
                  ? "No orders yet. Complete a sale on the POS page."
                  : "No orders match your search."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

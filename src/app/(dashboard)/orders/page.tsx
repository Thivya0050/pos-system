"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import {
  formatOrderDateTime,
  formatOrderId,
  formatRM,
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
      <div className="p-8">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && orders.length > 0 && (
          <p className="mb-6 text-sm text-[#6b7280]">
            {orders.length} orders · {formatRM(totalRevenue)} revenue
          </p>
        )}

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID or date..."
            disabled={loading}
            className="w-full rounded-md border border-[#e5e7eb] py-2 pl-10 pr-4 text-sm text-[#111827] placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] disabled:opacity-60"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb]">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                    Order ID
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                    Items
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <Fragment key={order.id}>
                      <tr
                        onClick={() => toggleExpand(order.id)}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-4 text-[#6b7280]">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-4 font-mono text-sm text-[#111827]">
                          {formatOrderId(order.id)}
                        </td>
                        <td className="px-4 py-4 text-[#6b7280]">
                          {formatOrderDateTime(order.created_at)}
                        </td>
                        <td className="max-w-xs truncate px-4 py-4 text-[#6b7280]">
                          {formatItemsSummary(order.items) || "—"}
                        </td>
                        <td className="px-4 py-4 text-[#6b7280]">
                          {getPaymentLabel(order.payment_method)}
                        </td>
                        <td className="px-4 py-4 font-medium text-[#111827]">
                          {formatRM(Number(order.total))}
                        </td>
                        <td className="px-4 py-4 text-[#6b7280]">
                          Completed
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="rounded-md border border-[#e5e7eb] bg-white p-4">
                              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                                Order breakdown
                              </p>
                              <ul className="space-y-2 text-sm">
                                {order.items.map((item) => (
                                  <li
                                    key={item.id}
                                    className="flex justify-between text-[#6b7280]"
                                  >
                                    <span>
                                      {item.product_name} × {item.quantity}
                                    </span>
                                    <span className="font-medium text-[#111827]">
                                      {formatRM(
                                        Number(item.price) * item.quantity
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-3 space-y-1 border-t border-[#e5e7eb] pt-3 text-sm">
                                <div className="flex justify-between text-[#6b7280]">
                                  <span>Subtotal</span>
                                  <span>
                                    {formatRM(Number(order.subtotal))}
                                  </span>
                                </div>
                                {Number(order.discount) > 0 && (
                                  <div className="flex justify-between text-[#6b7280]">
                                    <span>Discount</span>
                                    <span>
                                      -{formatRM(Number(order.discount))}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between text-[#6b7280]">
                                  <span>Tax</span>
                                  <span>{formatRM(Number(order.tax))}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-[#111827]">
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
              <p className="py-12 text-center text-sm text-[#6b7280]">
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

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
  getPaymentDotClass,
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

function PaymentIndicator({ method }: { method: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[#6b7280]">
      <span
        className={`h-2 w-2 rounded-full ${getPaymentDotClass(method)}`}
      />
      {getPaymentLabel(method)}
    </span>
  );
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
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && (
          <p className="mb-6 text-sm text-[#6b7280]">
            {orders.length} orders · {formatRM(totalRevenue)} total revenue
          </p>
        )}

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID or date..."
            disabled={loading}
            className="input-field h-11 pl-11 disabled:opacity-60"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="max-h-[calc(100vh-280px)] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="table-head border-b border-[#f0f0f0]">
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
                <tbody className="divide-y divide-[#f0f0f0]">
                  {filteredOrders.map((order) => {
                    const isExpanded = expandedId === order.id;
                    return (
                      <Fragment key={order.id}>
                        <tr
                          onClick={() => toggleExpand(order.id)}
                          className="table-row cursor-pointer"
                        >
                          <td className="px-4 text-[#9ca3af]">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-4 font-mono text-[#0f0f0f]">
                            {formatOrderId(order.id)}
                          </td>
                          <td className="px-4 text-[#6b7280]">
                            {formatOrderDateTime(order.created_at)}
                          </td>
                          <td className="max-w-xs truncate px-4 text-[#6b7280]">
                            {formatItemsSummary(order.items) || "—"}
                          </td>
                          <td className="px-4">
                            <PaymentIndicator
                              method={order.payment_method}
                            />
                          </td>
                          <td className="px-4 font-medium text-[#0f0f0f]">
                            {formatRM(Number(order.total))}
                          </td>
                          <td className="px-4 text-[#6b7280]">Completed</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-[#fafafa]">
                            <td colSpan={7} className="px-8 py-4">
                              <div className="expand-content ml-6 border-l-2 border-[#f0f0f0] pl-6">
                                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#9ca3af]">
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
                                      <span className="font-medium text-[#0f0f0f]">
                                        {formatRM(
                                          Number(item.price) * item.quantity
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                <div className="mt-3 space-y-1 border-t border-[#f0f0f0] pt-3 text-sm">
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
                                  <div className="flex justify-between font-semibold text-[#0f0f0f]">
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
            </div>

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

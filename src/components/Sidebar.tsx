"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  LayoutGrid,
  LogOut,
  Package,
  Receipt,
  Store,
} from "lucide-react";
import { getCartCount, logout } from "@/lib/auth";

const navItems = [
  { href: "/pos", label: "POS", icon: LayoutGrid },
  { href: "/products", label: "Products", icon: Package },
  { href: "/orders", label: "Orders", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setCartCount(getCartCount());

    function handleCartUpdate() {
      setCartCount(getCartCount());
    }

    window.addEventListener("cart-updated", handleCartUpdate);
    window.addEventListener("storage", handleCartUpdate);
    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
      window.removeEventListener("storage", handleCartUpdate);
    };
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-[#0a0a0a] text-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6366f1]">
          <Store className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">POS System</h1>
          <p className="text-xs text-gray-500">F&B & Retail</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          const showCartBadge = href === "/pos" && cartCount > 0;

          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[#6366f1] text-white shadow-lg shadow-indigo-500/20"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="relative shrink-0">
                <Icon className="h-5 w-5" />
                {showCartBadge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366f1] text-sm font-bold text-white">
              AD
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0a0a0a] bg-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Admin</p>
            <p className="text-xs text-gray-500">Manager</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-sm font-medium text-red-400 transition-colors hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Home,
  LayoutGrid,
  Package,
  Receipt,
} from "lucide-react";
import { getCartCount, logout } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
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
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[#0f0f0f]">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-xs font-semibold text-[#0f0f0f]">
          PS
        </div>
        <span className="text-sm font-semibold text-white">POS System</span>
      </div>

      <nav className="flex-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          const showCartBadge = href === "/pos" && cartCount > 0;

          return (
            <Link
              key={href}
              href={href}
              className={`relative mb-0.5 flex items-center gap-3 border-l-2 py-2.5 pl-3 pr-2 text-sm transition-colors ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-[#9ca3af] hover:text-white"
              }`}
            >
              <span className="relative">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {showCartBadge && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[9px] font-medium text-[#0f0f0f]">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#262626] text-xs font-medium text-white">
            AD
          </div>
          <div>
            <p className="text-[13px] text-white">Admin</p>
            <p className="text-xs text-[#9ca3af]">Manager</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 text-xs text-[#9ca3af] transition-colors hover:text-white"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

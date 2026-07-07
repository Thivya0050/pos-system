"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  Pill,
  Receipt,
  Settings,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";
import { clearSession, getSession } from "@/lib/auth";
import { getInitials } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cashier", label: "Cashier", icon: ShoppingCart },
  { href: "/members", label: "Members", icon: Users },
  { href: "/products", label: "Products", icon: Pill },
  { href: "/promotions", label: "Promotions", icon: Tag },
  { href: "/orders", label: "Orders", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/branches", label: "Branches", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = getSession();

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-14 shrink-0 flex-col items-center bg-[#1e293b] py-4">
      <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
        <Pill className="h-4 w-4 text-white" />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-white group-hover:block">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-xs font-medium text-white"
          title={session?.name ?? "Staff"}
        >
          {getInitials(session?.name ?? "AD")}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

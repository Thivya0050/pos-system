"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/pos": "Cashier",
  "/products": "Products",
  "/orders": "Orders",
  "/reports": "Reports",
};

export default function PageHeader() {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Dashboard";

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-[#f0f0f0] bg-white px-8">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Dashboard</span>
        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        <h1 className="text-lg font-semibold text-[#0f0f0f]">{title}</h1>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Settings } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/pos": "Cashier",
  "/products": "Products",
  "/orders": "Orders",
  "/reports": "Reports",
};

function formatDateTime(date: Date) {
  return date.toLocaleString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function PageHeader() {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const title = pageTitles[pathname] ?? "Dashboard";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between bg-white px-6 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        {title}
      </h1>

      <div className="flex items-center gap-4">
        <time className="hidden text-sm font-medium text-gray-500 sm:block">
          {now ? formatDateTime(now) : "—"}
        </time>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#6366f1]" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

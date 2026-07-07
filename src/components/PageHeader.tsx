"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/cashier": "Cashier",
  "/members": "Members",
  "/products": "Products",
  "/promotions": "Promotions",
  "/orders": "Orders",
  "/reports": "Reports",
  "/branches": "Branches",
  "/settings": "Settings",
};

export default function PageHeader() {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Dashboard";
  const session = getSession();
  const [branchName, setBranchName] = useState("Main Branch");
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleString("en-MY", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!session?.branchId) return;
    void (async () => {
      const { data } = await supabase
        .from("branches")
        .select("name")
        .eq("id", session.branchId)
        .single();
      const branch = data as { name?: string } | null;
      if (branch?.name) setBranchName(branch.name);
    })();
  }, [session?.branchId]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-white px-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[#64748b]">PharmaPOS</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#94a3b8]" />
        <h1 className="text-base font-semibold text-[#0f172a]">{title}</h1>
      </div>
      <div className="flex items-center gap-4 text-sm text-[#64748b]">
        <span>{branchName}</span>
        <span className="text-[#94a3b8]">|</span>
        <span>{time}</span>
      </div>
    </header>
  );
}

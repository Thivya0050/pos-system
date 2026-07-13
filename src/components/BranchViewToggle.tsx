"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useBranchViewFilter } from "@/hooks/useBranchViewFilter";
import { BRANCH_VIEW_ALL } from "@/lib/branch-view";
import { supabase } from "@/lib/supabase";
import type { Branch } from "@/types/database";

export default function BranchViewToggle() {
  const { branchView, setBranchView } = useBranchViewFilter();
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("name");
      setBranches((data ?? []) as Branch[]);
    })();
  }, []);

  const selectedLabel =
    branchView === BRANCH_VIEW_ALL
      ? "All Branches"
      : (branches.find((b) => b.id === branchView)?.name ?? "Branch");

  return (
    <label className="relative inline-flex items-center gap-1.5 text-sm text-[#64748b]">
      <span className="hidden sm:inline">Viewing:</span>
      <span className="font-medium text-[#0f172a]">{selectedLabel}</span>
      <ChevronDown className="h-3.5 w-3.5 text-[#94a3b8]" />
      <select
        value={branchView}
        onChange={(e) => setBranchView(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Select branch view"
      >
        <option value={BRANCH_VIEW_ALL}>All Branches</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );
}

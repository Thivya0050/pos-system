"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BRANCH_VIEW_ALL } from "@/lib/branch-view";

export function useBranchViewFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchView = searchParams.get("branchView") ?? BRANCH_VIEW_ALL;

  function setBranchView(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!next || next === BRANCH_VIEW_ALL) {
      params.delete("branchView");
    } else {
      params.set("branchView", next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return { branchView, setBranchView };
}

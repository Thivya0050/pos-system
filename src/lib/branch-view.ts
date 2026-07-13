import type { AuthSession } from "@/lib/auth";

export const BRANCH_VIEW_ALL = "all";

export function isAdminSession(session: AuthSession | null) {
  return session?.role?.trim().toLowerCase() === "admin";
}

export function isBranchScopedView(branchView: string) {
  return branchView !== BRANCH_VIEW_ALL;
}

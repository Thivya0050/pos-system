import { supabase } from "@/lib/supabase";

export async function createStaffCall(params: {
  branchId: string;
  kioskSessionId: string;
  reason?: string | null;
}) {
  return supabase.from("staff_calls").insert({
    branch_id: params.branchId,
    kiosk_session_id: params.kioskSessionId,
    reason: params.reason ?? null,
    status: "pending",
  });
}

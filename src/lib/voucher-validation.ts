import { supabase } from "@/lib/supabase";
import { formatRM } from "@/lib/utils";
import type { Member, Promotion } from "@/types/database";

export type VoucherValidationResult =
  | { ok: true }
  | { ok: false; message: string };

function tierDisplayLabel(tier: string) {
  if (tier === "silver") return "Silver";
  if (tier === "gold") return "Gold";
  if (tier === "platinum") return "Platinum";
  return tier;
}

export function validateVoucherEligibility({
  voucher,
  subtotal,
  member,
  memberRedemptionCount = 0,
  today = new Date().toISOString().slice(0, 10),
}: {
  voucher: Promotion;
  subtotal: number;
  member: Member | null;
  memberRedemptionCount?: number;
  today?: string;
}): VoucherValidationResult {
  if (voucher.start_date && voucher.start_date > today) {
    return { ok: false, message: "This voucher isn't active yet." };
  }

  if (voucher.end_date && voucher.end_date < today) {
    return { ok: false, message: "This voucher has expired." };
  }

  if (
    voucher.max_uses != null &&
    (voucher.uses_count ?? 0) >= voucher.max_uses
  ) {
    return { ok: false, message: "This voucher has reached its usage limit." };
  }

  if (voucher.min_spend != null && subtotal < Number(voucher.min_spend)) {
    return {
      ok: false,
      message: `Minimum spend of ${formatRM(Number(voucher.min_spend))} required for this voucher.`,
    };
  }

  if (voucher.applies_to && voucher.applies_to !== "all") {
    const requiredTier = voucher.applies_to;
    const memberTier = member?.tier ?? null;

    if (!memberTier || memberTier !== requiredTier) {
      return {
        ok: false,
        message: `This voucher is only valid for ${tierDisplayLabel(requiredTier)} members.`,
      };
    }
  }

  if (
    member &&
    voucher.max_uses_per_member != null &&
    memberRedemptionCount >= voucher.max_uses_per_member
  ) {
    return {
      ok: false,
      message: `This member has already used this voucher the maximum number of times (${voucher.max_uses_per_member}).`,
    };
  }

  return { ok: true };
}

export function calculateVoucherDiscount(voucher: Promotion, subtotal: number) {
  let discount = 0;
  if (voucher.discount_type === "fixed") {
    discount = Number(voucher.discount_value);
  } else if (voucher.discount_type === "percent") {
    discount = subtotal * (Number(voucher.discount_value) / 100);
  }
  return Math.min(discount, subtotal);
}

export async function getMemberVoucherRedemptionCount(
  memberId: string,
  promotionId: string
) {
  const { count, error } = await supabase
    .from("member_vouchers")
    .select("*", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("promotion_id", promotionId)
    .eq("is_used", true);

  if (error) return 0;
  return count ?? 0;
}

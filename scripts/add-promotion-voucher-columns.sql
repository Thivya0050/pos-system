-- Optional voucher fields for Promotions UI (run in Supabase SQL editor)
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS min_spend DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS max_uses_per_member INTEGER;

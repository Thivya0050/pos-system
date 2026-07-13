-- Staff assistance requests from self-checkout kiosks
CREATE TABLE IF NOT EXISTS staff_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id),
  kiosk_session_id TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staff_calls_branch_status_idx
  ON staff_calls (branch_id, status, created_at DESC);

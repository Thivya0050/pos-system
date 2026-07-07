-- Test voucher for cashier page (run in Supabase SQL editor)
INSERT INTO promotions (name, type, voucher_code, discount_type, discount_value, is_active, applies_to)
VALUES ('Welcome Discount', 'voucher', 'WELCOME10', 'fixed', 10.00, true, 'all')
ON CONFLICT DO NOTHING;

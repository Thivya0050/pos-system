-- Run this in the Supabase SQL Editor before using payment & discount features
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount decimal(10,2) default 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text default 'cash';

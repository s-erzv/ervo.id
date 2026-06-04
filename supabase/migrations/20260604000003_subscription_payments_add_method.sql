ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS payment_method_code text,
  ADD COLUMN IF NOT EXISTS payment_method_name text;

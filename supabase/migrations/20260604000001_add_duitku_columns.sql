-- Add Duitku payment gateway columns to subscription_payments
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS duitku_order_id   text,
  ADD COLUMN IF NOT EXISTS duitku_reference   text,
  ADD COLUMN IF NOT EXISTS payment_url        text;

CREATE INDEX IF NOT EXISTS idx_subscription_payments_duitku_order_id
  ON public.subscription_payments (duitku_order_id);

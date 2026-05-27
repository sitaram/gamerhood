-- Pre-payment print-area drift safeguard.
--
-- The `checkout.session.completed` webhook re-fetches the live Printful
-- print area for each line item before submitting the order to Printful.
-- If the live dimensions diverge from what we used to compute the design
-- size by more than 1% on either axis we flip `needs_manual_review`,
-- skip auto-fulfillment, and surface the order to admins via the
-- `[print-area-drift]` log + email notification.
--
-- The flag is intentionally separate from `status` (which already has a
-- CHECK constraint of pending|processing|shipped|delivered|cancelled and
-- is used by the customer-facing email + dashboard). Manual-review orders
-- stay in `processing` so the buyer sees their normal "Order Confirmed"
-- email; admins use this column to surface a follow-up queue.

alter table public.orders
  add column if not exists needs_manual_review boolean not null default false,
  add column if not exists manual_review_reason text;

create index if not exists idx_orders_needs_manual_review
  on public.orders (needs_manual_review)
  where needs_manual_review = true;

comment on column public.orders.needs_manual_review is
  'True when the pre-payment print-area drift safeguard tripped — fulfillment is held until an admin re-verifies.';
comment on column public.orders.manual_review_reason is
  'Human-readable reason the order was flagged (e.g. "print-area drift on variant 9220: expected 14×14, got 12×16").';

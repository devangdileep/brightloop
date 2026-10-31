-- Migration: 20261031000500_zero_total_invoices.sql
-- Description: Update payment sync trigger to automatically mark zero-total invoices as paid,
-- while strictly preserving draft, void, cancelled, and uncollectible statuses.

create or replace function public.sync_invoice_amount_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_paid numeric(12, 2);
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  if v_invoice_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where invoice_id = v_invoice_id;

  update public.invoices
  set
    amount_paid = case
      when total = 0 then 0.00
      else v_paid
    end,
    status = case
      -- Immutable / non-payable statuses must never be overwritten
      when status in ('draft', 'cancelled', 'void', 'uncollectible') then status
      -- Zero-total invoices are automatically marked as paid
      when total = 0 then 'paid'::public.invoice_status
      -- Fully paid invoices must result in paid
      when v_paid >= total and total > 0 then 'paid'::public.invoice_status
      -- Partial payments must result in partially_paid
      when v_paid > 0 and v_paid < total then 'partially_paid'::public.invoice_status
      -- Zero payments: if payment was deleted/reversed, restore to overdue or open
      when v_paid = 0 then
        case
          when due_date is not null and due_date < current_date then 'overdue'::public.invoice_status
          when status in ('paid', 'partially_paid') then 'open'::public.invoice_status
          else status
        end
      else status
    end,
    updated_at = now()
  where id = v_invoice_id;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists payments_sync_invoice on public.payments;
create trigger payments_sync_invoice
  after insert or update or delete on public.payments
  for each row execute function public.sync_invoice_amount_paid();

-- One-time reconciliation: update any existing zero-total open invoices to paid,
-- preserving draft, void, cancelled, and uncollectible invoices.
update public.invoices
set
  status = 'paid',
  amount_paid = 0.00,
  updated_at = now()
where total = 0
  and status not in ('draft', 'void', 'cancelled', 'uncollectible', 'paid');

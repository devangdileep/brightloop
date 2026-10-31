-- Row Level Security: every table is deny-by-default and opened explicitly.
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.discounts enable row level security;
alter table public.taxes enable row level security;
alter table public.app_settings enable row level security;
alter table public.counters enable row level security;

-- Profiles -------------------------------------------------------------------
create policy "Profiles: read own or staff read all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "Profiles: update own or admin update all"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Customers ------------------------------------------------------------------
create policy "Customers: staff manage"
  on public.customers for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Customers: portal user reads own record"
  on public.customers for select to authenticated
  using (user_id = auth.uid());

-- Products -------------------------------------------------------------------
create policy "Products: staff read"
  on public.products for select to authenticated
  using (public.is_staff());

create policy "Products: authenticated read active"
  on public.products for select to authenticated
  using (is_active = true);

create policy "Products: admin manage"
  on public.products for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Plans ----------------------------------------------------------------------
create policy "Plans: staff read"
  on public.plans for select to authenticated
  using (public.is_staff());

create policy "Plans: authenticated read active"
  on public.plans for select to authenticated
  using (is_active = true);

create policy "Plans: admin manage"
  on public.plans for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Taxes & discounts ----------------------------------------------------------
create policy "Taxes: staff read"
  on public.taxes for select to authenticated
  using (public.is_staff());

create policy "Taxes: admin manage"
  on public.taxes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Discounts: staff read"
  on public.discounts for select to authenticated
  using (public.is_staff());

create policy "Discounts: admin manage"
  on public.discounts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Subscriptions --------------------------------------------------------------
create policy "Subscriptions: staff manage"
  on public.subscriptions for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Subscriptions: customer reads own"
  on public.subscriptions for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = subscriptions.customer_id and c.user_id = auth.uid()
    )
  );

-- Quotations -----------------------------------------------------------------
create policy "Quotations: staff manage"
  on public.quotations for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Quotations: customer reads own"
  on public.quotations for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = quotations.customer_id and c.user_id = auth.uid()
    )
  );

create policy "Quotation items: staff manage"
  on public.quotation_items for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Quotation items: customer reads own"
  on public.quotation_items for select to authenticated
  using (
    exists (
      select 1
      from public.quotations q
      join public.customers c on c.id = q.customer_id
      where q.id = quotation_items.quotation_id and c.user_id = auth.uid()
    )
  );

-- Invoices -------------------------------------------------------------------
create policy "Invoices: staff manage"
  on public.invoices for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Invoices: customer reads own"
  on public.invoices for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = invoices.customer_id and c.user_id = auth.uid()
    )
  );

create policy "Invoice items: staff manage"
  on public.invoice_items for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Invoice items: customer reads own"
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      join public.customers c on c.id = i.customer_id
      where i.id = invoice_items.invoice_id and c.user_id = auth.uid()
    )
  );

-- Payments -------------------------------------------------------------------
create policy "Payments: staff manage"
  on public.payments for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Payments: customer reads own"
  on public.payments for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = payments.customer_id and c.user_id = auth.uid()
    )
  );

-- Settings -------------------------------------------------------------------
create policy "Settings: authenticated read"
  on public.app_settings for select to authenticated
  using (true);

create policy "Settings: admin update"
  on public.app_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Storage --------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Documents: staff manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_staff())
  with check (bucket_id = 'documents' and public.is_staff());

create policy "Documents: customer reads own invoice documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'invoices'
    and exists (
      select 1 from public.customers c
      where c.id::text = (storage.foldername(name))[2]
        and c.user_id = auth.uid()
    )
  );

-- =====================================================================
-- Nail Management — Supabase schema + RLS
-- Run this whole file in Supabase → SQL Editor.
-- Requires: Clerk added as a Third-Party Auth provider in Supabase,
-- and the Clerk session token containing an "email" claim.
-- =====================================================================

-- ---------- Tables ----------
-- Money: every amount (price, discount, tip, total) is an integer number of US cents.
--   3500 = $35.00
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,   -- null = staff member without a login (e.g. a technician added by the owner)
  email text,
  full_name text,
  role text not null default 'pending'
    check (role in ('admin', 'receptionist', 'technician', 'pending')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- For databases created before staff without a login existed
alter table public.profiles alter column clerk_user_id drop not null;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  price integer not null check (price >= 0),
  duration_min integer not null default 30 check (duration_min > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.salon_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.salon_tables(id),
  customer_name text,
  customer_phone text,
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  discount integer not null default 0 check (discount >= 0),
  tip integer not null default 0 check (tip >= 0),
  total integer not null default 0,
  payment_method text check (payment_method in ('cash', 'transfer', 'card')),
  note text,
  opened_at timestamptz not null default now(),
  paid_at timestamptz,
  created_by uuid references public.profiles(id)
);

-- Each table can have at most one open ticket
create unique index if not exists one_open_ticket_per_table
  on public.tickets(table_id) where status = 'open';
create index if not exists tickets_paid_at_idx on public.tickets(paid_at);

create table if not exists public.ticket_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  service_id uuid references public.services(id),
  name text not null,          -- name/price stored at time of sale
  price integer not null check (price >= 0),
  qty integer not null default 1 check (qty > 0),
  technician_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists ticket_items_ticket_idx on public.ticket_items(ticket_id);

-- ---------- Helper functions ----------
-- Role of the signed-in user (null if no profile or deactivated)
create or replace function public.current_role_name()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles
  where clerk_user_id = (auth.jwt() ->> 'sub') and active
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() in ('admin', 'receptionist', 'technician'), false) $$;

create or replace function public.can_cashier()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() in ('admin', 'receptionist'), false) $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() = 'admin', false) $$;

-- Creates the profile on first sign-in. The owner's email is always admin.
-- SIMPLE MODE (v_everyone_is_admin = true): EVERYONE who can sign in becomes admin.
--   Only safe when sign-ups are restricted in Clerk (invite-only / allowlist).
--   Set it to false to go back to "new accounts wait for approval as 'pending'".
create or replace function public.ensure_profile(p_full_name text default null)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_owner constant text := 'buitritinht@gmail.com';
  v_everyone_is_admin constant boolean := true;
  r public.profiles;
begin
  if v_sub is null then
    raise exception 'Not signed in';
  end if;

  select * into r from public.profiles where clerk_user_id = v_sub;

  if not found then
    insert into public.profiles (clerk_user_id, email, full_name, role)
    values (
      v_sub,
      nullif(v_email, ''),
      coalesce(nullif(p_full_name, ''), nullif(v_email, ''), 'New staff'),
      case when v_everyone_is_admin or v_email = v_owner then 'admin' else 'pending' end
    )
    returning * into r;
  elsif v_email = v_owner and (r.role <> 'admin' or not r.active) then
    update public.profiles set role = 'admin', active = true
    where id = r.id returning * into r;
  elsif v_everyone_is_admin and r.role = 'pending' and r.active then
    -- accounts created before simple mode was switched on
    update public.profiles set role = 'admin'
    where id = r.id returning * into r;
  end if;

  return r;
end;
$$;

-- Prevent demoting / deactivating the owner account
create or replace function public.protect_owner()
returns trigger language plpgsql as $$
begin
  if lower(old.email) = 'buitritinht@gmail.com' then
    new.role := 'admin';
    new.active := true;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_owner_trg on public.profiles;
create trigger protect_owner_trg before update on public.profiles
  for each row execute function public.protect_owner();

-- Open a table
create or replace function public.open_ticket(
  p_table_id uuid, p_customer_name text default null, p_customer_phone text default null
) returns public.tickets
language plpgsql security definer set search_path = public
as $$
declare r public.tickets; v_profile uuid;
begin
  if not public.can_cashier() then raise exception 'You do not have permission to open tables'; end if;
  select id into v_profile from public.profiles where clerk_user_id = (auth.jwt() ->> 'sub');
  insert into public.tickets (table_id, customer_name, customer_phone, created_by)
  values (p_table_id, nullif(p_customer_name, ''), nullif(p_customer_phone, ''), v_profile)
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'This table already has a customer';
end;
$$;

-- Payment: totals are computed in the database
create or replace function public.pay_ticket(
  p_ticket_id uuid, p_method text, p_discount integer default 0, p_tip integer default 0
) returns public.tickets
language plpgsql security definer set search_path = public
as $$
declare r public.tickets; v_sub integer;
begin
  if not public.can_cashier() then raise exception 'You do not have permission to take payment'; end if;
  if p_method not in ('cash', 'transfer', 'card') then raise exception 'Invalid payment method'; end if;

  select * into r from public.tickets where id = p_ticket_id for update;
  if not found or r.status <> 'open' then raise exception 'This bill is no longer open'; end if;

  select coalesce(sum(price * qty), 0) into v_sub from public.ticket_items where ticket_id = p_ticket_id;
  if v_sub = 0 then raise exception 'The bill has no services yet'; end if;

  update public.tickets set
    status = 'paid',
    payment_method = p_method,
    discount = least(greatest(p_discount, 0), v_sub),
    tip = greatest(p_tip, 0),
    total = v_sub - least(greatest(p_discount, 0), v_sub) + greatest(p_tip, 0),
    paid_at = now()
  where id = p_ticket_id returning * into r;
  return r;
end;
$$;

-- Cancel a bill
create or replace function public.cancel_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql security definer set search_path = public
as $$
declare r public.tickets;
begin
  if not public.can_cashier() then raise exception 'You do not have permission to cancel bills'; end if;
  update public.tickets set status = 'cancelled'
  where id = p_ticket_id and status = 'open' returning * into r;
  if not found then raise exception 'This bill is no longer open'; end if;
  return r;
end;
$$;

-- A technician can only be on ONE open bill at a time. They become free again
-- when that bill is paid or cancelled. Checked here so it holds on every device.
create or replace function public.check_technician_free()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.technician_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.technician_id is not distinct from old.technician_id then
    return new;
  end if;

  -- serialise concurrent assignments of the same technician
  perform pg_advisory_xact_lock(hashtext(new.technician_id::text));

  if exists (
    select 1
    from public.ticket_items i
    join public.tickets t on t.id = i.ticket_id
    where i.technician_id = new.technician_id
      and t.status = 'open'
      and i.ticket_id <> new.ticket_id
  ) then
    raise exception 'This technician is already working at another table';
  end if;

  return new;
end;
$$;

drop trigger if exists ticket_items_technician_free on public.ticket_items;
create trigger ticket_items_technician_free
  before insert or update of technician_id on public.ticket_items
  for each row execute function public.check_technician_free();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.salon_tables enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_items enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (clerk_user_id = (auth.jwt() ->> 'sub') or public.is_staff());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- services
drop policy if exists services_select on public.services;
create policy services_select on public.services for select to authenticated using (public.is_staff());
drop policy if exists services_write on public.services;
create policy services_write on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- salon_tables
drop policy if exists tables_select on public.salon_tables;
create policy tables_select on public.salon_tables for select to authenticated using (public.is_staff());
drop policy if exists tables_write on public.salon_tables;
create policy tables_write on public.salon_tables for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tickets: readable by staff; editable while open. Open/pay/cancel go through functions.
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated using (public.is_staff());
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update to authenticated
  using (public.can_cashier() and status = 'open')
  with check (public.can_cashier() and status = 'open');

-- ticket_items
drop policy if exists items_select on public.ticket_items;
create policy items_select on public.ticket_items for select to authenticated using (public.is_staff());
drop policy if exists items_write on public.ticket_items;
create policy items_write on public.ticket_items for all to authenticated
  using (
    public.can_cashier()
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.status = 'open')
  )
  with check (
    public.can_cashier()
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.status = 'open')
  );

-- Function / table grants
revoke all on function public.ensure_profile(text) from public, anon;
revoke all on function public.open_ticket(uuid, text, text) from public, anon;
revoke all on function public.pay_ticket(uuid, text, integer, integer) from public, anon;
revoke all on function public.cancel_ticket(uuid) from public, anon;
grant execute on function public.ensure_profile(text) to authenticated;
grant execute on function public.open_ticket(uuid, text, text) to authenticated;
grant execute on function public.pay_ticket(uuid, text, integer, integer) to authenticated;
grant execute on function public.cancel_ticket(uuid) to authenticated;

-- ---------- Sample data (delete if not needed) ----------
insert into public.salon_tables (name, sort_order)
select 'Table ' || g, g from generate_series(1, 8) g
where not exists (select 1 from public.salon_tables);

insert into public.services (name, category, price, duration_min)
select * from (values
  ('Gel manicure',            'Polish',       3500, 45),
  ('Gel pedicure',            'Polish',       4500, 50),
  ('Regular polish (hands)',  'Polish',        2000, 30),
  ('Gel extensions',          'Nail work',    6500, 75),
  ('Acrylic full set',        'Nail work',    7500, 90),
  ('Removal',                 'Nail work',     1500, 20),
  ('Nail art (per nail)',     'Decoration',     500, 10),
  ('Rhinestones (per nail)',  'Decoration',     300, 5),
  ('Hand care',               'Care',         2500, 30),
  ('Foot massage',            'Care',         4000, 30)
) as v(name, category, price, duration_min)
where not exists (select 1 from public.services);

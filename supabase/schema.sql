-- Canonical schema for the HayloFriend Supabase project.
-- This file is safe to run multiple times (idempotent).

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;

-- ============================================================================
-- Shared utilities
-- ============================================================================

-- Generic updated_at trigger (reused for tables that need it).
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================================
-- profiles: user-facing profile + Stripe Connect metadata
-- Required by /your-impact and payout flows
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  slug citext unique,
  avatar_url text,
  stripe_account_id text,
  role text not null default 'creator',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_slug_format check (
    slug is null or slug ~ '^[a-z0-9](?:[a-z0-9-_]*[a-z0-9])?$'
  )
);

-- Extra columns used by the app (Stripe + Pro flags)
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists charges_enabled boolean default false,
  add column if not exists payouts_enabled boolean default false,
  add column if not exists is_pro boolean default false,
  add column if not exists pro_expires_at timestamptz;

comment on table public.profiles is
  'User profile fields + Stripe Connect metadata used by the dashboard and payouts flows.';
comment on column public.profiles.slug is
  'Public handle used in thank-you URLs (case-insensitive).';
comment on column public.profiles.stripe_account_id is
  'Stripe Connect account id attached during onboarding.';

-- updated_at trigger
drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

-- RLS for profiles
alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles can view own row'
  ) then
    create policy "Profiles can view own row"
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles can insert own row'
  ) then
    create policy "Profiles can insert own row"
      on public.profiles
      for insert
      with check (auth.uid() = id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles can update own row'
  ) then
    create policy "Profiles can update own row"
      on public.profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- ============================================================================
-- leads: simple capture table for pre-signup interest
-- ============================================================================

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  created_date date generated always as (created_at::date) stored,
  email text,
  source text
);

comment on table public.leads is 'Email leads captured from marketing pages.';

-- RLS for leads (optional: service_role only; keep simple for now)
alter table public.leads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'leads'
      and policyname = 'Leads insert (public)'
  ) then
    create policy "Leads insert (public)"
      on public.leads
      for insert
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'leads'
      and policyname = 'Leads select (service_role)'
  ) then
    create policy "Leads select (service_role)"
      on public.leads
      for select
      to service_role
      using (true);
  end if;
end $$;

-- ============================================================================
-- events: lightweight activity log that powers dashboard timeline and KPIs
-- ============================================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('tip','share','payout','system')),
  label text not null,
  value text,
  amount_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.events is
  'Per-user activity feed items (tips, shares, payouts, system notices).';
comment on column public.events.amount_cents is
  'Signed integer amount in cents used for dashboard aggregates.';

create index if not exists events_user_created_idx
  on public.events (user_id, created_at desc);

alter table public.events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'Users can view their events'
  ) then
    create policy "Users can view their events"
      on public.events
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'Users can insert their events'
  ) then
    create policy "Users can insert their events"
      on public.events
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================================
-- subscriptions: Haylo Pro (user_id) + creator subscriptions (subscriber_id/creator_id)
-- ============================================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  -- For Haylo Pro: user subscribing for platform features
  user_id uuid references auth.users(id) on delete cascade,

  -- For creator subs: fan/supporter & creator
  subscriber_id uuid references auth.users(id) on delete cascade,
  creator_id uuid references auth.users(id) on delete cascade,

  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_product_id text,

  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  cancel_at_period_end boolean default false,

  amount_cents integer,
  currency text default 'usd',
  billing_interval text,

  title text,
  description text,
  affiliate_url text,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.subscriptions is
  'Recurring payments: Haylo Pro + creator subscriptions.';
comment on column public.subscriptions.user_id is
  'For Haylo Pro: the user who subscribed for platform features.';
comment on column public.subscriptions.subscriber_id is
  'Fan/supporter paying a creator.';
comment on column public.subscriptions.creator_id is
  'Creator/friend receiving recurring revenue.';

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.handle_updated_at();

alter table public.subscriptions enable row level security;

-- Both sides (and Pro user) can select their own subscriptions
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'subscriptions-select-actors'
  ) then
    create policy "subscriptions-select-actors"
      on public.subscriptions
      for select
      using (
        auth.uid() = user_id
        or auth.uid() = subscriber_id
        or auth.uid() = creator_id
      );
  end if;
end $$;

-- Subscriber / Pro user can update their own subscription
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'subscriptions-update-owner'
  ) then
    create policy "subscriptions-update-owner"
      on public.subscriptions
      for update
      using (
        auth.uid() = user_id
        or auth.uid() = subscriber_id
      )
      with check (
        auth.uid() = user_id
        or auth.uid() = subscriber_id
      );
  end if;
end $$;

-- Inserts typically come from server (Stripe webhooks)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'subscriptions-insert-server'
  ) then
    create policy "subscriptions-insert-server"
      on public.subscriptions
      for insert
      to service_role
      with check (true);
  end if;
end $$;

-- ============================================================================
-- transactions: money events (tips + subscription charges)
-- ============================================================================

create table if not exists public.transactions (
  id bigserial primary key,

  buyer_user_id uuid,          -- payer/fan
  creator_user_id uuid,        -- creator/friend

  amount integer,              -- gross amount in cents
  currency text default 'usd',

  app_fee_amount integer,      -- platform fee in cents

  stripe_payment_intent text,
  stripe_checkout_sess text,
  stripe_destination_acct text,

  status text,

  kind text,                   -- 'tip', 'subscription_initial', 'subscription_renewal', ...
  subscription_id uuid references public.subscriptions(id),

  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.transactions is
  'Money events: who paid whom, via Stripe, for tips or subscriptions.';
comment on column public.transactions.buyer_user_id is
  'auth.users.id of the payer/fan.';
comment on column public.transactions.creator_user_id is
  'auth.users.id of the creator/friend receiving the funds.';
comment on column public.transactions.amount is
  'Gross amount in cents (integer).';
comment on column public.transactions.app_fee_amount is
  'Platform fee in cents (rev share + instant-withdraw fee).';
comment on column public.transactions.kind is
  'Event type: tip, subscription_initial, subscription_renewal.';
comment on column public.transactions.subscription_id is
  'Optional link to public.subscriptions.id for recurring payments.';

alter table public.transactions enable row level security;

-- Buyer or creator can see their own transactions
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'transactions-select-own'
  ) then
    create policy "transactions-select-own"
      on public.transactions
      for select
      using (
        auth.uid() = buyer_user_id
        or auth.uid() = creator_user_id
      );
  end if;
end $$;

-- Inserts from server (Stripe webhooks / backend)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'transactions-insert-server'
  ) then
    create policy "transactions-insert-server"
      on public.transactions
      for insert
      to service_role
      with check (true);
  end if;
end $$;

-- ============================================================================
-- payouts: money leaving platform to creators
-- ============================================================================

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid,                     -- creator's user id
  transaction_id bigint references public.transactions(id) on delete set null,
  stripe_transfer_id text,
  stripe_payout_id text,
  net_amount_cents integer,
  payout_type text,                   -- 'instant' or 'scheduled'
  payout_scheduled_for timestamptz,
  payout_completed_at timestamptz,
  status text,                        -- 'pending', 'processing', 'paid', 'failed'
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.payouts is
  'Transfers from platform to creators (Stripe Connect payouts).';

alter table public.payouts enable row level security;

-- Creator can see their own payouts
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'payouts-select-own'
  ) then
    create policy "payouts-select-own"
      on public.payouts
      for select
      using (auth.uid() = seller_id);
  end if;
end $$;

-- Inserts from server only
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'payouts-insert-server'
  ) then
    create policy "payouts-insert-server"
      on public.payouts
      for insert
      to service_role
      with check (true);
  end if;
end $$;

-- ============================================================================
-- dashboard_totals(): RPC for /your-impact KPI cards
-- ============================================================================

create or replace function public.dashboard_totals()
returns table (
  today numeric,
  week numeric,
  tips integer,
  referrals integer,
  approved numeric,
  paid numeric
)
language sql
security definer
set search_path = public
as $$
  with scoped_events as (
    select *
    from public.events
    where user_id = auth.uid()
  ),
  sums as (
    select
      coalesce(sum(case when type = 'tip'
                         and created_at >= timezone('utc', now()) - interval '1 day'
                        then amount_cents end), 0) as cents_today,
      coalesce(sum(case when type = 'tip'
                         and created_at >= timezone('utc', now()) - interval '7 days'
                        then amount_cents end), 0) as cents_week,
      coalesce(sum(case when type = 'tip' then amount_cents end), 0) as cents_all,
      coalesce(sum(case when type = 'payout' then amount_cents end), 0) as cents_paid,
      coalesce(count(*) filter (where type = 'tip'), 0) as tips,
      coalesce(count(*) filter (where type = 'share'), 0) as referrals
    from scoped_events
  )
  select
    (cents_today / 100.0)::numeric as today,
    (cents_week / 100.0)::numeric as week,
    tips,
    referrals,
    greatest((cents_all - cents_paid) / 100.0, 0)::numeric as approved,
    (cents_paid / 100.0)::numeric as paid
  from sums;
$$;

grant execute on function public.dashboard_totals() to authenticated;

-- ============================================================================
-- creator_available_balance: compute withdrawable balance for a creator
-- ============================================================================

create or replace function public.creator_available_balance(
  in_creator_id uuid
)
returns table (
  available_cents integer,
  currency text
)
language sql
stable
as $$
  with credits as (
    select
      -- Creator's earnings = gross - platform fee
      coalesce(sum(amount - coalesce(app_fee_amount, 0)), 0) as total_cents,
      max(currency) as currency
    from public.transactions
    where creator_user_id = in_creator_id
      -- Only count successful/settled transactions.
      -- Adjust this status list if you use different values.
      and (
        status is null
        or status in ('succeeded', 'paid')
      )
  ),
  debits as (
    select
      coalesce(sum(net_amount_cents), 0) as total_cents
    from public.payouts
    where seller_id = in_creator_id
      -- Treat pending/processing/paid as "already reserved"
      and status in ('pending', 'processing', 'paid')
  )
  select
    greatest(c.total_cents - d.total_cents, 0) as available_cents,
    coalesce(c.currency, 'usd') as currency
  from credits c, debits d;
$$;

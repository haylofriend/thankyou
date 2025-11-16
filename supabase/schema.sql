-- supabase/schema.sql
-- Canonical schema for the Thank-You Link Supabase project.
-- Tables & functions follow the data flows implemented in /public/your-impact
-- and the supporting API routes under /api.

-- Ensure helper extensions exist (Supabase exposes them under the extensions schema).
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;

-- ============================================================================
-- profiles: mirrors the authenticated user and stores creator-specific fields.
-- Required by the dashboard (slug, display_name, avatar_url) and Stripe flows
-- that expect stripe_account_id to be persisted.
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

comment on table public.profiles is 'User profile fields + Stripe Connect metadata used by the dashboard and payouts flows.';
comment on column public.profiles.slug is 'Public handle used in thank-you URLs (case-insensitive).';
comment on column public.profiles.stripe_account_id is 'Stripe Connect account id attached during onboarding.';

-- Generic updated_at trigger (can be reused for other tables later).
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

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
-- events: lightweight activity log that powers the dashboard timeline and
-- aggregates (tips, shares, payouts). Amounts are tracked in cents for safe math.
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

comment on table public.events is 'Per-user activity feed items (tips, shares, payouts, system notices).';
comment on column public.events.amount_cents is 'Signed integer amount in cents used for dashboard aggregates.';

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
-- dashboard_totals(): RPC consumed by /public/your-impact to render KPI cards.
-- Aggregates the events table for the authenticated user.
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

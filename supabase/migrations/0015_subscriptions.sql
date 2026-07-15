create table if not exists public.subscriptions (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users(id) on delete cascade,
  stripe_customer_id     text        unique,
  stripe_subscription_id text        unique,
  status                 text        not null default 'trialing',  -- trialing | active | past_due | canceled
  plan                   text        not null default 'pro',
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id)
);

alter table public.subscriptions enable row level security;

create policy "users see own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

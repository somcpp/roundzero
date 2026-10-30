-- Hackathons: the core record every other table (projects, judges, criteria…)
-- will hang off. Each hackathon belongs to the admin who created it.

create table public.hackathons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  name text not null check (char_length(name) between 1 and 120),
  tagline text not null default '' check (char_length(tagline) <= 200),
  starts_on date,
  ends_on date,
  -- text + check rather than an enum, so stages are easy to add or rename later.
  stage text not null default 'setup' check (stage in ('setup', 'judging', 'results')),
  color text not null default '#6e56e7' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- 1–3 letter mark; null means "derive from the name".
  logo text check (char_length(logo) between 1 and 3),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index hackathons_owner_id_idx on public.hackathons (owner_id);

-- Keep updated_at current on every write.
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger hackathons_set_updated_at
before update on public.hackathons
for each row execute function public.set_updated_at();

-- Row level security: admins manage their own hackathons; anyone can read a
-- hackathon once its results are published (the public /w winners page).
alter table public.hackathons enable row level security;

create policy "Owners can read their hackathons"
on public.hackathons for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Anyone can read published hackathons"
on public.hackathons for select
to anon, authenticated
using (published);

create policy "Owners can create hackathons"
on public.hackathons for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update their hackathons"
on public.hackathons for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their hackathons"
on public.hackathons for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- Expose the table to the Data API (needed when new tables aren't exposed by default).
grant select on public.hackathons to anon;
grant select, insert, update, delete on public.hackathons to authenticated;

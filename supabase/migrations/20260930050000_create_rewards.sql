-- Rewards: prize tiers, who wins each one, and the items a winner receives.
-- Edited as a whole ordered list from Results › Rewards. Each tier can carry a
-- square prize image in the reward-images bucket.

create table public.reward_tiers (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  -- 0-based display order.
  position integer not null check (position >= 0),
  name text not null check (char_length(name) between 1 and 80),
  -- Shown under the tier name in winner emails and on the winners page.
  description text not null default '' check (char_length(description) <= 500),
  -- 'ranks' goes to final ranks rank_from–rank_to; 'categories' to each
  -- category winner; 'custom' to projects picked by hand on the results page.
  recipients text not null default 'ranks' check (recipients in ('ranks', 'categories', 'custom')),
  rank_from integer check (rank_from between 1 and 1000),
  rank_to integer check (rank_to between 1 and 1000),
  -- Object path in the reward-images bucket: <hackathon_id>/<tier_id>/<file>.
  -- Must sit in this hackathon's own folder, so one can't point at another's image.
  image_path text check (char_length(image_path) <= 512 and image_path like hackathon_id::text || '/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reward_tiers_rank_range check (
    case when recipients = 'ranks'
      then rank_from is not null and rank_to is not null and rank_from <= rank_to
      else rank_from is null and rank_to is null
    end
  )
);

create index reward_tiers_hackathon_id_position_idx on public.reward_tiers (hackathon_id, position);

create trigger reward_tiers_set_updated_at
before update on public.reward_tiers
for each row execute function public.set_updated_at();

-- What a winner of the tier gets, in the order the email lists them.
create table public.reward_items (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.reward_tiers (id) on delete cascade,
  position integer not null check (position >= 0),
  -- Text + check rather than an enum, so it's easy to add more.
  kind text not null check (kind in ('cash', 'credits', 'link', 'code', 'text', 'image', 'file', 'swag')),
  label text not null check (char_length(label) between 1 and 200),
  -- The redeemable part: a URL for links and files, a code for codes and credits.
  detail text not null default '' check (char_length(detail) <= 2000)
);

create index reward_items_tier_id_position_idx on public.reward_items (tier_id, position);

-- Row level security: only the hackathon's owner can see or change its rewards.
alter table public.reward_tiers enable row level security;
alter table public.reward_items enable row level security;

create policy "Owners can read their reward tiers" on public.reward_tiers for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create reward tiers" on public.reward_tiers for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their reward tiers" on public.reward_tiers for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can delete their reward tiers" on public.reward_tiers for delete to authenticated
using (public.owns_hackathon(hackathon_id));

-- Items follow their tier.
create policy "Owners can read their reward items" on public.reward_items for select to authenticated
using (exists (select 1 from public.reward_tiers t where t.id = tier_id and public.owns_hackathon(t.hackathon_id)));
create policy "Owners can create reward items" on public.reward_items for insert to authenticated
with check (exists (select 1 from public.reward_tiers t where t.id = tier_id and public.owns_hackathon(t.hackathon_id)));
create policy "Owners can delete their reward items" on public.reward_items for delete to authenticated
using (exists (select 1 from public.reward_tiers t where t.id = tier_id and public.owns_hackathon(t.hackathon_id)));

grant select, insert, update, delete on public.reward_tiers to authenticated;
grant select, insert, delete on public.reward_items to authenticated;

-- Replace a hackathon's rewards in one transaction: tiers missing from p_tiers
-- are deleted, the rest are upserted in array order, and every tier's items
-- are replaced with its "items" array. Runs as the caller, so the policies
-- above decide what it can touch.
create function public.save_reward_tiers(p_hackathon_id uuid, p_tiers jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  delete from public.reward_tiers
  where hackathon_id = p_hackathon_id
    and id not in (select (t ->> 'id')::uuid from jsonb_array_elements(p_tiers) t);

  insert into public.reward_tiers as r
    (id, hackathon_id, position, name, description, recipients, rank_from, rank_to, image_path)
  select
    (t.value ->> 'id')::uuid,
    p_hackathon_id,
    (t.ordinality - 1)::integer,
    t.value ->> 'name',
    coalesce(t.value ->> 'description', ''),
    coalesce(t.value ->> 'recipients', 'ranks'),
    (t.value ->> 'rank_from')::integer,
    (t.value ->> 'rank_to')::integer,
    nullif(t.value ->> 'image_path', '')
  from jsonb_array_elements(p_tiers) with ordinality as t (value, ordinality)
  on conflict (id) do update set
    position = excluded.position,
    name = excluded.name,
    description = excluded.description,
    recipients = excluded.recipients,
    rank_from = excluded.rank_from,
    rank_to = excluded.rank_to,
    image_path = excluded.image_path
  -- An id from another hackathon is left alone rather than moved.
  where r.hackathon_id = excluded.hackathon_id;

  delete from public.reward_items i
  using public.reward_tiers t
  where t.id = i.tier_id and t.hackathon_id = p_hackathon_id;

  insert into public.reward_items (id, tier_id, position, kind, label, detail)
  select
    coalesce((i.value ->> 'id')::uuid, gen_random_uuid()),
    r.id,
    (i.ordinality - 1)::integer,
    i.value ->> 'kind',
    i.value ->> 'label',
    coalesce(i.value ->> 'detail', '')
  from jsonb_array_elements(p_tiers) t (value)
  join public.reward_tiers r on r.id = (t.value ->> 'id')::uuid and r.hackathon_id = p_hackathon_id
  cross join lateral jsonb_array_elements(coalesce(t.value -> 'items', '[]')) with ordinality as i (value, ordinality)
  -- An item id that belongs to another hackathon's tier is skipped, not moved.
  on conflict (id) do nothing;
end;
$$;

revoke execute on function public.save_reward_tiers(uuid, jsonb) from public, anon;
grant execute on function public.save_reward_tiers(uuid, jsonb) to authenticated;

-- Every hackathon starts with a typical prize table to edit from.
create function public.seed_reward_tiers(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_grand uuid := gen_random_uuid();
  v_podium uuid := gen_random_uuid();
  v_finalists uuid := gen_random_uuid();
  v_category uuid := gen_random_uuid();
begin
  insert into public.reward_tiers (id, hackathon_id, position, name, recipients, rank_from, rank_to)
  values
    (v_grand, p_hackathon_id, 0, 'Grand prize', 'ranks', 1, 1),
    (v_podium, p_hackathon_id, 1, 'Runners-up', 'ranks', 2, 3),
    (v_finalists, p_hackathon_id, 2, 'Top 10 finalists', 'ranks', 1, 10),
    (v_category, p_hackathon_id, 3, 'Category winners', 'categories', null, null);

  insert into public.reward_items (tier_id, position, kind, label)
  values
    (v_grand, 0, 'cash', '$5,000 cash'),
    (v_grand, 1, 'credits', '100,000 API credits'),
    (v_podium, 0, 'cash', '$2,000 cash'),
    (v_podium, 1, 'credits', '25,000 API credits'),
    (v_finalists, 0, 'credits', '5,000 API credits'),
    (v_finalists, 1, 'swag', 'Swag pack'),
    (v_category, 0, 'credits', '10,000 API credits');
end;
$$;

revoke execute on function public.seed_reward_tiers(uuid) from public, anon;
grant execute on function public.seed_reward_tiers(uuid) to authenticated;

create function public.seed_hackathon_reward_tiers()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.seed_reward_tiers(new.id);
  return new;
end;
$$;

create trigger hackathons_seed_4_reward_tiers
after insert on public.hackathons
for each row execute function public.seed_hackathon_reward_tiers();

-- Backfill hackathons created before this table existed.
select public.seed_reward_tiers(id) from public.hackathons;

-- ── Storage ───────────────────────────────────────────────────────────────
-- Public bucket: prize images show in winner emails and on the winners page,
-- and paths are unguessable ids. Only the hackathon's owner can write to its
-- folder (the first path segment is the hackathon id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reward-images', 'reward-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Owners can read their reward images" on storage.objects for select to authenticated
using (bucket_id = 'reward-images' and public.owns_hackathon_folder(objects.name));
create policy "Owners can upload reward images" on storage.objects for insert to authenticated
with check (bucket_id = 'reward-images' and public.owns_hackathon_folder(objects.name));
create policy "Owners can update their reward images" on storage.objects for update to authenticated
using (bucket_id = 'reward-images' and public.owns_hackathon_folder(objects.name))
with check (bucket_id = 'reward-images' and public.owns_hackathon_folder(objects.name));
create policy "Owners can delete their reward images" on storage.objects for delete to authenticated
using (bucket_id = 'reward-images' and public.owns_hackathon_folder(objects.name));

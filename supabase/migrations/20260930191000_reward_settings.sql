-- Hackathon-wide reward rules: one row per hackathon, edited from Judging ›
-- Rewards › Settings. A hackathon without a row uses the defaults.
--
-- one_win_per_entrant: a person or team with several projects wins at most
-- one reward. Projects are the same entrant when they share a member in a
-- Team field. Their best-placed project keeps its prize and the places below
-- move up (lib/prize-places.ts); awards skip entrants that already won.

create table public.reward_settings (
  hackathon_id uuid primary key references public.hackathons (id) on delete cascade,
  one_win_per_entrant boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reward_settings_set_updated_at
before update on public.reward_settings
for each row execute function public.set_updated_at();

-- Row level security: only the hackathon's owner can see or change it.
alter table public.reward_settings enable row level security;

create policy "Owners can read their reward settings" on public.reward_settings for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create reward settings" on public.reward_settings for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their reward settings" on public.reward_settings for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));

grant select, insert, update on public.reward_settings to authenticated;

-- The winners page is read signed out, so it can't see reward_settings. Like
-- public_results(), this hands it just the rule it needs to place prizes:
-- for a published hackathon, or to its owner as a preview. Null otherwise.
create function public.public_reward_settings(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('one_win_per_entrant', coalesce(s.one_win_per_entrant, false))
  from public.hackathons h
  left join public.reward_settings s on s.hackathon_id = h.id
  where h.slug = p_slug and (h.published or h.owner_id = (select auth.uid()));
$$;

revoke execute on function public.public_reward_settings(text) from public;
grant execute on function public.public_reward_settings(text) to anon, authenticated;

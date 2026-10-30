-- Winners: a final ranking saved when the last phase closes, and awards
-- ("Most creative", "Best demo") as a kind of reward tier with its own
-- picked winners. A project's rewards are every tier it lands in: rank tiers
-- by its final rank, award tiers by being picked.

-- ── Audit trail ───────────────────────────────────────────────────────────

alter table public.project_events drop constraint project_events_kind_check;
alter table public.project_events add constraint project_events_kind_check check (kind in (
  'submitted', 'edited', 'moved', 'eliminated', 'reinstated', 'disqualified', 'note', 'agent_scored', 'judge_scored',
  'judging_reset', 'ranked', 'awarded', 'award_removed'
));

-- ── Final ranking ─────────────────────────────────────────────────────────

-- 1-based place in the final ranking; null until the last phase closes.
alter table public.projects add column final_rank integer check (final_rank > 0);

-- ── Awards as reward tiers ────────────────────────────────────────────────
-- Tiers are won either by final rank ('ranks') or as an award ('award') with
-- winner_count picked winners. 'categories' and 'custom' tiers become awards.

alter table public.reward_tiers drop constraint reward_tiers_recipients_check;
update public.reward_tiers set recipients = 'award' where recipients in ('categories', 'custom');

alter table public.reward_tiers
  add constraint reward_tiers_recipients_check check (recipients in ('ranks', 'award')),
  -- How many projects win the award.
  add column winner_count integer check (winner_count between 1 and 50),
  -- 'manual': picked by hand. 'criterion': suggested by the top scores on criterion_id.
  add column pick text check (pick in ('manual', 'criterion')),
  add column criterion_id uuid references public.criteria (id) on delete set null,
  -- Projects that already won a rank tier can't also win this award.
  add column exclusive boolean not null default true;

update public.reward_tiers set winner_count = 1, pick = 'manual' where recipients = 'award';

alter table public.reward_tiers add constraint reward_tiers_award_fields check (
  case when recipients = 'award'
    then winner_count is not null and pick is not null
    else winner_count is null and pick is null and criterion_id is null
  end
);

create index reward_tiers_criterion_id_idx on public.reward_tiers (criterion_id);

-- The criterion, when set, must belong to the same hackathon.
drop policy "Owners can create reward tiers" on public.reward_tiers;
drop policy "Owners can update their reward tiers" on public.reward_tiers;
create policy "Owners can create reward tiers" on public.reward_tiers for insert to authenticated
with check (
  public.owns_hackathon(hackathon_id)
  and (criterion_id is null or exists (
    select 1 from public.criteria c where c.id = criterion_id and c.hackathon_id = reward_tiers.hackathon_id
  ))
);
create policy "Owners can update their reward tiers" on public.reward_tiers for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (
  public.owns_hackathon(hackathon_id)
  and (criterion_id is null or exists (
    select 1 from public.criteria c where c.id = criterion_id and c.hackathon_id = reward_tiers.hackathon_id
  ))
);

create or replace function public.save_reward_tiers(p_hackathon_id uuid, p_tiers jsonb)
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
    (id, hackathon_id, position, name, description, recipients, rank_from, rank_to, image_path,
     winner_count, pick, criterion_id, exclusive)
  select
    (t.value ->> 'id')::uuid,
    p_hackathon_id,
    (t.ordinality - 1)::integer,
    t.value ->> 'name',
    coalesce(t.value ->> 'description', ''),
    coalesce(t.value ->> 'recipients', 'ranks'),
    (t.value ->> 'rank_from')::integer,
    (t.value ->> 'rank_to')::integer,
    nullif(t.value ->> 'image_path', ''),
    (t.value ->> 'winner_count')::integer,
    t.value ->> 'pick',
    -- A criterion from elsewhere (or deleted since the editor loaded) is dropped.
    c.id,
    coalesce((t.value ->> 'exclusive')::boolean, true)
  from jsonb_array_elements(p_tiers) with ordinality as t (value, ordinality)
  left join public.criteria c on c.id = (t.value ->> 'criterion_id')::uuid and c.hackathon_id = p_hackathon_id
  on conflict (id) do update set
    position = excluded.position,
    name = excluded.name,
    description = excluded.description,
    recipients = excluded.recipients,
    rank_from = excluded.rank_from,
    rank_to = excluded.rank_to,
    image_path = excluded.image_path,
    winner_count = excluded.winner_count,
    pick = excluded.pick,
    criterion_id = excluded.criterion_id,
    exclusive = excluded.exclusive
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
  on conflict (id) do nothing;
end;
$$;

-- New hackathons get two awards in place of a generic "Category winners"
-- tier, each suggested by the matching default criterion.
create or replace function public.seed_reward_tiers(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_grand uuid := gen_random_uuid();
  v_podium uuid := gen_random_uuid();
  v_finalists uuid := gen_random_uuid();
  v_creative uuid := gen_random_uuid();
  v_demo uuid := gen_random_uuid();
begin
  insert into public.reward_tiers (id, hackathon_id, position, name, recipients, rank_from, rank_to)
  values
    (v_grand, p_hackathon_id, 0, 'Grand prize', 'ranks', 1, 1),
    (v_podium, p_hackathon_id, 1, 'Runners-up', 'ranks', 2, 3),
    (v_finalists, p_hackathon_id, 2, 'Top 10 finalists', 'ranks', 1, 10);

  insert into public.reward_tiers (id, hackathon_id, position, name, description, recipients, winner_count, pick, criterion_id)
  values
    (v_creative, p_hackathon_id, 3, 'Most creative', 'The most original idea and design.', 'award', 1, 'criterion',
      (select id from public.criteria where hackathon_id = p_hackathon_id and title ilike 'originality%' limit 1)),
    (v_demo, p_hackathon_id, 4, 'Best demo', 'The clearest, most convincing demo video.', 'award', 1, 'criterion',
      (select id from public.criteria where hackathon_id = p_hackathon_id and title ilike 'video%' limit 1));

  update public.reward_tiers set pick = 'manual'
  where id in (v_creative, v_demo) and criterion_id is null;

  insert into public.reward_items (tier_id, position, kind, label)
  values
    (v_grand, 0, 'cash', '$5,000 cash'),
    (v_grand, 1, 'credits', '100,000 API credits'),
    (v_podium, 0, 'cash', '$2,000 cash'),
    (v_podium, 1, 'credits', '25,000 API credits'),
    (v_finalists, 0, 'credits', '5,000 API credits'),
    (v_finalists, 1, 'swag', 'Swag pack'),
    (v_creative, 0, 'credits', '10,000 API credits'),
    (v_demo, 0, 'credits', '10,000 API credits');
end;
$$;

-- ── Award winners ─────────────────────────────────────────────────────────

create table public.award_winners (
  tier_id uuid not null references public.reward_tiers (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (tier_id, project_id)
);

create index award_winners_project_id_idx on public.award_winners (project_id);

alter table public.award_winners enable row level security;

create policy "Owners can read their award winners" on public.award_winners for select to authenticated
using (exists (select 1 from public.reward_tiers t where t.id = tier_id and public.owns_hackathon(t.hackathon_id)));
-- The project must belong to the same hackathon as the award.
create policy "Owners can create award winners" on public.award_winners for insert to authenticated
with check (exists (
  select 1 from public.reward_tiers t
  join public.projects p on p.id = project_id and p.hackathon_id = t.hackathon_id
  where t.id = tier_id and t.recipients = 'award' and public.owns_hackathon(t.hackathon_id)
));
create policy "Owners can delete their award winners" on public.award_winners for delete to authenticated
using (exists (select 1 from public.reward_tiers t where t.id = tier_id and public.owns_hackathon(t.hackathon_id)));

grant select, insert, delete on public.award_winners to authenticated;

-- Replace an award's winners with p_project_ids, in order. Logs 'awarded' and
-- 'award_removed' on the projects that changed.
create function public.set_award_winners(p_hackathon_id uuid, p_tier_id uuid, p_project_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tier public.reward_tiers;
begin
  select * into v_tier from public.reward_tiers
  where id = p_tier_id and hackathon_id = p_hackathon_id and recipients = 'award';
  if not found then
    raise exception 'Award not found' using errcode = 'P0002';
  end if;
  if cardinality(p_project_ids) > v_tier.winner_count then
    raise exception '% has % winner slot(s)', v_tier.name, v_tier.winner_count using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(p_project_ids) x (id)
    left join public.projects p on p.id = x.id and p.hackathon_id = p_hackathon_id
    where p.id is null or p.status = 'disqualified'
  ) then
    raise exception 'Only projects in this hackathon that aren''t disqualified can win' using errcode = 'P0001';
  end if;

  insert into public.project_events (project_id, kind, data)
  select w.project_id, 'award_removed', jsonb_build_object('award', v_tier.name)
  from public.award_winners w
  where w.tier_id = p_tier_id and not (w.project_id = any (p_project_ids));

  insert into public.project_events (project_id, kind, data)
  select x.id, 'awarded', jsonb_build_object('award', v_tier.name)
  from unnest(p_project_ids) x (id)
  where not exists (select 1 from public.award_winners w where w.tier_id = p_tier_id and w.project_id = x.id);

  delete from public.award_winners where tier_id = p_tier_id;
  insert into public.award_winners (tier_id, project_id, position)
  select p_tier_id, x.id, (x.ord - 1)::integer
  from unnest(p_project_ids) with ordinality as x (id, ord);
end;
$$;

revoke execute on function public.set_award_winners(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.set_award_winners(uuid, uuid, uuid[]) to authenticated;

-- ── Ranking ───────────────────────────────────────────────────────────────

-- A phase's active projects in ranking order: gate passes first, then average
-- judge score in that phase, then agent score, then submission order.
create function public.rank_phase(p_phase_id uuid)
returns table (project_id uuid, rank integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, (row_number() over (
    order by
      coalesce((select r.gate_passed = false from public.agent_reviews r where r.project_id = p.id), false),
      (select avg(a.score) from public.judge_assignments a where a.phase_id = p_phase_id and a.project_id = p.id) desc nulls last,
      (select r.total from public.agent_reviews r where r.project_id = p.id) desc nulls last,
      p.number
  ))::integer
  from public.projects p
  where p.phase_id = p_phase_id and p.status = 'active';
$$;

revoke execute on function public.rank_phase(uuid) from public, anon;
grant execute on function public.rank_phase(uuid) to authenticated;

-- Close the running phase. With a next phase, the top advance_count move on
-- and the rest are eliminated. Closing the last phase saves the final
-- ranking and moves the hackathon to results.
create or replace function public.close_judging_phase(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phase public.judging_phases;
  v_next public.judging_phases;
  v_advancing uuid[];
  v_rest uuid[];
begin
  select * into v_phase from public.judging_phases
  where hackathon_id = p_hackathon_id and started_at is not null and closed_at is null
  order by position limit 1;
  if not found then
    raise exception 'No phase is running' using errcode = 'P0001';
  end if;

  select * into v_next from public.judging_phases
  where hackathon_id = p_hackathon_id and position > v_phase.position
  order by position limit 1;

  if not found then
    update public.projects p set final_rank = r.rank
    from public.rank_phase(v_phase.id) r
    where p.id = r.project_id;

    insert into public.project_events (project_id, kind, data)
    select r.project_id, 'ranked', jsonb_build_object('rank', r.rank)
    from public.rank_phase(v_phase.id) r;

    update public.judging_phases set closed_at = now() where id = v_phase.id;
    update public.hackathons set stage = 'results' where id = p_hackathon_id;
    return;
  end if;

  select
    coalesce(array_agg(project_id order by rank) filter (where rank <= coalesce(v_phase.advance_count, 0)), '{}'),
    coalesce(array_agg(project_id order by rank) filter (where rank > coalesce(v_phase.advance_count, 0)), '{}')
  into v_advancing, v_rest
  from public.rank_phase(v_phase.id);

  update public.judging_phases set closed_at = now() where id = v_phase.id;
  perform public.set_project_status(
    p_hackathon_id, v_rest, 'eliminated',
    format('Not in the top %s of %s', v_phase.advance_count, v_phase.name)
  );
  perform public.move_projects(p_hackathon_id, v_advancing, v_next.id);
  perform public.start_judging_phase(p_hackathon_id, v_next.id);
end;
$$;

-- Reorder the final ranking by hand: p_project_ids get ranks 1…n in order and
-- anyone left out loses their rank. Logs 'ranked' where a rank changed.
create function public.set_final_ranking(p_hackathon_id uuid, p_project_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(p_project_ids) x (id)
    left join public.projects p on p.id = x.id and p.hackathon_id = p_hackathon_id
    where p.id is null
  ) then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  with wanted as (
    select p.id, x.ord::integer as rank, p.final_rank as was
    from public.projects p
    left join unnest(p_project_ids) with ordinality as x (id, ord) on x.id = p.id
    where p.hackathon_id = p_hackathon_id
      and (x.id is not null or p.final_rank is not null)
  ), changed as (
    update public.projects p set final_rank = w.rank
    from wanted w
    where p.id = w.id and p.final_rank is distinct from w.rank
    returning p.id, w.rank, w.was
  )
  insert into public.project_events (project_id, kind, data)
  select c.id, 'ranked', jsonb_strip_nulls(jsonb_build_object('rank', c.rank, 'from', c.was))
  from changed c;
end;
$$;

revoke execute on function public.set_final_ranking(uuid, uuid[]) from public, anon;
grant execute on function public.set_final_ranking(uuid, uuid[]) to authenticated;

-- Resetting judging also clears the final ranking and award winners.
create or replace function public.reset_judging(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  delete from public.judge_assignments a
  using public.judging_phases ph
  where ph.id = a.phase_id and ph.hackathon_id = p_hackathon_id;

  delete from public.agent_reviews r
  using public.projects p
  where p.id = r.project_id and p.hackathon_id = p_hackathon_id;

  delete from public.award_winners w
  using public.reward_tiers t
  where t.id = w.tier_id and t.hackathon_id = p_hackathon_id;

  update public.judging_phases set started_at = null, closed_at = null where hackathon_id = p_hackathon_id;

  insert into public.project_events (project_id, kind)
  select id, 'judging_reset' from public.projects
  where hackathon_id = p_hackathon_id and (phase_id is not null or status = 'eliminated' or final_rank is not null);

  -- Disqualifications were an admin's call, so they stand.
  update public.projects set
    phase_id = null,
    final_rank = null,
    status = case when status = 'eliminated' then 'active' else status end
  where hackathon_id = p_hackathon_id;

  update public.hackathons set judging_started_at = null, stage = 'setup', published = false where id = p_hackathon_id;
end;
$$;

-- Judging progress: starting judging, who reviews what in each phase, the
-- agent's review of each project, and closing a phase to advance the top
-- projects. Scores here are placeholders until scoring is built; the
-- simulate_judging demo fills them in.

-- ── Lifecycle columns ─────────────────────────────────────────────────────

-- Set when judging starts; null means still in setup.
alter table public.hackathons add column judging_started_at timestamptz;

alter table public.judging_phases
  add column started_at timestamptz,
  add column closed_at timestamptz,
  add constraint judging_phases_closed_after_started check (closed_at is null or started_at is not null);

-- The audit trail can now record a reset of judging.
alter table public.project_events drop constraint project_events_kind_check;
alter table public.project_events add constraint project_events_kind_check check (kind in (
  'submitted', 'edited', 'moved', 'eliminated', 'reinstated', 'disqualified', 'note', 'agent_scored', 'judge_scored',
  'judging_reset'
));

-- ── Assignments ───────────────────────────────────────────────────────────
-- One judge reviewing one project in one phase.

create table public.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.judging_phases (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  judge_id uuid not null references public.judges (id) on delete cascade,
  -- Weighted total out of 10 once submitted. Placeholder until scoring lands.
  score numeric(4, 2) check (score between 0 and 10),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (phase_id, project_id, judge_id),
  check ((score is null) = (submitted_at is null))
);

create index judge_assignments_project_id_idx on public.judge_assignments (project_id);
create index judge_assignments_judge_id_idx on public.judge_assignments (judge_id);

-- ── Agent reviews ─────────────────────────────────────────────────────────
-- The agent's current review of a project; one per project.

create table public.agent_reviews (
  project_id uuid primary key references public.projects (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  -- Weighted total out of 10, and whether every gate passed. Set when done.
  total numeric(4, 2) check (total between 0 and 10),
  gate_passed boolean,
  queued_at timestamptz not null default now(),
  finished_at timestamptz,
  check (status = 'done' or (total is null and gate_passed is null))
);

create index agent_reviews_status_idx on public.agent_reviews (status);

-- ── Row level security ────────────────────────────────────────────────────

alter table public.judge_assignments enable row level security;
alter table public.agent_reviews enable row level security;

create policy "Owners can read their assignments" on public.judge_assignments for select to authenticated
using (exists (select 1 from public.judging_phases ph where ph.id = phase_id and public.owns_hackathon(ph.hackathon_id)));
-- Phase, project and judge must all belong to the same hackathon.
create policy "Owners can create assignments" on public.judge_assignments for insert to authenticated
with check (exists (
  select 1 from public.judging_phases ph
  join public.projects p on p.id = project_id and p.hackathon_id = ph.hackathon_id
  join public.judges j on j.id = judge_id and j.hackathon_id = ph.hackathon_id
  where ph.id = phase_id and public.owns_hackathon(ph.hackathon_id)
));
create policy "Owners can update their assignments" on public.judge_assignments for update to authenticated
using (exists (select 1 from public.judging_phases ph where ph.id = phase_id and public.owns_hackathon(ph.hackathon_id)))
with check (exists (select 1 from public.judging_phases ph where ph.id = phase_id and public.owns_hackathon(ph.hackathon_id)));
create policy "Owners can delete their assignments" on public.judge_assignments for delete to authenticated
using (exists (select 1 from public.judging_phases ph where ph.id = phase_id and public.owns_hackathon(ph.hackathon_id)));

create policy "Owners can read their agent reviews" on public.agent_reviews for select to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));
create policy "Owners can create agent reviews" on public.agent_reviews for insert to authenticated
with check (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));
create policy "Owners can update their agent reviews" on public.agent_reviews for update to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));
create policy "Owners can delete their agent reviews" on public.agent_reviews for delete to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));

grant select, insert, update, delete on public.judge_assignments to authenticated;
grant select, insert, update, delete on public.agent_reviews to authenticated;

-- ── Phases can't lose a phase that has already run ────────────────────────

create or replace function public.save_judging_phases(p_hackathon_id uuid, p_phases jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.judging_phases
    where hackathon_id = p_hackathon_id
      and started_at is not null
      and id not in (select (p ->> 'id')::uuid from jsonb_array_elements(p_phases) p)
  ) then
    raise exception 'A phase that has started can''t be removed. Reset judging first.' using errcode = 'P0001';
  end if;

  delete from public.judging_phases
  where hackathon_id = p_hackathon_id
    and id not in (select (p ->> 'id')::uuid from jsonb_array_elements(p_phases) p);

  insert into public.judging_phases as t
    (id, hackathon_id, position, name, judge_group_id, reviews_per_project, advance_count)
  select
    (p.value ->> 'id')::uuid,
    p_hackathon_id,
    (p.ordinality - 1)::integer,
    p.value ->> 'name',
    g.id,
    (p.value ->> 'reviews_per_project')::integer,
    (p.value ->> 'advance_count')::integer
  from jsonb_array_elements(p_phases) with ordinality as p (value, ordinality)
  left join public.judge_groups g
    on g.id = (p.value ->> 'judge_group_id')::uuid and g.hackathon_id = p_hackathon_id
  on conflict (id) do update set
    position = excluded.position,
    name = excluded.name,
    judge_group_id = excluded.judge_group_id,
    reviews_per_project = excluded.reviews_per_project,
    advance_count = excluded.advance_count
  where t.hackathon_id = excluded.hackathon_id;
end;
$$;

-- ── Starting a phase ──────────────────────────────────────────────────────

-- Mark a phase started and hand its active projects out to its judge pool,
-- following the hackathon's distribution strategy. Even: consecutive slots
-- wrap around the pool, so loads differ by at most one. Mixed: the same, but
-- each lap round the pool shifts by one, so pairings rotate. Returns the
-- number of assignments made.
create function public.start_judging_phase(p_hackathon_id uuid, p_phase_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phase public.judging_phases;
  v_mixed boolean;
  v_pool integer;
  v_per integer;
  v_made integer;
begin
  select * into v_phase from public.judging_phases where id = p_phase_id and hackathon_id = p_hackathon_id;
  if not found then
    raise exception 'Phase not found' using errcode = 'P0002';
  end if;

  update public.judging_phases set started_at = now(), closed_at = null where id = p_phase_id;

  select coalesce((select strategy = 'mixed' from public.distribution_settings where hackathon_id = p_hackathon_id), false)
  into v_mixed;

  select count(*) into v_pool
  from public.judges j
  where j.hackathon_id = p_hackathon_id
    and (v_phase.judge_group_id is null or exists (
      select 1 from public.judge_group_members m where m.group_id = v_phase.judge_group_id and m.judge_id = j.id
    ));
  if v_pool = 0 then
    return 0;
  end if;
  v_per := least(coalesce(v_phase.reviews_per_project, v_pool), v_pool);

  with pool as (
    select j.id, (row_number() over (order by j.name, j.id) - 1)::integer as idx
    from public.judges j
    where j.hackathon_id = p_hackathon_id
      and (v_phase.judge_group_id is null or exists (
        select 1 from public.judge_group_members m where m.group_id = v_phase.judge_group_id and m.judge_id = j.id
      ))
  ), items as (
    select p.id, (row_number() over (order by p.number) - 1)::integer as idx
    from public.projects p
    where p.phase_id = p_phase_id and p.status = 'active'
  ), inserted as (
    insert into public.judge_assignments (phase_id, project_id, judge_id)
    select p_phase_id, i.id, pool.id
    from items i
    cross join generate_series(0, v_per - 1) k
    join pool on pool.idx = (i.idx * v_per + k + case when v_mixed then (i.idx * v_per) / v_pool else 0 end) % v_pool
    on conflict (phase_id, project_id, judge_id) do nothing
    returning 1
  )
  select count(*) into v_made from inserted;
  return v_made;
end;
$$;

revoke execute on function public.start_judging_phase(uuid, uuid) from public, anon;
grant execute on function public.start_judging_phase(uuid, uuid) to authenticated;

-- Start judging: every active project not yet in a phase moves into the first
-- phase, the agent's reviews are queued (when the agent goes first), and the
-- first phase's assignments go out.
create function public.start_judging(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_first uuid;
  v_agent_first boolean;
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id and judging_started_at is null) then
    raise exception 'Judging has already started' using errcode = 'P0001';
  end if;
  select id into v_first from public.judging_phases where hackathon_id = p_hackathon_id order by position limit 1;
  if v_first is null then
    raise exception 'Add a judging phase first' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.projects where hackathon_id = p_hackathon_id and status = 'active') then
    raise exception 'Add projects before starting judging' using errcode = 'P0001';
  end if;

  update public.hackathons set judging_started_at = now(), stage = 'judging' where id = p_hackathon_id;

  perform public.move_projects(
    p_hackathon_id,
    array(select id from public.projects where hackathon_id = p_hackathon_id and status = 'active' and phase_id is null),
    v_first
  );

  select coalesce((select agent_first from public.distribution_settings where hackathon_id = p_hackathon_id), true)
  into v_agent_first;
  if v_agent_first then
    insert into public.agent_reviews (project_id)
    select id from public.projects where hackathon_id = p_hackathon_id and phase_id = v_first and status = 'active'
    on conflict (project_id) do nothing;
  end if;

  perform public.start_judging_phase(p_hackathon_id, v_first);
end;
$$;

revoke execute on function public.start_judging(uuid) from public, anon;
grant execute on function public.start_judging(uuid) to authenticated;

-- ── Closing a phase ───────────────────────────────────────────────────────

-- Close the phase that's running. Its active projects are ranked by average
-- judge score, then agent score, then submission order. With a next phase, the
-- top advance_count move on and the rest are eliminated, and the next phase
-- starts. Closing the last phase ends judging and moves to results.
create function public.close_judging_phase(p_hackathon_id uuid)
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

  update public.judging_phases set closed_at = now() where id = v_phase.id;

  select * into v_next from public.judging_phases
  where hackathon_id = p_hackathon_id and position > v_phase.position
  order by position limit 1;

  if not found then
    update public.hackathons set stage = 'results' where id = p_hackathon_id;
    return;
  end if;

  with ranked as (
    select p.id, row_number() over (
      order by
        (select avg(a.score) from public.judge_assignments a where a.phase_id = v_phase.id and a.project_id = p.id) desc nulls last,
        (select r.total from public.agent_reviews r where r.project_id = p.id) desc nulls last,
        p.number
    ) as rank
    from public.projects p
    where p.phase_id = v_phase.id and p.status = 'active'
  )
  select
    coalesce(array_agg(id order by rank) filter (where rank <= coalesce(v_phase.advance_count, 0)), '{}'),
    coalesce(array_agg(id order by rank) filter (where rank > coalesce(v_phase.advance_count, 0)), '{}')
  into v_advancing, v_rest
  from ranked;

  perform public.set_project_status(
    p_hackathon_id, v_rest, 'eliminated',
    format('Not in the top %s of %s', v_phase.advance_count, v_phase.name)
  );
  perform public.move_projects(p_hackathon_id, v_advancing, v_next.id);
  perform public.start_judging_phase(p_hackathon_id, v_next.id);
end;
$$;

revoke execute on function public.close_judging_phase(uuid) from public, anon;
grant execute on function public.close_judging_phase(uuid) to authenticated;

-- ── Reset ─────────────────────────────────────────────────────────────────

-- Put judging back to before it started: assignments and agent reviews are
-- deleted, phases unstarted, projects back to active with no phase. Each
-- project's trail records the reset.
create function public.reset_judging(p_hackathon_id uuid)
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

  update public.judging_phases set started_at = null, closed_at = null where hackathon_id = p_hackathon_id;

  insert into public.project_events (project_id, kind)
  select id, 'judging_reset' from public.projects
  where hackathon_id = p_hackathon_id and (phase_id is not null or status = 'eliminated');

  -- Disqualifications were an admin's call, so they stand.
  update public.projects set phase_id = null, status = case when status = 'eliminated' then 'active' else status end
  where hackathon_id = p_hackathon_id;

  update public.hackathons set judging_started_at = null, stage = 'setup' where id = p_hackathon_id;
end;
$$;

revoke execute on function public.reset_judging(uuid) from public, anon;
grant execute on function public.reset_judging(uuid) to authenticated;

-- ── Demo ──────────────────────────────────────────────────────────────────

-- Stand-in for real agents and judges until scoring is built: finishes some
-- queued agent reviews and submits some of the running phase's assignments,
-- with made-up scores, and logs them to each project's trail.
create function public.simulate_judging(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  with picked as (
    select r.project_id, random() as roll
    from public.agent_reviews r
    join public.projects p on p.id = r.project_id
    where p.hackathon_id = p_hackathon_id and r.status in ('queued', 'running')
  ), done as (
    update public.agent_reviews r set
      status = case when k.roll < 0.6 then 'done' else 'running' end,
      total = case when k.roll < 0.6 then round((3 + random() * 6)::numeric, 1) end,
      gate_passed = case when k.roll < 0.6 then random() > 0.12 end,
      finished_at = case when k.roll < 0.6 then now() end
    from picked k
    where r.project_id = k.project_id
    returning r.project_id, r.status, r.total, r.gate_passed
  )
  insert into public.project_events (project_id, kind, actor_kind, actor_name, data)
  select d.project_id, 'agent_scored', 'agent', 'Agent', jsonb_build_object('total', d.total, 'gate_passed', d.gate_passed)
  from done d
  where d.status = 'done';

  with picked as (
    select a.id
    from public.judge_assignments a
    join public.judging_phases ph on ph.id = a.phase_id
    where ph.hackathon_id = p_hackathon_id
      and ph.started_at is not null and ph.closed_at is null
      and a.submitted_at is null
      and random() < 0.35
  ), submitted as (
    update public.judge_assignments a set
      score = least(10, greatest(1, round((
        coalesce((select r.total from public.agent_reviews r where r.project_id = a.project_id and r.status = 'done'), 6)
        + (random() - 0.5) * 3
      )::numeric, 1))),
      submitted_at = now()
    from picked k
    where a.id = k.id
    returning a.project_id, a.judge_id, a.score
  )
  insert into public.project_events (project_id, kind, actor_kind, actor_name, data)
  select s.project_id, 'judge_scored', 'judge', j.name, jsonb_build_object('total', s.score)
  from submitted s
  join public.judges j on j.id = s.judge_id;
end;
$$;

revoke execute on function public.simulate_judging(uuid) from public, anon;
grant execute on function public.simulate_judging(uuid) to authenticated;

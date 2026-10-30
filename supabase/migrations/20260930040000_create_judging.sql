-- Judging: the tiered phases projects move through, how work is split between
-- judges, and the projects themselves with their submitted values and an
-- append-only audit trail. Phases and distribution are edited from Setup;
-- projects from Judging › Projects.

-- ── Phases ────────────────────────────────────────────────────────────────

create table public.judging_phases (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  -- 0-based order; each phase narrows the pool for the next.
  position integer not null check (position >= 0),
  name text not null check (char_length(name) between 1 and 60),
  -- Who reviews in this phase: one judge group, or null for every judge.
  judge_group_id uuid references public.judge_groups (id) on delete set null,
  -- Judges per project; null means every judge in the pool reviews every project.
  reviews_per_project integer check (reviews_per_project between 1 and 20),
  -- How many projects go on to the next phase; null on the last phase (it picks winners).
  advance_count integer check (advance_count between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index judging_phases_hackathon_id_position_idx on public.judging_phases (hackathon_id, position);
create index judging_phases_judge_group_id_idx on public.judging_phases (judge_group_id);

create trigger judging_phases_set_updated_at
before update on public.judging_phases
for each row execute function public.set_updated_at();

alter table public.judging_phases enable row level security;

create policy "Owners can read their phases" on public.judging_phases for select to authenticated
using (public.owns_hackathon(hackathon_id));
-- The judge group, when set, must belong to the same hackathon.
create policy "Owners can create phases" on public.judging_phases for insert to authenticated
with check (
  public.owns_hackathon(hackathon_id)
  and (judge_group_id is null or exists (
    select 1 from public.judge_groups g where g.id = judge_group_id and g.hackathon_id = judging_phases.hackathon_id
  ))
);
create policy "Owners can update their phases" on public.judging_phases for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (
  public.owns_hackathon(hackathon_id)
  and (judge_group_id is null or exists (
    select 1 from public.judge_groups g where g.id = judge_group_id and g.hackathon_id = judging_phases.hackathon_id
  ))
);
create policy "Owners can delete their phases" on public.judging_phases for delete to authenticated
using (public.owns_hackathon(hackathon_id));

grant select, insert, update, delete on public.judging_phases to authenticated;

-- Replace a hackathon's phases in one transaction: phases missing from
-- p_phases are deleted (their projects drop back to "no phase"), the rest are
-- upserted in array order. A judge group from elsewhere is dropped to "all judges".
create function public.save_judging_phases(p_hackathon_id uuid, p_phases jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
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
  -- An id from another hackathon is left alone rather than moved.
  where t.hackathon_id = excluded.hackathon_id;
end;
$$;

revoke execute on function public.save_judging_phases(uuid, jsonb) from public, anon;
grant execute on function public.save_judging_phases(uuid, jsonb) to authenticated;

-- Every hackathon starts with a two-tier setup: a group review that narrows
-- the field, then a final panel that picks winners.
create function public.seed_judging_phases(p_hackathon_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.judging_phases (hackathon_id, position, name, reviews_per_project, advance_count)
  values
    (p_hackathon_id, 0, 'Group review', 2, 10),
    (p_hackathon_id, 1, 'Final panel', null, null);
$$;

revoke execute on function public.seed_judging_phases(uuid) from public, anon;
grant execute on function public.seed_judging_phases(uuid) to authenticated;

create function public.seed_hackathon_judging_phases()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.seed_judging_phases(new.id);
  return new;
end;
$$;

create trigger hackathons_seed_3_judging_phases
after insert on public.hackathons
for each row execute function public.seed_hackathon_judging_phases();

-- Backfill hackathons created before this table existed.
select public.seed_judging_phases(id) from public.hackathons;

-- ── Distribution ──────────────────────────────────────────────────────────
-- One row per hackathon; no row means the defaults below.

create table public.distribution_settings (
  hackathon_id uuid primary key references public.hackathons (id) on delete cascade,
  -- The agent scores every project before judges see any.
  agent_first boolean not null default true,
  -- Projects that fail a gate go to this one judge instead of the pool.
  inbox_judge_id uuid references public.judges (id) on delete set null,
  -- 'even': same count per judge. 'mixed': also vary who shares projects.
  strategy text not null default 'even' check (strategy in ('even', 'mixed')),
  -- 'once': the whole queue up front. 'daily': a batch each day over batch_days.
  cadence text not null default 'once' check (cadence in ('once', 'daily')),
  batch_days integer not null default 5 check (batch_days between 1 and 30),
  -- Judges see the agent's score after submitting their own.
  show_agent_score boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index distribution_settings_inbox_judge_id_idx on public.distribution_settings (inbox_judge_id);

create trigger distribution_settings_set_updated_at
before update on public.distribution_settings
for each row execute function public.set_updated_at();

alter table public.distribution_settings enable row level security;

create policy "Owners can read their distribution" on public.distribution_settings for select to authenticated
using (public.owns_hackathon(hackathon_id));
-- The inbox judge, when set, must belong to the same hackathon.
create policy "Owners can create their distribution" on public.distribution_settings for insert to authenticated
with check (
  public.owns_hackathon(hackathon_id)
  and (inbox_judge_id is null or exists (
    select 1 from public.judges j where j.id = inbox_judge_id and j.hackathon_id = distribution_settings.hackathon_id
  ))
);
create policy "Owners can update their distribution" on public.distribution_settings for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (
  public.owns_hackathon(hackathon_id)
  and (inbox_judge_id is null or exists (
    select 1 from public.judges j where j.id = inbox_judge_id and j.hackathon_id = distribution_settings.hackathon_id
  ))
);

grant select, insert, update on public.distribution_settings to authenticated;

-- ── Projects ──────────────────────────────────────────────────────────────

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  -- Shown as #047; assigned in order within the hackathon.
  number integer not null check (number > 0),
  -- The phase it's in now; null until judging moves it into one.
  phase_id uuid references public.judging_phases (id) on delete set null,
  -- 'eliminated' didn't advance; 'disqualified' was ruled out by an admin.
  status text not null default 'active' check (status in ('active', 'eliminated', 'disqualified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hackathon_id, number)
);

create index projects_phase_id_idx on public.projects (phase_id);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- A project's answer to one schema block. Strings for text and link blocks, a
-- number for number blocks, an array of strings for images, files and team.
create table public.project_values (
  project_id uuid not null references public.projects (id) on delete cascade,
  block_id uuid not null references public.schema_blocks (id) on delete cascade,
  value jsonb not null check (
    jsonb_typeof(value) in ('string', 'number', 'array') and octet_length(value::text) <= 20000
  ),
  primary key (project_id, block_id)
);

create index project_values_block_id_idx on public.project_values (block_id);

-- The audit trail. Append-only: there are no update or delete grants, and
-- rows go when their project does.
create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in (
    'submitted', 'edited', 'moved', 'eliminated', 'reinstated', 'disqualified', 'note', 'agent_scored', 'judge_scored'
  )),
  actor_kind text not null default 'admin' check (actor_kind in ('admin', 'agent', 'judge', 'system')),
  actor_id uuid default auth.uid(),
  -- Snapshot of who did it, so renames later don't rewrite history.
  actor_name text not null default left(coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
    auth.jwt() ->> 'email',
    ''
  ), 120) check (char_length(actor_name) <= 120),
  -- Kind-specific details, e.g. {"from": "Group review", "to": "Final panel"}.
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 20000),
  created_at timestamptz not null default now()
);

-- Covers the FK and the "newest first" read.
create index project_events_project_id_created_at_idx on public.project_events (project_id, created_at desc);

alter table public.projects enable row level security;
alter table public.project_values enable row level security;
alter table public.project_events enable row level security;

create policy "Owners can read their projects" on public.projects for select to authenticated
using (public.owns_hackathon(hackathon_id));
-- The phase, when set, must belong to the same hackathon.
create policy "Owners can create projects" on public.projects for insert to authenticated
with check (
  public.owns_hackathon(hackathon_id)
  and (phase_id is null or exists (
    select 1 from public.judging_phases p where p.id = phase_id and p.hackathon_id = projects.hackathon_id
  ))
);
create policy "Owners can update their projects" on public.projects for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (
  public.owns_hackathon(hackathon_id)
  and (phase_id is null or exists (
    select 1 from public.judging_phases p where p.id = phase_id and p.hackathon_id = projects.hackathon_id
  ))
);
create policy "Owners can delete their projects" on public.projects for delete to authenticated
using (public.owns_hackathon(hackathon_id));

-- Values follow their project; the block must belong to the same hackathon.
create policy "Owners can read their project values" on public.project_values for select to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));
create policy "Owners can create project values" on public.project_values for insert to authenticated
with check (exists (
  select 1 from public.projects p
  join public.schema_blocks b on b.id = block_id and b.hackathon_id = p.hackathon_id
  where p.id = project_id and public.owns_hackathon(p.hackathon_id)
));
create policy "Owners can delete project values" on public.project_values for delete to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));

create policy "Owners can read their project events" on public.project_events for select to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));
create policy "Owners can add project events" on public.project_events for insert to authenticated
with check (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.project_values to authenticated;
grant select, insert on public.project_events to authenticated;

-- ── Project writes, one transaction each, logged to the audit trail ───────
-- All run as the caller, so the policies above decide what they can touch.

-- Create or update one project and replace its values ("values": an object of
-- block id → value; blocks from elsewhere are skipped). Logs 'submitted' on
-- create and 'edited' with the changed block titles on update. Returns the
-- project's number.
create function public.save_project(p_hackathon_id uuid, p_project jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_project ->> 'id')::uuid;
  v_values jsonb := coalesce(p_project -> 'values', '{}');
  v_number integer;
  v_changed text[];
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  select number into v_number from public.projects where id = v_id and hackathon_id = p_hackathon_id;

  if v_number is null then
    if exists (select 1 from public.projects where id = v_id) then
      raise exception 'Project not found' using errcode = 'P0002';
    end if;
    select coalesce(max(number), 0) + 1 into v_number from public.projects where hackathon_id = p_hackathon_id;
    insert into public.projects (id, hackathon_id, number) values (v_id, p_hackathon_id, v_number);
    insert into public.project_events (project_id, kind) values (v_id, 'submitted');
  else
    select coalesce(array_agg(b.title order by b.position), '{}') into v_changed
    from public.schema_blocks b
    left join public.project_values o on o.project_id = v_id and o.block_id = b.id
    where b.hackathon_id = p_hackathon_id
      and o.value is distinct from v_values -> b.id::text;

    if cardinality(v_changed) = 0 then
      return v_number;
    end if;
    insert into public.project_events (project_id, kind, data)
    values (v_id, 'edited', jsonb_build_object('fields', to_jsonb(v_changed)));
    update public.projects set updated_at = now() where id = v_id;
  end if;

  delete from public.project_values where project_id = v_id;
  insert into public.project_values (project_id, block_id, value)
  select v_id, b.id, v.value
  from jsonb_each(v_values) v (block_id, value)
  join public.schema_blocks b on b.id::text = v.block_id and b.hackathon_id = p_hackathon_id;

  return v_number;
end;
$$;

revoke execute on function public.save_project(uuid, jsonb) from public, anon;
grant execute on function public.save_project(uuid, jsonb) to authenticated;

-- Move projects into a phase (null takes them out of judging). Logs 'moved'
-- with the phase names at the time, for each project that actually moved.
create function public.move_projects(p_hackathon_id uuid, p_project_ids uuid[], p_phase_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_phase_id is not null
    and not exists (select 1 from public.judging_phases where id = p_phase_id and hackathon_id = p_hackathon_id) then
    raise exception 'Phase not found' using errcode = 'P0002';
  end if;

  with moved as (
    select p.id, p.phase_id as from_id
    from public.projects p
    where p.hackathon_id = p_hackathon_id
      and p.id = any (p_project_ids)
      and p.phase_id is distinct from p_phase_id
    for update
  ), updated as (
    update public.projects p set phase_id = p_phase_id
    from moved m
    where p.id = m.id
    returning p.id, m.from_id
  )
  insert into public.project_events (project_id, kind, data)
  select u.id, 'moved', jsonb_build_object(
    'from', f.name, 'to', t.name,
    -- Lets the trail say "advanced" vs "moved back".
    'forward', coalesce(t.position, -1) > coalesce(f.position, -1)
  )
  from updated u
  left join public.judging_phases f on f.id = u.from_id
  left join public.judging_phases t on t.id = p_phase_id;
end;
$$;

revoke execute on function public.move_projects(uuid, uuid[], uuid) from public, anon;
grant execute on function public.move_projects(uuid, uuid[], uuid) to authenticated;

-- Set projects' status, with an optional reason. Logs 'eliminated',
-- 'disqualified' or (back to active) 'reinstated' for each one that changed.
create function public.set_project_status(p_hackathon_id uuid, p_project_ids uuid[], p_status text, p_note text default '')
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  with updated as (
    update public.projects p set status = p_status
    where p.hackathon_id = p_hackathon_id
      and p.id = any (p_project_ids)
      and p.status is distinct from p_status
    returning p.id
  )
  insert into public.project_events (project_id, kind, data)
  select
    u.id,
    case p_status when 'active' then 'reinstated' else p_status end,
    case when coalesce(p_note, '') = '' then '{}'::jsonb else jsonb_build_object('note', p_note) end
  from updated u;
end;
$$;

revoke execute on function public.set_project_status(uuid, uuid[], text, text) from public, anon;
grant execute on function public.set_project_status(uuid, uuid[], text, text) to authenticated;

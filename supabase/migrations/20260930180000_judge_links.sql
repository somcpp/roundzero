-- Judge links: every judge gets a private page at /j/<access_token> where they
-- work through their queue for the running phase and score it themselves.
-- Also an admin's own review of a project (one more score for the phase, on
-- top of the assigned judges'), and the start screen judges see, edited from
-- Setup › Judge portal.
--
-- Judges don't have accounts: the token in their link is the credential. It's
-- long and random, and the judge_* functions below only ever read or score the
-- token holder's own queue. So unlike intake they're callable with the public
-- key (the /j pages run as whoever opens them, usually anon) and the server
-- needs no secret key. Regenerating a judge's token retires their old link.

-- ── Links ─────────────────────────────────────────────────────────────────

alter table public.judges
  -- The secret in the judge's link. Owners read it to share the link and
  -- replace it to retire the old one.
  add column access_token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (access_token ~ '^[A-Za-z0-9_-]{24,64}$');

-- ── Assignments: admin reviews and daily batches ──────────────────────────

alter table public.judge_assignments
  alter column judge_id drop not null,
  -- An admin's own review: one more score for the phase, alongside the judges'.
  -- judge_id is null on these rows and admin_id is who entered it.
  add column admin_id uuid references auth.users (id) on delete cascade,
  -- Snapshot of the admin's name, like project_events.actor_name.
  add column admin_name text not null default '' check (char_length(admin_name) <= 120),
  -- Daily batches: when the judge pulled this one in ahead of its day. Null
  -- means it opens on schedule.
  add column released_at timestamptz,
  -- When the judge changed their score after the agent's was shown to them.
  -- They get one change.
  add column adjusted_at timestamptz,
  add constraint judge_assignments_judge_or_admin check ((judge_id is null) <> (admin_id is null));

-- One review per admin per project per phase.
create unique index judge_assignments_admin_review_key on public.judge_assignments (phase_id, project_id, admin_id)
where admin_id is not null;
create index judge_assignments_admin_id_idx on public.judge_assignments (admin_id);

-- Admins can add their own review. Columns of the new row are qualified by
-- table name, so none of them resolve to projects.phase_id by mistake.
drop policy "Owners can create assignments" on public.judge_assignments;
create policy "Owners can create assignments" on public.judge_assignments for insert to authenticated
with check (exists (
  select 1 from public.judging_phases ph
  join public.projects p on p.id = judge_assignments.project_id and p.hackathon_id = ph.hackathon_id
  where ph.id = judge_assignments.phase_id
    and public.owns_hackathon(ph.hackathon_id)
    and (
      exists (
        select 1 from public.judges j
        where j.id = judge_assignments.judge_id and j.hackathon_id = ph.hackathon_id
      )
      or (judge_assignments.judge_id is null and judge_assignments.admin_id = (select auth.uid()))
    )
));

-- ── Start screen ──────────────────────────────────────────────────────────
-- One row per hackathon; no row means the defaults.

create table public.judge_portal_settings (
  hackathon_id uuid primary key references public.hackathons (id) on delete cascade,
  -- The start screen's headline; '' greets the judge by name.
  welcome_title text not null default '' check (char_length(welcome_title) <= 120),
  -- A note from the organizers, under the headline.
  welcome_message text not null default '' check (char_length(welcome_message) <= 2000),
  -- "Remember the goal": a few short points judges read before they start.
  goals text[] not null default '{}' check (
    cardinality(goals) <= 8 and char_length(array_to_string(goals, '')) <= 1600
  ),
  -- Shown once a judge has scored everything they have.
  done_message text not null default '' check (char_length(done_message) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger judge_portal_settings_set_updated_at
before update on public.judge_portal_settings
for each row execute function public.set_updated_at();

alter table public.judge_portal_settings enable row level security;

create policy "Owners can read their judge portal settings" on public.judge_portal_settings for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create their judge portal settings" on public.judge_portal_settings for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their judge portal settings" on public.judge_portal_settings for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));

grant select, insert, update on public.judge_portal_settings to authenticated;

-- ── Scoring, shared by every way in ───────────────────────────────────────

-- Store one review's scores and total. p_scores maps criterion id → 1–10 for
-- score criteria, or true/false for pass/fail ones; every criterion must be
-- scored. The total is the weight-averaged score, a pass counting 10 and a
-- fail 0. Callers check who may score it and that its phase is running.
-- Returns {total, gate_passed, scores} with the scores as stored.
create function public.save_review_scores(p_assignment_id uuid, p_hackathon_id uuid, p_scores jsonb, p_notes text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_missing text;
  v_bad text;
  v_total numeric(4, 2);
  v_gate_passed boolean;
begin
  if not exists (select 1 from public.criteria where hackathon_id = p_hackathon_id) then
    raise exception 'There are no criteria to score yet' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_scores) is distinct from 'object' then
    raise exception 'Scores must map each criterion to its score' using errcode = '22023';
  end if;

  select string_agg(c.title, ', ' order by c.position) into v_missing
  from public.criteria c
  where c.hackathon_id = p_hackathon_id and not (p_scores ? c.id::text);
  if v_missing is not null then
    raise exception 'Score every criterion first (missing: %)', v_missing using errcode = 'P0001';
  end if;

  select string_agg(c.title, ', ' order by c.position) into v_bad
  from public.criteria c
  where c.hackathon_id = p_hackathon_id
    and case c.scale
      -- Nested so the cast only runs on numbers.
      when 'score' then case
        when jsonb_typeof(p_scores -> c.id::text) = 'number'
          then (p_scores ->> c.id::text)::numeric not in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
        else true
      end
      else jsonb_typeof(p_scores -> c.id::text) <> 'boolean'
    end;
  if v_bad is not null then
    raise exception 'Invalid score for %', v_bad using errcode = '22023';
  end if;

  delete from public.judge_scores where assignment_id = p_assignment_id;
  insert into public.judge_scores (assignment_id, criterion_id, score, passed)
  select
    p_assignment_id,
    c.id,
    case when c.scale = 'score' then (p_scores ->> c.id::text)::numeric::integer end,
    case when c.scale = 'pass_fail' then (p_scores ->> c.id::text)::boolean end
  from public.criteria c
  where c.hackathon_id = p_hackathon_id;

  select
    round(coalesce(
      sum(v.value * c.weight) / nullif(sum(c.weight), 0),
      avg(v.value),
      0
    ), 2),
    coalesce(bool_and(s.passed) filter (where c.gate), true)
  into v_total, v_gate_passed
  from public.judge_scores s
  join public.criteria c on c.id = s.criterion_id
  cross join lateral (select coalesce(s.score::numeric, case when s.passed then 10 else 0 end) as value) v
  where s.assignment_id = p_assignment_id;

  update public.judge_assignments set
    score = v_total,
    submitted_at = now(),
    notes = left(trim(coalesce(p_notes, '')), 4000)
  where id = p_assignment_id;

  return jsonb_build_object(
    'total', v_total,
    'gate_passed', v_gate_passed,
    'scores', (
      select coalesce(jsonb_object_agg(s.criterion_id, coalesce(to_jsonb(s.score), to_jsonb(s.passed))), '{}')
      from public.judge_scores s
      where s.assignment_id = p_assignment_id
    )
  );
end;
$$;

revoke execute on function public.save_review_scores(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.save_review_scores(uuid, uuid, jsonb, text) to authenticated;

-- Submitting on a judge's behalf, as before, now through the shared helper.
-- The trail keeps the scores as stored rather than as sent.
create or replace function public.submit_judge_score(p_hackathon_id uuid, p_assignment_id uuid, p_scores jsonb, p_notes text)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_a record;
  v_result jsonb;
  v_notes text := left(trim(coalesce(p_notes, '')), 4000);
begin
  select a.id, a.project_id, a.judge_id, a.submitted_at, ph.name as phase_name, ph.started_at, ph.closed_at, j.name as judge_name
  into v_a
  from public.judge_assignments a
  join public.judging_phases ph on ph.id = a.phase_id
  join public.judges j on j.id = a.judge_id
  where a.id = p_assignment_id and ph.hackathon_id = p_hackathon_id;
  if not found then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;
  if v_a.started_at is null or v_a.closed_at is not null then
    raise exception 'Scores can only be entered while the phase is running' using errcode = 'P0001';
  end if;

  v_result := public.save_review_scores(p_assignment_id, p_hackathon_id, p_scores, v_notes);
  update public.judge_assignments set submitted_by = (select auth.uid()) where id = p_assignment_id;

  -- actor_id defaults to auth.uid() and actor_name to the admin's name.
  insert into public.project_events (project_id, kind, actor_kind, data)
  values (v_a.project_id, 'judge_scored', 'admin', jsonb_build_object(
    'total', v_result -> 'total',
    'gate_passed', v_result -> 'gate_passed',
    'judge_id', v_a.judge_id,
    'judge_name', v_a.judge_name,
    'phase', v_a.phase_name,
    'on_behalf', true,
    'resubmitted', v_a.submitted_at is not null,
    'scores', v_result -> 'scores',
    'note', v_notes
  ));

  return (v_result ->> 'total')::numeric;
end;
$$;

-- ── A judge's queue ───────────────────────────────────────────────────────

-- A judge's queue in a phase, in the order they work through it: projects
-- still in the running (active and in the phase), shuffled per judge so the
-- panel doesn't all start on the same few. With daily batches the queue is
-- split into batch_days even batches, and batch n opens n days after the
-- phase started; one the judge pulled in early, or already scored, stays open.
create function public.judge_queue(p_judge_id uuid, p_phase_id uuid)
returns table (
  assignment_id uuid,
  project_id uuid,
  number integer,
  idx integer,
  batch integer,
  is_open boolean,
  submitted_at timestamptz,
  score numeric,
  adjusted_at timestamptz,
  daily boolean,
  day integer,
  per_day integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with plan as (
    select
      coalesce(d.cadence = 'daily', false) as daily,
      coalesce(d.batch_days, 5) as days,
      greatest(floor(extract(epoch from now() - ph.started_at) / 86400), 0)::integer as day
    from public.judging_phases ph
    left join public.distribution_settings d on d.hackathon_id = ph.hackathon_id
    where ph.id = p_phase_id
  ), q as (
    select
      a.id, a.project_id, p.number, a.submitted_at, a.score, a.released_at, a.adjusted_at,
      (row_number() over (order by md5(a.judge_id::text || a.project_id::text)) - 1)::integer as idx,
      (count(*) over ())::integer as n
    from public.judge_assignments a
    join public.projects p on p.id = a.project_id and p.phase_id = a.phase_id and p.status = 'active'
    where a.judge_id = p_judge_id and a.phase_id = p_phase_id
  ), sized as (
    select q.*, plan.daily, plan.day,
      case when plan.daily then ceil(q.n::numeric / plan.days)::integer else q.n end as per_day
    from q
    cross join plan
  )
  select
    s.id,
    s.project_id,
    s.number,
    s.idx,
    s.idx / s.per_day,
    not s.daily or s.idx / s.per_day <= s.day or s.released_at is not null or s.submitted_at is not null,
    s.submitted_at,
    s.score,
    s.adjusted_at,
    s.daily,
    s.day,
    s.per_day
  from sized s;
$$;

-- Only the functions below call it.
revoke execute on function public.judge_queue(uuid, uuid) from public, anon, authenticated;

-- ── The judge's page ──────────────────────────────────────────────────────

-- Everything /j/<token> shows, as one JSON object, or null when the token
-- doesn't open anything. The queue covers the running phase only; projects
-- in batches that haven't opened show no name. With p_assignment_id (one of
-- the judge's open projects) it also returns that project's submission and
-- the judge's scores, plus the agent's verdicts once the judge has submitted
-- and the hackathon shows them.
create function public.judge_portal(p_token text, p_assignment_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_judge public.judges;
  v_h public.hackathons;
  v_phase public.judging_phases;
  v_show_agent boolean;
  v_name_block uuid;
  v_pitch_block uuid;
  v_queue jsonb := '[]';
  v_plan jsonb;
  v_current jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24,64}$' then
    return null;
  end if;
  select * into v_judge from public.judges where access_token = p_token;
  if not found then
    return null;
  end if;
  select * into v_h from public.hackathons where id = v_judge.hackathon_id;

  select * into v_phase from public.judging_phases
  where hackathon_id = v_h.id and started_at is not null and closed_at is null
  order by position
  limit 1;

  select coalesce((select d.show_agent_score from public.distribution_settings d where d.hackathon_id = v_h.id), true)
  into v_show_agent;

  -- The name is the first text block and the pitch the next text or long text
  -- block, as lib/project-fields.ts projectHeadline() picks them.
  select b.id into v_name_block from public.schema_blocks b
  where b.hackathon_id = v_h.id and b.type = 'text'
  order by b.position limit 1;
  select b.id into v_pitch_block from public.schema_blocks b
  where b.hackathon_id = v_h.id and b.type in ('text', 'long text') and b.id is distinct from v_name_block
  order by b.position limit 1;

  if v_phase.id is not null then
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'id', q.assignment_id,
        'number', q.number,
        'idx', q.idx,
        'batch', q.batch,
        'open', q.is_open,
        'submitted_at', q.submitted_at,
        'score', q.score,
        'adjusted', q.adjusted_at is not null,
        'name', case when q.is_open then (
          select v.value #>> '{}' from public.project_values v where v.project_id = q.project_id and v.block_id = v_name_block
        ) end,
        'pitch', case when q.is_open then left((
          select v.value #>> '{}' from public.project_values v where v.project_id = q.project_id and v.block_id = v_pitch_block
        ), 280) end
      ) order by q.idx), '[]'),
      case when count(*) > 0 then jsonb_build_object(
        'daily', bool_or(q.daily),
        'day', max(q.day),
        'per_day', max(q.per_day),
        -- When the next batch that's still shut opens.
        'next_at', v_phase.started_at + (min(q.batch) filter (where not q.is_open)) * interval '1 day'
      ) end
    into v_queue, v_plan
    from public.judge_queue(v_judge.id, v_phase.id) q;

    if p_assignment_id is not null then
      select jsonb_build_object(
        'id', q.assignment_id,
        'number', q.number,
        'values', coalesce((
          select jsonb_object_agg(v.block_id, v.value) from public.project_values v where v.project_id = q.project_id
        ), '{}'),
        'scores', coalesce((
          select jsonb_object_agg(s.criterion_id, coalesce(to_jsonb(s.score), to_jsonb(s.passed)))
          from public.judge_scores s
          where s.assignment_id = q.assignment_id
        ), '{}'),
        'notes', a.notes,
        'submitted_at', q.submitted_at,
        'total', q.score,
        'adjusted_at', q.adjusted_at,
        -- Whether submitting will show the agent's verdicts.
        'agent_ready', v_show_agent and coalesce(r.status = 'done', false),
        'agent', case when v_show_agent and q.submitted_at is not null and r.status = 'done' then jsonb_build_object(
          'total', r.total,
          'gate_passed', r.gate_passed,
          -- An admin's override stands in for the agent's verdict, as in its total.
          'scores', coalesce((
            select jsonb_object_agg(st.criterion_id, v.verdict)
            from public.agent_review_steps st
            join public.criteria c on c.id = st.criterion_id
            cross join lateral (
              select case c.scale
                when 'score' then to_jsonb(coalesce(st.override_score, st.score))
                else to_jsonb(coalesce(st.override_passed, st.passed))
              end as verdict
            ) v
            where st.project_id = q.project_id and v.verdict is not null
          ), '{}')
        ) end
      )
      into v_current
      from public.judge_queue(v_judge.id, v_phase.id) q
      join public.judge_assignments a on a.id = q.assignment_id
      left join public.agent_reviews r on r.project_id = q.project_id
      where q.assignment_id = p_assignment_id and q.is_open;
    end if;
  end if;

  return jsonb_build_object(
    'hackathon', jsonb_build_object(
      'name', v_h.name, 'slug', v_h.slug, 'tagline', v_h.tagline, 'color', v_h.color,
      'logo', v_h.logo, 'logo_path', v_h.logo_path, 'stage', v_h.stage,
      'judging_started_at', v_h.judging_started_at
    ),
    'judge', jsonb_build_object(
      'id', v_judge.id, 'name', v_judge.name, 'title', v_judge.title, 'image_path', v_judge.image_path
    ),
    'settings', (
      select jsonb_build_object(
        'welcome_title', s.welcome_title, 'welcome_message', s.welcome_message,
        'goals', to_jsonb(s.goals), 'done_message', s.done_message
      )
      from public.judge_portal_settings s
      where s.hackathon_id = v_h.id
    ),
    'phase', case when v_phase.id is not null then jsonb_build_object(
      'id', v_phase.id,
      'name', v_phase.name,
      'index', v_phase.position,
      'count', (select count(*) from public.judging_phases where hackathon_id = v_h.id),
      'started_at', v_phase.started_at
    ) end,
    'show_agent_score', v_show_agent,
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'description', c.description, 'scale', c.scale, 'weight', c.weight, 'gate', c.gate
      ) order by c.position)
      from public.criteria c
      where c.hackathon_id = v_h.id
    ), '[]'),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'title', b.title, 'type', b.type, 'description', b.description, 'expected', b.expected
      ) order by b.position)
      from public.schema_blocks b
      where b.hackathon_id = v_h.id
    ), '[]'),
    'queue', v_queue,
    'plan', v_plan,
    'current', v_current
  );
end;
$$;

-- Submit (or change) the judge's scores for one project in their queue.
-- Scores and totals work as in save_review_scores. When the hackathon shows
-- judges the agent's score after they submit, a judge who has seen it gets
-- one change. Logs 'judge_scored' to the project's trail as the judge.
-- Returns {total, gate_passed, scores, adjusted, agent_ready}.
create function public.judge_submit_score(p_token text, p_assignment_id uuid, p_scores jsonb, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_judge public.judges;
  v_a record;
  v_show_agent boolean;
  v_agent_done boolean;
  v_revealed boolean;
  v_result jsonb;
  v_notes text := left(trim(coalesce(p_notes, '')), 4000);
begin
  select * into v_judge from public.judges where access_token = p_token;
  if not found then
    raise exception 'This judging link doesn''t work any more. Ask the organizers for your current link.'
      using errcode = 'P0002';
  end if;

  select a.id, a.project_id, a.submitted_at, a.adjusted_at, ph.name as phase_name, ph.started_at, ph.closed_at,
    p.status = 'active' and p.phase_id is not distinct from a.phase_id as in_running
  into v_a
  from public.judge_assignments a
  join public.judging_phases ph on ph.id = a.phase_id
  join public.projects p on p.id = a.project_id
  where a.id = p_assignment_id and a.judge_id = v_judge.id
  for update of a;
  if not found then
    raise exception 'That project isn''t in your queue' using errcode = 'P0002';
  end if;
  if v_a.started_at is null or v_a.closed_at is not null then
    raise exception '% has closed, so scores can''t change any more', v_a.phase_name using errcode = 'P0001';
  end if;
  if not v_a.in_running then
    raise exception 'This project was taken out of judging, so it doesn''t need a score' using errcode = 'P0001';
  end if;

  select coalesce((select d.show_agent_score from public.distribution_settings d where d.hackathon_id = v_judge.hackathon_id), true)
  into v_show_agent;
  v_agent_done := exists (select 1 from public.agent_reviews r where r.project_id = v_a.project_id and r.status = 'done');
  v_revealed := v_show_agent and v_agent_done and v_a.submitted_at is not null;
  if v_revealed and v_a.adjusted_at is not null then
    raise exception 'You''ve already changed this score once since seeing the agent''s' using errcode = 'P0001';
  end if;

  v_result := public.save_review_scores(p_assignment_id, v_judge.hackathon_id, p_scores, v_notes);
  update public.judge_assignments set
    submitted_by = null,
    adjusted_at = case when v_revealed then now() else adjusted_at end
  where id = p_assignment_id;

  insert into public.project_events (project_id, kind, actor_kind, actor_id, actor_name, data)
  values (v_a.project_id, 'judge_scored', 'judge', null, left(v_judge.name, 120), jsonb_strip_nulls(jsonb_build_object(
    'total', v_result -> 'total',
    'gate_passed', v_result -> 'gate_passed',
    'judge_id', v_judge.id,
    'judge_name', v_judge.name,
    'phase', v_a.phase_name,
    'via', 'link',
    'resubmitted', v_a.submitted_at is not null,
    'adjusted', v_revealed,
    'scores', v_result -> 'scores',
    'note', nullif(v_notes, ''),
    -- Someone signed in opened the judge's link (an admin trying it, say).
    'signed_in_as', (select auth.uid())
  )));

  return v_result || jsonb_build_object('adjusted', v_revealed, 'agent_ready', v_show_agent and v_agent_done);
end;
$$;

-- Daily batches: open the judge's next batch now instead of on its day.
-- Returns the first project it opened.
create function public.judge_release_batch(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_judge public.judges;
  v_phase uuid;
  v_first uuid;
begin
  select * into v_judge from public.judges where access_token = p_token;
  if not found then
    raise exception 'This judging link doesn''t work any more. Ask the organizers for your current link.'
      using errcode = 'P0002';
  end if;
  select id into v_phase from public.judging_phases
  where hackathon_id = v_judge.hackathon_id and started_at is not null and closed_at is null
  order by position
  limit 1;
  if v_phase is null then
    raise exception 'Judging isn''t running right now' using errcode = 'P0001';
  end if;

  with q as (
    select * from public.judge_queue(v_judge.id, v_phase)
  ), next_batch as (
    select min(q.batch) as batch from q where not q.is_open
  ), released as (
    update public.judge_assignments a set released_at = now()
    from q, next_batch nb
    where a.id = q.assignment_id and not q.is_open and q.batch = nb.batch
    returning a.id, q.idx
  )
  select r.id into v_first from released r order by r.idx limit 1;

  if v_first is null then
    raise exception 'There''s nothing more in your queue' using errcode = 'P0001';
  end if;
  return v_first;
end;
$$;

revoke execute on function public.judge_portal(text, uuid) from public;
revoke execute on function public.judge_submit_score(text, uuid, jsonb, text) from public;
revoke execute on function public.judge_release_batch(text) from public;
grant execute on function public.judge_portal(text, uuid) to anon, authenticated;
grant execute on function public.judge_submit_score(text, uuid, jsonb, text) to anon, authenticated;
grant execute on function public.judge_release_batch(text) to anon, authenticated;

-- ── An admin's own review ─────────────────────────────────────────────────

-- Score a project yourself, as the signed-in admin, for the phase it's in
-- (which must be running). It's one more review in that phase's average and
-- doesn't touch the assigned judges'. Submitting again updates it. Logs
-- 'judge_scored' with admin_review. Returns the total.
create function public.submit_admin_score(p_hackathon_id uuid, p_project_id uuid, p_scores jsonb, p_notes text)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := left(coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
    auth.jwt() ->> 'email',
    ''
  ), 120);
  v_phase public.judging_phases;
  v_id uuid;
  v_was timestamptz;
  v_result jsonb;
  v_notes text := left(trim(coalesce(p_notes, '')), 4000);
begin
  if v_uid is null then
    raise exception 'Sign in to score projects' using errcode = '42501';
  end if;
  select ph.* into v_phase
  from public.projects p
  join public.judging_phases ph on ph.id = p.phase_id
  where p.id = p_project_id and p.hackathon_id = p_hackathon_id and p.status = 'active'
    and ph.started_at is not null and ph.closed_at is null;
  if not found then
    raise exception 'Only projects in the running phase can be scored' using errcode = 'P0001';
  end if;

  insert into public.judge_assignments as a (phase_id, project_id, admin_id, admin_name)
  values (v_phase.id, p_project_id, v_uid, v_name)
  on conflict (phase_id, project_id, admin_id) where admin_id is not null
  do update set admin_name = excluded.admin_name
  returning a.id, a.submitted_at into v_id, v_was;

  v_result := public.save_review_scores(v_id, p_hackathon_id, p_scores, v_notes);
  update public.judge_assignments set submitted_by = v_uid where id = v_id;

  insert into public.project_events (project_id, kind, actor_kind, data)
  values (p_project_id, 'judge_scored', 'admin', jsonb_strip_nulls(jsonb_build_object(
    'total', v_result -> 'total',
    'gate_passed', v_result -> 'gate_passed',
    'phase', v_phase.name,
    'admin_review', true,
    'resubmitted', v_was is not null,
    'scores', v_result -> 'scores',
    'note', nullif(v_notes, '')
  )));

  return (v_result ->> 'total')::numeric;
end;
$$;

-- Take back your own review of a project in the running phase. Logs it.
create function public.remove_admin_score(p_hackathon_id uuid, p_project_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_removed record;
begin
  delete from public.judge_assignments a
  using public.judging_phases ph
  where ph.id = a.phase_id
    and ph.hackathon_id = p_hackathon_id
    and ph.started_at is not null and ph.closed_at is null
    and a.project_id = p_project_id
    and a.admin_id = (select auth.uid())
  returning ph.name as phase_name, a.score
  into v_removed;
  if not found then
    raise exception 'You haven''t scored this project in the running phase' using errcode = 'P0002';
  end if;

  insert into public.project_events (project_id, kind, actor_kind, data)
  values (p_project_id, 'judge_scored', 'admin', jsonb_strip_nulls(jsonb_build_object(
    'phase', v_removed.phase_name,
    'admin_review', true,
    'removed', true,
    'was', v_removed.score
  )));
end;
$$;

revoke execute on function public.submit_admin_score(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.remove_admin_score(uuid, uuid) from public, anon;
grant execute on function public.submit_admin_score(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.remove_admin_score(uuid, uuid) to authenticated;

-- Real judge scoring: one score per criterion on each assignment, notes, and
-- who entered it. Admins can open a judge's view of a project and submit on
-- that judge's behalf; the audit trail records the admin's user id.

-- ── Assignments: notes and who submitted ──────────────────────────────────

alter table public.judge_assignments
  add column notes text not null default '' check (char_length(notes) <= 4000),
  -- The signed-in user who submitted it: an admin entering it for the judge.
  -- Null when submitted another way (judge link, simulation).
  add column submitted_by uuid references auth.users (id) on delete set null;

create index judge_assignments_submitted_by_idx on public.judge_assignments (submitted_by);

-- ── Per-criterion scores ──────────────────────────────────────────────────

create table public.judge_scores (
  assignment_id uuid not null references public.judge_assignments (id) on delete cascade,
  criterion_id uuid not null references public.criteria (id) on delete cascade,
  -- 1–10 for 'score' criteria; pass/fail criteria use `passed` instead.
  score integer check (score between 1 and 10),
  passed boolean,
  primary key (assignment_id, criterion_id),
  check ((score is null) <> (passed is null))
);

create index judge_scores_criterion_id_idx on public.judge_scores (criterion_id);

alter table public.judge_scores enable row level security;

create policy "Owners can read their judge scores" on public.judge_scores for select to authenticated
using (exists (
  select 1 from public.judge_assignments a
  join public.judging_phases ph on ph.id = a.phase_id
  where a.id = assignment_id and public.owns_hackathon(ph.hackathon_id)
));
-- The criterion must belong to the assignment's hackathon.
create policy "Owners can create judge scores" on public.judge_scores for insert to authenticated
with check (exists (
  select 1 from public.judge_assignments a
  join public.judging_phases ph on ph.id = a.phase_id
  join public.criteria c on c.id = criterion_id and c.hackathon_id = ph.hackathon_id
  where a.id = assignment_id and public.owns_hackathon(ph.hackathon_id)
));
create policy "Owners can delete their judge scores" on public.judge_scores for delete to authenticated
using (exists (
  select 1 from public.judge_assignments a
  join public.judging_phases ph on ph.id = a.phase_id
  where a.id = assignment_id and public.owns_hackathon(ph.hackathon_id)
));

grant select, insert, delete on public.judge_scores to authenticated;

-- ── Submitting ────────────────────────────────────────────────────────────

-- Submit (or resubmit) one judge's scores for one project, as the signed-in
-- admin. p_scores maps criterion id → 1–10 for score criteria, or true/false
-- for pass/fail ones; every criterion must be scored. The assignment's total
-- is the weight-averaged score, a pass counting 10 and a fail 0. Logs
-- 'judge_scored' to the project's trail with the judge, the total and the
-- admin's user id (actor_id). Returns the total.
create function public.submit_judge_score(p_hackathon_id uuid, p_assignment_id uuid, p_scores jsonb, p_notes text)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_a record;
  v_missing text;
  v_bad text;
  v_total numeric(4, 2);
  v_gate_passed boolean;
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
    case when c.scale = 'score' then (p_scores ->> c.id::text)::integer end,
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
    notes = v_notes,
    submitted_by = (select auth.uid())
  where id = p_assignment_id;

  -- actor_id defaults to auth.uid() and actor_name to the admin's name.
  insert into public.project_events (project_id, kind, actor_kind, data)
  values (v_a.project_id, 'judge_scored', 'admin', jsonb_build_object(
    'total', v_total,
    'gate_passed', v_gate_passed,
    'judge_id', v_a.judge_id,
    'judge_name', v_a.judge_name,
    'phase', v_a.phase_name,
    'on_behalf', true,
    'resubmitted', v_a.submitted_at is not null,
    'scores', p_scores,
    'note', v_notes
  ));

  return v_total;
end;
$$;

revoke execute on function public.submit_judge_score(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.submit_judge_score(uuid, uuid, jsonb, text) to authenticated;

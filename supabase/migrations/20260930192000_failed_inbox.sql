-- Agent-failed inbox. When the agent fails a project on a gate, someone looks
-- at it and makes the call:
--
--   • 'upheld': they agree. The failure stands, so the project ranks below
--     every project that passed and can't win an award. They can eliminate it
--     there and then.
--   • 'overturned': they disagree. The failure is cleared and the project
--     ranks on its scores like any other.
--
-- Who looks is picked in Setup › Distribution: the admin (the default), one
-- judge, or nobody (failures just stand). Decisions are made from the Inbox
-- in the hackathon's top bar.

-- ── Who reviews them ──────────────────────────────────────────────────────

alter table public.distribution_settings
  add column failed_inbox text not null default 'admin' check (failed_inbox in ('admin', 'judge', 'nobody'));

-- Rows saved before this could only pick a judge or nobody, and nobody was
-- just the default. Nothing is decided automatically either way (a failure
-- stands until someone overturns it), so those rows get the admin; a picked
-- judge stays. inbox_judge_id stays the judge when failed_inbox = 'judge'.
update public.distribution_settings
set failed_inbox = case when inbox_judge_id is null then 'admin' else 'judge' end;

-- ── Decisions ─────────────────────────────────────────────────────────────

alter table public.agent_reviews
  add column gate_decision text check (gate_decision in ('upheld', 'overturned')),
  add column gate_decision_note text not null default '' check (char_length(gate_decision_note) <= 2000),
  add column gate_decided_by uuid references auth.users (id) on delete set null,
  add column gate_decided_at timestamptz,
  -- Upheld and eliminated in one go, so undoing the decision reinstates it.
  add column gate_eliminated boolean not null default false,
  -- Only a failed gate is decided on, and only an upheld one eliminates.
  add constraint agent_reviews_gate_decision_shape check (
    (gate_decision is null) = (gate_decided_at is null)
    and (gate_decision is null or gate_passed = false)
    and (coalesce(gate_decision = 'upheld', false) or not gate_eliminated)
  );

create index agent_reviews_gate_decided_by_idx on public.agent_reviews (gate_decided_by);

-- A decision is about one failed verdict. When the verdict changes (the agent
-- runs again, or an override makes every gate pass) it no longer applies.
create function public.clear_agent_gate_decision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.gate_decision := null;
  new.gate_decision_note := '';
  new.gate_decided_by := null;
  new.gate_decided_at := null;
  new.gate_eliminated := false;
  return new;
end;
$$;

create trigger agent_reviews_clear_gate_decision
before update of gate_passed on public.agent_reviews
for each row
when (new.gate_passed is not false and new.gate_decision is not null)
execute function public.clear_agent_gate_decision();

-- Record the call on a project the agent failed on a gate, or undo it with
-- p_decision null. Upheld with p_eliminate also eliminates the project;
-- undoing that reinstates it, if it's still eliminated and its phase hasn't
-- closed. Logs 'agent_gate_decided' naming the gates that failed. Runs as the
-- caller, so only the hackathon's owner can decide.
create function public.decide_agent_gate(
  p_hackathon_id uuid,
  p_project_id uuid,
  p_decision text,
  p_note text default '',
  p_eliminate boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_r record;
  v_note text := left(trim(coalesce(p_note, '')), 2000);
  v_eliminate boolean;
  v_gates text;
begin
  if p_decision is not null and p_decision not in ('upheld', 'overturned') then
    raise exception 'Unknown decision' using errcode = '22023';
  end if;

  select r.gate_passed, r.gate_decision, r.gate_eliminated, p.status as project_status,
    coalesce(ph.closed_at is not null, false) as phase_closed
  into v_r
  from public.agent_reviews r
  join public.projects p on p.id = r.project_id
  left join public.judging_phases ph on ph.id = p.phase_id
  where r.project_id = p_project_id and p.hackathon_id = p_hackathon_id
  for update of r;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  if v_r.gate_passed is distinct from false then
    raise exception 'The agent didn''t fail a gate on this project, so there''s nothing to decide' using errcode = 'P0001';
  end if;
  if p_decision is null and v_r.gate_decision is null then
    raise exception 'There''s no decision to undo' using errcode = 'P0001';
  end if;
  if p_decision is not null and v_r.gate_decision is not null then
    raise exception 'Someone already decided this one. Undo it first to change it' using errcode = 'P0001';
  end if;

  v_eliminate := coalesce(p_decision = 'upheld', false) and coalesce(p_eliminate, false) and v_r.project_status = 'active';

  -- The gates that failed, as they count: an admin's override over the agent.
  select string_agg(c.title, ', ' order by c.position) into v_gates
  from public.agent_review_steps s
  join public.criteria c on c.id = s.criterion_id
  where s.project_id = p_project_id and c.gate and c.scale = 'pass_fail'
    and coalesce(s.override_passed, s.passed) = false;

  update public.agent_reviews set
    gate_decision = p_decision,
    gate_decision_note = case when p_decision is null then '' else v_note end,
    gate_decided_by = case when p_decision is null then null else (select auth.uid()) end,
    gate_decided_at = case when p_decision is null then null else now() end,
    gate_eliminated = v_eliminate
  where project_id = p_project_id;

  insert into public.project_events (project_id, kind, data)
  values (p_project_id, 'agent_gate_decided', jsonb_strip_nulls(jsonb_build_object(
    'decision', p_decision,
    'undone', case when p_decision is null then v_r.gate_decision end,
    'gates', v_gates,
    'note', nullif(v_note, ''),
    'eliminated', case when v_eliminate then true end
  )));

  if v_eliminate then
    perform public.set_project_status(
      p_hackathon_id, array[p_project_id], 'eliminated',
      concat_ws(': ', 'Failed an agent gate' || coalesce(' (' || v_gates || ')', ''), nullif(v_note, ''))
    );
  elsif p_decision is null and v_r.gate_eliminated and v_r.project_status = 'eliminated' and not v_r.phase_closed then
    perform public.set_project_status(p_hackathon_id, array[p_project_id], 'active', 'Agent gate decision undone');
  end if;
end;
$$;

revoke execute on function public.decide_agent_gate(uuid, uuid, text, text, boolean) from public, anon;
grant execute on function public.decide_agent_gate(uuid, uuid, text, text, boolean) to authenticated;

-- ── Audit trail ───────────────────────────────────────────────────────────

alter table public.project_events drop constraint project_events_kind_check;
alter table public.project_events add constraint project_events_kind_check check (kind in (
  'submitted', 'edited', 'moved', 'eliminated', 'reinstated', 'disqualified', 'note', 'agent_scored', 'judge_scored',
  'judging_reset', 'ranked', 'awarded', 'award_removed',
  'agent_rescored', 'agent_overridden', 'agent_flagged',
  'agent_gate_decided'
));

-- ── Ranking ───────────────────────────────────────────────────────────────

-- As in 20260930173500_judge_gate_rule.sql, except an agent gate failure the
-- inbox overturned counts as a pass. Closing a phase ranks through this, so
-- it advances and places the project on its scores.
create or replace function public.rank_phase(p_phase_id uuid)
returns table (project_id uuid, rank integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, (row_number() over (
    order by
      coalesce((
        select r.gate_passed = false and r.gate_decision is distinct from 'overturned'
        from public.agent_reviews r where r.project_id = p.id
      ), false)
        or coalesce(public.judge_gate_failed(p.id), false),
      (select avg(a.score) from public.judge_assignments a where a.phase_id = p_phase_id and a.project_id = p.id) desc nulls last,
      (select r.total from public.agent_reviews r where r.project_id = p.id) desc nulls last,
      p.number
  ))::integer
  from public.projects p
  where p.phase_id = p_phase_id and p.status = 'active';
$$;

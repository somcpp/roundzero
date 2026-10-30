-- Agent review workflow: the agent works through a project one criterion at a
-- time. Each criterion says how the agent should judge it (what to look for,
-- which model, when to double-check), each step keeps the agent's score,
-- reasoning, evidence and flags, and admins direct it from there: re-run a
-- step with guidance, flag it for a person, or override it. Every change is
-- logged to the project's audit trail.

-- ── Criteria: how the agent judges each one ───────────────────────────────

alter table public.criteria
  -- What the agent should look for, in the organizer's words.
  add column agent_guidance text not null default '' check (char_length(agent_guidance) <= 4000),
  -- 'quick': small, fast model and no tool use. 'balanced': the default.
  -- 'deep': the largest model, with more room to investigate.
  add column agent_model text not null default 'balanced' check (agent_model in ('quick', 'balanced', 'deep')),
  -- Packages, APIs, SDKs or keywords the code mechanisms search the repo for.
  add column look_for text[] not null default '{}' check (
    cardinality(look_for) <= 30 and char_length(array_to_string(look_for, '')) <= 2000
  ),
  -- Shell commands for sandbox runs; empty lets the agent work out install, build and test.
  add column sandbox_commands text not null default '' check (char_length(sandbox_commands) <= 2000),
  -- When a second, larger model checks the verdict: never, when the first is unsure, or always.
  add column double_check text not null default 'auto' check (double_check in ('off', 'auto', 'always'));

create or replace function public.save_criteria(p_hackathon_id uuid, p_criteria jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  delete from public.criteria
  where hackathon_id = p_hackathon_id
    and id not in (
      select (c ->> 'id')::uuid from jsonb_array_elements(p_criteria) c where c ->> 'id' is not null
    );

  insert into public.criteria as t
    (id, hackathon_id, position, title, scale, description, mechanisms, weight, if_missing, gate,
     agent_guidance, agent_model, look_for, sandbox_commands, double_check)
  select
    coalesce((c.value ->> 'id')::uuid, gen_random_uuid()),
    p_hackathon_id,
    (c.ordinality - 1)::integer,
    c.value ->> 'title',
    coalesce(c.value ->> 'scale', 'score'),
    coalesce(c.value ->> 'description', ''),
    coalesce(array(select jsonb_array_elements_text(c.value -> 'mechanisms')), '{}'),
    coalesce((c.value ->> 'weight')::integer, 0),
    coalesce(c.value ->> 'if_missing', 'judge'),
    coalesce((c.value ->> 'gate')::boolean, false),
    coalesce(c.value ->> 'agent_guidance', ''),
    coalesce(c.value ->> 'agent_model', 'balanced'),
    coalesce(array(select jsonb_array_elements_text(c.value -> 'look_for')), '{}'),
    coalesce(c.value ->> 'sandbox_commands', ''),
    coalesce(c.value ->> 'double_check', 'auto')
  from jsonb_array_elements(p_criteria) with ordinality as c (value, ordinality)
  on conflict (id) do update set
    position = excluded.position,
    title = excluded.title,
    scale = excluded.scale,
    description = excluded.description,
    mechanisms = excluded.mechanisms,
    weight = excluded.weight,
    if_missing = excluded.if_missing,
    gate = excluded.gate,
    agent_guidance = excluded.agent_guidance,
    agent_model = excluded.agent_model,
    look_for = excluded.look_for,
    sandbox_commands = excluded.sandbox_commands,
    double_check = excluded.double_check
  -- An id from another hackathon is left alone rather than moved.
  where t.hackathon_id = excluded.hackathon_id;

  delete from public.criterion_inputs i
  using public.criteria c
  where c.id = i.criterion_id and c.hackathon_id = p_hackathon_id;

  insert into public.criterion_inputs (criterion_id, block_id)
  select distinct (c.value ->> 'id')::uuid, b.id
  from jsonb_array_elements(p_criteria) c (value)
  cross join lateral jsonb_array_elements_text(coalesce(c.value -> 'inputs', '[]')) i (block_id)
  -- Skip blocks that were deleted since the editor loaded.
  join public.schema_blocks b on b.id = i.block_id::uuid and b.hackathon_id = p_hackathon_id
  where c.value ->> 'id' is not null;
end;
$$;

-- New hackathons' default rubric comes with guidance for the agent.
create or replace function public.seed_criteria(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.criteria
    (hackathon_id, position, title, scale, description, mechanisms, weight, if_missing, agent_guidance, agent_model)
  values
    (p_hackathon_id, 0, 'Technical execution', 'score', 'Code runs, is structured, and does what the demo claims.',
      '{sandbox_run,code_scraper,agent_judge}', 30, 'zero',
      'Check the core feature is really implemented, not mocked or hard-coded. Reward working run instructions and real tests, not README length.',
      'balanced'),
    (p_hackathon_id, 1, 'Video: problem & solution', 'score', 'Video clearly states the problem and shows the working solution within 3 minutes.',
      '{video_reviewer}', 25, 'zero',
      'Look for the problem stated in the first 30 seconds and the product actually running on screen. Going over 3 minutes is a soft penalty, not a zero.',
      'balanced'),
    (p_hackathon_id, 2, 'Impact', 'score', 'Solves a real problem for a clear audience, and could keep going after the event.',
      '{agent_judge,web_scraper}', 25, 'judge',
      'Name the audience and the problem. Evidence of real users beats claims of them.',
      'balanced'),
    (p_hackathon_id, 3, 'Originality & design', 'score', 'Novel idea, thoughtful UX.',
      '{graphic_reviewer,agent_judge}', 20, 'judge',
      'Compare with well-known existing products. Judge the screenshots for clarity and polish.',
      'balanced');

  insert into public.criterion_inputs (criterion_id, block_id)
  select c.id, b.id
  from public.criteria c
  join public.schema_blocks b on b.hackathon_id = c.hackathon_id
  where c.hackathon_id = p_hackathon_id
    and (
      (c.position = 0 and b.type = 'repo url')
      or (c.position = 1 and b.type = 'video url')
    );
end;
$$;

-- ── Agent reviews: one run per project ────────────────────────────────────

alter table public.agent_reviews
  add column started_at timestamptz,
  add column error text check (char_length(error) <= 2000),
  -- Direction from the admin for this whole run, on top of each criterion's own.
  add column guidance text not null default '' check (char_length(guidance) <= 4000),
  -- Model tier for the whole run; null uses each criterion's own.
  add column model_tier text check (model_tier in ('quick', 'balanced', 'deep')),
  add column requested_by uuid references auth.users (id) on delete set null,
  -- The agent's write-up once it's done.
  add column summary text not null default '' check (char_length(summary) <= 4000),
  add column strengths text[] not null default '{}' check (cardinality(strengths) <= 10),
  add column improvements text[] not null default '{}' check (cardinality(improvements) <= 10),
  -- Steps waiting on a person: flagged by the agent or an admin and not resolved.
  add column flagged integer not null default 0 check (flagged >= 0);

create index agent_reviews_requested_by_idx on public.agent_reviews (requested_by);

-- ── Steps: one criterion of one review ────────────────────────────────────

create table public.agent_review_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.agent_reviews (project_id) on delete cascade,
  criterion_id uuid not null references public.criteria (id) on delete cascade,
  -- 'skipped' is a judges-only criterion: the agent doesn't score it.
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'skipped')),
  -- Direction for this project only, from an admin re-running the step.
  guidance text not null default '' check (char_length(guidance) <= 4000),
  -- Null uses the run's tier, then the criterion's.
  model_tier text check (model_tier in ('quick', 'balanced', 'deep')),
  -- What it's doing right now, e.g. "Running npm test in the sandbox".
  activity text not null default '' check (char_length(activity) <= 300),

  -- The verdict. Score criteria get 1–10, or 0 when the inputs are missing and
  -- the criterion says to score that 0; pass/fail criteria get passed.
  score integer check (score between 0 and 10),
  passed boolean,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  reasoning text not null default '' check (char_length(reasoning) <= 8000),
  -- Written to the team: what would make it better.
  feedback text not null default '' check (char_length(feedback) <= 4000),
  -- [{source, detail, url?}]: what the reasoning rests on.
  evidence jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array' and octet_length(evidence::text) <= 100000),
  -- [{kind, note}]: e.g. a broken link, an unverified claim, a prompt injection attempt.
  flags jsonb not null default '[]' check (jsonb_typeof(flags) = 'array' and octet_length(flags::text) <= 20000),
  -- A person should look: the agent was unsure, the double check disagreed, the step failed, or an admin flagged it.
  needs_review boolean not null default false,
  review_reason text not null default '' check (char_length(review_reason) <= 2000),
  -- The second opinion, when there was one: {model, tier, agreed, score, passed, confidence, reasoning}.
  double_check jsonb check (double_check is null or jsonb_typeof(double_check) = 'object'),
  -- What the agent did, in order: mechanisms, tool calls, sandbox commands. Shown as "how it got there".
  trace jsonb not null default '[]' check (jsonb_typeof(trace) = 'array' and octet_length(trace::text) <= 500000),
  mechanisms text[] not null default '{}',
  model text check (char_length(model) <= 200),
  -- {inputTokens, outputTokens} across every model call in the step.
  usage jsonb check (usage is null or jsonb_typeof(usage) = 'object'),
  error text check (char_length(error) <= 2000),

  -- An admin's call on the verdict. An override takes the agent's place in the total.
  override_score integer check (override_score between 0 and 10),
  override_passed boolean,
  override_note text not null default '' check (char_length(override_note) <= 4000),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,

  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (project_id, criterion_id),
  check (override_score is null or override_passed is null)
);

create index agent_review_steps_criterion_id_idx on public.agent_review_steps (criterion_id);
create index agent_review_steps_resolved_by_idx on public.agent_review_steps (resolved_by);
-- Covers the "what needs a person" list.
create index agent_review_steps_needs_review_idx on public.agent_review_steps (project_id) where needs_review;

alter table public.agent_review_steps enable row level security;

create policy "Owners can read their agent review steps" on public.agent_review_steps for select to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));
-- The criterion must belong to the project's hackathon.
create policy "Owners can create agent review steps" on public.agent_review_steps for insert to authenticated
with check (exists (
  select 1 from public.projects p
  join public.criteria c on c.id = criterion_id and c.hackathon_id = p.hackathon_id
  where p.id = project_id and public.owns_hackathon(p.hackathon_id)
));
create policy "Owners can update their agent review steps" on public.agent_review_steps for update to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)))
with check (exists (
  select 1 from public.projects p
  join public.criteria c on c.id = criterion_id and c.hackathon_id = p.hackathon_id
  where p.id = project_id and public.owns_hackathon(p.hackathon_id)
));
create policy "Owners can delete their agent review steps" on public.agent_review_steps for delete to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.owns_hackathon(p.hackathon_id)));

grant select, insert, update, delete on public.agent_review_steps to authenticated;

-- ── Audit trail ───────────────────────────────────────────────────────────

alter table public.project_events drop constraint project_events_kind_check;
alter table public.project_events add constraint project_events_kind_check check (kind in (
  'submitted', 'edited', 'moved', 'eliminated', 'reinstated', 'disqualified', 'note', 'agent_scored', 'judge_scored',
  'judging_reset', 'ranked', 'awarded', 'award_removed',
  'agent_rescored', 'agent_overridden', 'agent_flagged'
));

-- ── Totals ────────────────────────────────────────────────────────────────

-- A review's weighted total out of 10, whether every gate passed, and how many
-- steps wait on a person. Each step counts its override if it has one, else
-- the agent's verdict; a pass counts 10 and a fail 0, like judge scores.
-- Steps without a verdict (judges-only, failed, not run) are left out.
create function public.agent_review_totals(p_project_id uuid)
returns table (total numeric, gate_passed boolean, flagged integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    round(coalesce(
      sum(v.value * c.weight) / nullif(sum(c.weight) filter (where v.value is not null), 0),
      avg(v.value)
    ), 2),
    coalesce(bool_and(v.passed) filter (where c.gate and c.scale = 'pass_fail' and v.passed is not null), true),
    (count(*) filter (where s.needs_review))::integer
  from public.agent_review_steps s
  join public.criteria c on c.id = s.criterion_id
  cross join lateral (
    select
      coalesce(s.override_passed, s.passed) as passed,
      case c.scale
        when 'score' then coalesce(s.override_score, s.score)::numeric
        else case coalesce(s.override_passed, s.passed) when true then 10 when false then 0 end
      end as value
  ) v
  where s.project_id = p_project_id;
$$;

revoke execute on function public.agent_review_totals(uuid) from public, anon;
grant execute on function public.agent_review_totals(uuid) to authenticated;

-- Bring a finished review's total, gate and flag count up to date with its steps.
create function public.refresh_agent_review(p_project_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.agent_reviews r set
    total = case when r.status = 'done' then t.total end,
    gate_passed = case when r.status = 'done' then t.gate_passed end,
    flagged = t.flagged
  from public.agent_review_totals(p_project_id) t
  where r.project_id = p_project_id;
$$;

revoke execute on function public.refresh_agent_review(uuid) from public, anon;
grant execute on function public.refresh_agent_review(uuid) to authenticated;

-- ── Running ───────────────────────────────────────────────────────────────

-- Queue the agent for these projects with the admin's direction for the run.
-- A project's previous verdicts and overrides are cleared (the audit trail
-- keeps them); each step keeps the guidance an admin gave it. Projects the
-- agent is already on are left alone. Returns how many were queued.
create function public.queue_agent_reviews(
  p_hackathon_id uuid,
  p_project_ids uuid[],
  p_guidance text default '',
  p_model_tier text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_model_tier is not null and p_model_tier not in ('quick', 'balanced', 'deep') then
    raise exception 'Unknown model tier' using errcode = '22023';
  end if;

  with upserted as (
    insert into public.agent_reviews as r (project_id, status, queued_at, guidance, model_tier, requested_by)
    select p.id, 'queued', now(), left(trim(coalesce(p_guidance, '')), 4000), p_model_tier, (select auth.uid())
    from public.projects p
    where p.hackathon_id = p_hackathon_id and p.id = any (p_project_ids)
    on conflict (project_id) do update set
      status = 'queued',
      total = null,
      gate_passed = null,
      queued_at = now(),
      started_at = null,
      finished_at = null,
      error = null,
      summary = '',
      strengths = '{}',
      improvements = '{}',
      flagged = 0,
      guidance = excluded.guidance,
      model_tier = excluded.model_tier,
      requested_by = excluded.requested_by
    where r.status not in ('queued', 'running')
    returning r.project_id
  ), reset as (
    update public.agent_review_steps s set
      status = 'queued', activity = '', score = null, passed = null, confidence = null, reasoning = '', feedback = '',
      evidence = '[]', flags = '[]', needs_review = false, review_reason = '', double_check = null, trace = '[]',
      mechanisms = '{}', model = null, usage = null, error = null,
      override_score = null, override_passed = null, override_note = '', resolved_by = null, resolved_at = null,
      queued_at = now(), started_at = null, finished_at = null
    from upserted u
    where s.project_id = u.project_id
    returning 1
  )
  select count(*) into v_count from upserted;
  return v_count;
end;
$$;

revoke execute on function public.queue_agent_reviews(uuid, uuid[], text, text) from public, anon;
grant execute on function public.queue_agent_reviews(uuid, uuid[], text, text) to authenticated;

-- Hand the next queued review to a worker and mark it running. Reviews left
-- running for 20 minutes are assumed abandoned and handed out again. SKIP
-- LOCKED lets several workers pull from the queue at once. Returns the
-- project id, or null when there's nothing to do.
create function public.claim_agent_review(p_hackathon_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  update public.agent_reviews r set status = 'running', started_at = now(), error = null
  where r.project_id = (
    select q.project_id
    from public.agent_reviews q
    join public.projects p on p.id = q.project_id
    where p.hackathon_id = p_hackathon_id
      and (q.status = 'queued' or (q.status = 'running' and q.started_at < now() - interval '20 minutes'))
    order by q.queued_at
    limit 1
    for update of q skip locked
  )
  returning r.project_id;
$$;

revoke execute on function public.claim_agent_review(uuid) from public, anon;
grant execute on function public.claim_agent_review(uuid) to authenticated;

-- Close out a review: its total, gate and flag count come from its steps,
-- the write-up is saved, and 'agent_scored' goes in the audit trail.
create function public.finish_agent_review(
  p_project_id uuid,
  p_summary text,
  p_strengths text[],
  p_improvements text[]
)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total numeric;
  v_gate boolean;
  v_flagged integer;
  v_scores jsonb;
begin
  if not exists (select 1 from public.agent_reviews where project_id = p_project_id) then
    raise exception 'Agent review not found' using errcode = 'P0002';
  end if;

  select t.total, t.gate_passed, t.flagged into v_total, v_gate, v_flagged
  from public.agent_review_totals(p_project_id) t;

  select coalesce(jsonb_object_agg(c.title, coalesce(to_jsonb(s.score), to_jsonb(s.passed))), '{}')
  into v_scores
  from public.agent_review_steps s
  join public.criteria c on c.id = s.criterion_id
  where s.project_id = p_project_id and (s.score is not null or s.passed is not null);

  update public.agent_reviews set
    status = 'done',
    total = v_total,
    gate_passed = v_gate,
    flagged = v_flagged,
    summary = left(coalesce(p_summary, ''), 4000),
    strengths = coalesce(p_strengths[1:10], '{}'),
    improvements = coalesce(p_improvements[1:10], '{}'),
    finished_at = now(),
    error = null
  where project_id = p_project_id;

  insert into public.project_events (project_id, kind, actor_kind, actor_id, actor_name, data)
  values (p_project_id, 'agent_scored', 'agent', null, 'Agent', jsonb_build_object(
    'total', v_total,
    'gate_passed', v_gate,
    'flagged', v_flagged,
    'scores', v_scores
  ));

  return v_total;
end;
$$;

revoke execute on function public.finish_agent_review(uuid, text, text[], text[]) from public, anon;
grant execute on function public.finish_agent_review(uuid, text, text[], text[]) to authenticated;

-- Queue one step to run again with the admin's direction. The previous
-- verdict stays in place (and in the total) until the new one lands. A step
-- stuck for 20 minutes can be queued again. Returns the step's id.
create function public.queue_agent_step(
  p_project_id uuid,
  p_criterion_id uuid,
  p_guidance text,
  p_model_tier text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_id uuid;
begin
  if p_model_tier is not null and p_model_tier not in ('quick', 'balanced', 'deep') then
    raise exception 'Unknown model tier' using errcode = '22023';
  end if;

  select r.status into v_status from public.agent_reviews r where r.project_id = p_project_id for update;
  if not found then
    raise exception 'Run the agent on this project first' using errcode = 'P0001';
  end if;
  if v_status in ('queued', 'running') then
    raise exception 'The agent is still reviewing this project. Try again when it''s done.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.criteria c
    join public.projects p on p.hackathon_id = c.hackathon_id
    where c.id = p_criterion_id and p.id = p_project_id
  ) then
    raise exception 'Criterion not found' using errcode = 'P0002';
  end if;

  insert into public.agent_review_steps as s (project_id, criterion_id, status, guidance, model_tier)
  values (p_project_id, p_criterion_id, 'queued', left(trim(coalesce(p_guidance, '')), 4000), p_model_tier)
  on conflict (project_id, criterion_id) do update set
    status = 'queued',
    guidance = excluded.guidance,
    model_tier = excluded.model_tier,
    activity = '',
    error = null,
    queued_at = now(),
    started_at = null
  where s.status not in ('queued', 'running')
    or coalesce(s.started_at, s.queued_at) < now() - interval '20 minutes'
  returning s.id into v_id;

  if v_id is null then
    raise exception 'This step is already running' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

revoke execute on function public.queue_agent_step(uuid, uuid, text, text) from public, anon;
grant execute on function public.queue_agent_step(uuid, uuid, text, text) to authenticated;

-- ── People directing the agent ────────────────────────────────────────────

-- Override the agent's verdict on one step (a 0–10 score, or pass/fail), with
-- a reason, or clear the override when both are null. It resolves the step's
-- flag, updates the review's total and logs 'agent_overridden'.
create function public.override_agent_step(p_step_id uuid, p_score integer, p_passed boolean, p_note text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_s record;
  v_note text := left(trim(coalesce(p_note, '')), 4000);
  v_clear boolean := p_score is null and p_passed is null;
  v_total numeric;
begin
  select s.project_id, s.score, s.passed, s.override_score, s.override_passed, c.title, c.scale
  into v_s
  from public.agent_review_steps s
  join public.criteria c on c.id = s.criterion_id
  where s.id = p_step_id
  for update of s;
  if not found then
    raise exception 'Step not found' using errcode = 'P0002';
  end if;
  if (v_s.scale = 'score' and p_passed is not null) or (v_s.scale = 'pass_fail' and p_score is not null) then
    raise exception '% takes a %', v_s.title, case v_s.scale when 'score' then 'score' else 'pass or fail' end
      using errcode = '22023';
  end if;
  if p_score is not null and p_score not between 0 and 10 then
    raise exception 'Scores are 0–10' using errcode = '22023';
  end if;
  if not v_clear and v_note = '' then
    raise exception 'Say why you''re overriding the agent' using errcode = 'P0001';
  end if;

  update public.agent_review_steps set
    override_score = p_score,
    override_passed = p_passed,
    override_note = case when v_clear then '' else v_note end,
    needs_review = case when v_clear then needs_review else false end,
    resolved_by = (select auth.uid()),
    resolved_at = now()
  where id = p_step_id;

  perform public.refresh_agent_review(v_s.project_id);
  select total into v_total from public.agent_reviews where project_id = v_s.project_id;

  insert into public.project_events (project_id, kind, data)
  values (v_s.project_id, 'agent_overridden', jsonb_strip_nulls(jsonb_build_object(
    'criterion', v_s.title,
    'agent', coalesce(to_jsonb(v_s.score), to_jsonb(v_s.passed)),
    'from', coalesce(to_jsonb(v_s.override_score), to_jsonb(v_s.override_passed)),
    'to', coalesce(to_jsonb(p_score), to_jsonb(p_passed)),
    'cleared', v_clear,
    'total', v_total,
    'note', nullif(v_note, '')
  )));
end;
$$;

revoke execute on function public.override_agent_step(uuid, integer, boolean, text) from public, anon;
grant execute on function public.override_agent_step(uuid, integer, boolean, text) to authenticated;

-- Flag a step for a person (with a reason), or clear its flag once someone
-- has looked and agrees with the agent. Logs 'agent_flagged'.
create function public.flag_agent_step(p_step_id uuid, p_flag boolean, p_note text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_s record;
  v_note text := left(trim(coalesce(p_note, '')), 2000);
begin
  select s.project_id, c.title into v_s
  from public.agent_review_steps s
  join public.criteria c on c.id = s.criterion_id
  where s.id = p_step_id
  for update of s;
  if not found then
    raise exception 'Step not found' using errcode = 'P0002';
  end if;
  if p_flag and v_note = '' then
    raise exception 'Say what needs a second look' using errcode = 'P0001';
  end if;

  update public.agent_review_steps set
    needs_review = p_flag,
    review_reason = case when p_flag then v_note else review_reason end,
    resolved_by = case when p_flag then null else (select auth.uid()) end,
    resolved_at = case when p_flag then null else now() end
  where id = p_step_id;

  perform public.refresh_agent_review(v_s.project_id);

  insert into public.project_events (project_id, kind, data)
  values (v_s.project_id, 'agent_flagged', jsonb_strip_nulls(jsonb_build_object(
    'criterion', v_s.title,
    'flagged', p_flag,
    'note', nullif(v_note, '')
  )));
end;
$$;

revoke execute on function public.flag_agent_step(uuid, boolean, text) from public, anon;
grant execute on function public.flag_agent_step(uuid, boolean, text) to authenticated;

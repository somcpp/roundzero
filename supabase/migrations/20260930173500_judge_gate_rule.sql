-- Judges' gate verdicts count. A gate (a pass/fail criterion that gates
-- eligibility) used to rule a project out only when the agent failed it; a
-- judge failing it just lowered their total. Each hackathon now picks what
-- failed gates in reviews do, in Setup › Distribution:
--
--   • 'flag': nothing automatic. The project shows which gates failed and in
--     how many reviews, and an admin decides (disqualifying it by hand if they
--     agree).
--   • 'rule_out' (the default): once judge_gate_count submitted reviews fail
--     the same gate, the project is ineligible. It ranks below every project
--     that passed, is eliminated when its phase closes instead of advancing or
--     taking a final rank, and can't win an award.
--
-- Reviews are counted rather than distinct judges, from every phase, so a
-- second look in a later phase adds to the count.

alter table public.distribution_settings
  add column judge_gate text not null default 'rule_out' check (judge_gate in ('flag', 'rule_out')),
  add column judge_gate_count integer not null default 2 check (judge_gate_count between 1 and 20);

-- ── Reading a project's gate verdicts ─────────────────────────────────────

-- The gates a project's submitted reviews failed: how many reviews failed
-- each, out of how many that scored it. Only gates with a failure are listed.
create function public.judge_gate_fails(p_project_id uuid)
returns table (criterion_id uuid, title text, fails integer, reviews integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.title, (count(*) filter (where s.passed = false))::integer, count(*)::integer
  from public.judge_scores s
  join public.judge_assignments a on a.id = s.assignment_id
  join public.criteria c on c.id = s.criterion_id
  where a.project_id = p_project_id and a.submitted_at is not null and c.gate and s.passed is not null
  group by c.id, c.title, c.position
  having count(*) filter (where s.passed = false) > 0
  order by c.position;
$$;

revoke execute on function public.judge_gate_fails(uuid) from public, anon;
grant execute on function public.judge_gate_fails(uuid) to authenticated;

-- True when reviews have ruled the project out under its hackathon's rule
-- (the defaults above when it has no distribution row).
create function public.judge_gate_failed(p_project_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(d.judge_gate, 'rule_out') = 'rule_out'
    and exists (
      select 1 from public.judge_gate_fails(p.id) f
      where f.fails >= coalesce(d.judge_gate_count, 2)
    )
  from public.projects p
  left join public.distribution_settings d on d.hackathon_id = p.hackathon_id
  where p.id = p_project_id;
$$;

revoke execute on function public.judge_gate_failed(uuid) from public, anon;
grant execute on function public.judge_gate_failed(uuid) to authenticated;

-- ── Ranking ───────────────────────────────────────────────────────────────

-- A phase's active projects in ranking order: gate passes first (neither the
-- agent nor enough reviews failed a gate), then average score in that phase,
-- then agent score, then submission order.
create or replace function public.rank_phase(p_phase_id uuid)
returns table (project_id uuid, rank integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, (row_number() over (
    order by
      coalesce((select r.gate_passed = false from public.agent_reviews r where r.project_id = p.id), false)
        or coalesce(public.judge_gate_failed(p.id), false),
      (select avg(a.score) from public.judge_assignments a where a.phase_id = p_phase_id and a.project_id = p.id) desc nulls last,
      (select r.total from public.agent_reviews r where r.project_id = p.id) desc nulls last,
      p.number
  ))::integer
  from public.projects p
  where p.phase_id = p_phase_id and p.status = 'active';
$$;

-- ── Closing a phase ───────────────────────────────────────────────────────

-- Close the running phase. Projects that reviews ruled out on a gate are
-- eliminated first, with the gates in the note. With a next phase, the top
-- advance_count of the rest move on and the others are eliminated; closing
-- the last phase ranks the rest and moves the hackathon to results.
create or replace function public.close_judging_phase(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phase public.judging_phases;
  v_next public.judging_phases;
  v_out uuid[];
  v_advancing uuid[];
  v_rest uuid[];
  v_id uuid;
  v_note text;
begin
  select * into v_phase from public.judging_phases
  where hackathon_id = p_hackathon_id and started_at is not null and closed_at is null
  order by position limit 1;
  if not found then
    raise exception 'No phase is running' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(p.id), '{}') into v_out
  from public.projects p
  where p.phase_id = v_phase.id and p.status = 'active' and coalesce(public.judge_gate_failed(p.id), false);

  select * into v_next from public.judging_phases
  where hackathon_id = p_hackathon_id and position > v_phase.position
  order by position limit 1;

  if not found then
    with ranked as (
      select r.project_id, (row_number() over (order by r.rank))::integer as rank
      from public.rank_phase(v_phase.id) r
      where not (r.project_id = any (v_out))
    ), updated as (
      update public.projects p set final_rank = r.rank
      from ranked r
      where p.id = r.project_id
      returning p.id, r.rank
    )
    insert into public.project_events (project_id, kind, data)
    select u.id, 'ranked', jsonb_build_object('rank', u.rank)
    from updated u;
  else
    select
      coalesce(array_agg(project_id order by rank) filter (where rank <= coalesce(v_phase.advance_count, 0)), '{}'),
      coalesce(array_agg(project_id order by rank) filter (where rank > coalesce(v_phase.advance_count, 0)), '{}')
    into v_advancing, v_rest
    from (
      select r.project_id, row_number() over (order by r.rank) as rank
      from public.rank_phase(v_phase.id) r
      where not (r.project_id = any (v_out))
    ) ranked;
  end if;

  update public.judging_phases set closed_at = now() where id = v_phase.id;

  -- One note per project, naming the gates its reviews failed.
  for v_id, v_note in
    select f.project_id, 'Failed ' || string_agg(format('%s in %s of %s reviews', f.title, f.fails, f.reviews), ', ')
    from (
      select p.id as project_id, g.title, g.fails, g.reviews
      from public.projects p
      cross join lateral public.judge_gate_fails(p.id) g
      where p.id = any (v_out)
    ) f
    group by f.project_id
  loop
    perform public.set_project_status(p_hackathon_id, array[v_id], 'eliminated', v_note);
  end loop;

  if v_next.id is null then
    update public.hackathons set stage = 'results' where id = p_hackathon_id;
    return;
  end if;

  perform public.set_project_status(
    p_hackathon_id, v_rest, 'eliminated',
    format('Not in the top %s of %s', v_phase.advance_count, v_phase.name)
  );
  perform public.move_projects(p_hackathon_id, v_advancing, v_next.id);
  perform public.start_judging_phase(p_hackathon_id, v_next.id);
end;
$$;

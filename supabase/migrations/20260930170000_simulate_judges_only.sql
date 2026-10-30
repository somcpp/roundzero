-- The agent is real now (see *_agent_review_workflow.sql), so the demo only
-- stands in for judges: it submits some of the running phase's assignments
-- with made-up scores near the agent's, and logs them to each project's
-- trail. Queued agent reviews are left for the agent.

create or replace function public.simulate_judging(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
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

-- Projects that failed an agent gate rank below every project that passed
-- when a phase closes, so they only advance if there's room.

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
        -- A failed gate rules a project out, so those rank below every project that passed.
        coalesce((select r.gate_passed = false from public.agent_reviews r where r.project_id = p.id), false),
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


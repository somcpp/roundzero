-- Starting judging puts every active project into the first phase, including
-- any moved into a later phase by hand while still in setup.

create or replace function public.start_judging(p_hackathon_id uuid)
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
    array(select id from public.projects where hackathon_id = p_hackathon_id and status = 'active'),
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


-- A color per judging phase, for the progress funnel. Null uses the default
-- for the phase's position (src/lib/phase-colors.ts).

alter table public.judging_phases
  add column color text check (color ~* '^#[0-9a-f]{6}$');

-- Same as 20260930060000_judging_progress.sql, now saving the color too.
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
    (id, hackathon_id, position, name, judge_group_id, reviews_per_project, advance_count, color)
  select
    (p.value ->> 'id')::uuid,
    p_hackathon_id,
    (p.ordinality - 1)::integer,
    p.value ->> 'name',
    g.id,
    (p.value ->> 'reviews_per_project')::integer,
    (p.value ->> 'advance_count')::integer,
    nullif(p.value ->> 'color', '')
  from jsonb_array_elements(p_phases) with ordinality as p (value, ordinality)
  left join public.judge_groups g
    on g.id = (p.value ->> 'judge_group_id')::uuid and g.hackathon_id = p_hackathon_id
  on conflict (id) do update set
    position = excluded.position,
    name = excluded.name,
    judge_group_id = excluded.judge_group_id,
    reviews_per_project = excluded.reviews_per_project,
    advance_count = excluded.advance_count,
    color = excluded.color
  where t.hackathon_id = excluded.hackathon_id;
end;
$$;

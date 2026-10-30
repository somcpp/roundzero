-- Schema blocks are never required: projects vary too much for any one field
-- to be mandatory, so entrants can skip whatever doesn't apply.

alter table public.schema_blocks drop column required;

create or replace function public.save_schema_blocks(p_hackathon_id uuid, p_blocks jsonb)
returns setof public.schema_blocks
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  delete from public.schema_blocks
  where hackathon_id = p_hackathon_id
    and id not in (
      select (b ->> 'id')::uuid from jsonb_array_elements(p_blocks) b where b ->> 'id' is not null
    );

  return query
  insert into public.schema_blocks as s
    (id, hackathon_id, position, title, type, description, expected)
  select
    coalesce((b.value ->> 'id')::uuid, gen_random_uuid()),
    p_hackathon_id,
    (b.ordinality - 1)::integer,
    b.value ->> 'title',
    b.value ->> 'type',
    coalesce(b.value ->> 'description', ''),
    coalesce(b.value ->> 'expected', '')
  from jsonb_array_elements(p_blocks) with ordinality as b (value, ordinality)
  on conflict (id) do update set
    position = excluded.position,
    title = excluded.title,
    type = excluded.type,
    description = excluded.description,
    expected = excluded.expected
  -- An id from another hackathon is left alone rather than moved.
  where s.hackathon_id = excluded.hackathon_id
  returning s.*;
end;
$$;

create or replace function public.seed_schema_blocks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.schema_blocks (hackathon_id, position, title, type, description, expected)
  values
    (new.id, 0, 'Title', 'text', 'The project''s name.', 'Short and memorable'),
    (new.id, 1, 'Description', 'text', 'Elevator pitch: what it does, in one line.', 'One sentence'),
    (new.id, 2, 'Video', 'video url', 'Demo of the project running. State the problem, then show the solution.', '≤ 3 min'),
    (new.id, 3, 'Images', 'image', 'Screenshots or photos of the project.', 'Up to 5 images'),
    (new.id, 4, 'Overview', 'long text', 'Inspiration, what it does, how it was built, challenges, what''s next.', 'The full project story'),
    (new.id, 5, 'GitHub', 'repo url', 'Public repo with a README and run instructions.', 'Agents can clone this');
  return new;
end;
$$;

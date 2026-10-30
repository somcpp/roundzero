-- Project schema: the ordered fields entrants fill in when submitting a
-- project. Each block belongs to one hackathon and is edited as a whole list
-- from Setup › Project schema.

create table public.schema_blocks (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  -- 0-based order within the hackathon's form.
  position integer not null check (position >= 0),
  title text not null check (char_length(title) between 1 and 120),
  -- text + check rather than an enum, so types are easy to add later.
  type text not null check (
    type in ('text', 'long text', 'number', 'url', 'video url', 'repo url', 'file', 'select', 'image', 'team')
  ),
  -- Shown to entrants under the field.
  description text not null default '' check (char_length(description) <= 2000),
  -- What a good answer looks like; guides entrants and judging agents.
  expected text not null default '' check (char_length(expected) <= 2000),
  required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Covers the FK and the "load this hackathon's form in order" read.
create index schema_blocks_hackathon_id_position_idx on public.schema_blocks (hackathon_id, position);

create trigger schema_blocks_set_updated_at
before update on public.schema_blocks
for each row execute function public.set_updated_at();

-- Row level security: only the hackathon's owner can see or change its schema.
alter table public.schema_blocks enable row level security;

create policy "Owners can read their schema blocks"
on public.schema_blocks for select
to authenticated
using (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
));

create policy "Owners can create schema blocks"
on public.schema_blocks for insert
to authenticated
with check (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
));

create policy "Owners can update their schema blocks"
on public.schema_blocks for update
to authenticated
using (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
));

create policy "Owners can delete their schema blocks"
on public.schema_blocks for delete
to authenticated
using (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
));

grant select, insert, update, delete on public.schema_blocks to authenticated;

-- Replace a hackathon's whole schema in one transaction: blocks missing from
-- p_blocks are deleted, the rest are upserted in array order. Runs as the
-- caller, so the policies above decide what it can touch.
create function public.save_schema_blocks(p_hackathon_id uuid, p_blocks jsonb)
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
    (id, hackathon_id, position, title, type, description, expected, required)
  select
    coalesce((b.value ->> 'id')::uuid, gen_random_uuid()),
    p_hackathon_id,
    (b.ordinality - 1)::integer,
    b.value ->> 'title',
    b.value ->> 'type',
    coalesce(b.value ->> 'description', ''),
    coalesce(b.value ->> 'expected', ''),
    coalesce((b.value ->> 'required')::boolean, false)
  from jsonb_array_elements(p_blocks) with ordinality as b (value, ordinality)
  on conflict (id) do update set
    position = excluded.position,
    title = excluded.title,
    type = excluded.type,
    description = excluded.description,
    expected = excluded.expected,
    required = excluded.required
  -- An id from another hackathon is left alone rather than moved.
  where s.hackathon_id = excluded.hackathon_id
  returning s.*;
end;
$$;

revoke execute on function public.save_schema_blocks(uuid, jsonb) from public, anon;
grant execute on function public.save_schema_blocks(uuid, jsonb) to authenticated;

-- Every hackathon starts with the Devpost submission fields.
create function public.seed_schema_blocks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.schema_blocks (hackathon_id, position, title, type, description, expected, required)
  values
    (new.id, 0, 'Title', 'text', 'The project''s name.', 'Short and memorable', true),
    (new.id, 1, 'Description', 'text', 'Elevator pitch: what it does, in one line.', 'One sentence', true),
    (new.id, 2, 'Video', 'video url', 'Demo of the project running. State the problem, then show the solution.', '≤ 3 min', true),
    (new.id, 3, 'Images', 'image', 'Screenshots or photos of the project.', 'Up to 5 images', false),
    (new.id, 4, 'Overview', 'long text', 'Inspiration, what it does, how it was built, challenges, what''s next.', 'The full project story', true),
    (new.id, 5, 'GitHub', 'repo url', 'Public repo with a README and run instructions.', 'Agents can clone this', true);
  return new;
end;
$$;

create trigger hackathons_seed_schema_blocks
after insert on public.hackathons
for each row execute function public.seed_schema_blocks();

-- Backfill hackathons created before this table existed.
insert into public.schema_blocks (hackathon_id, position, title, type, description, expected, required)
select h.id, d.position, d.title, d.type, d.description, d.expected, d.required
from public.hackathons h
cross join (values
  (0, 'Title', 'text', 'The project''s name.', 'Short and memorable', true),
  (1, 'Description', 'text', 'Elevator pitch: what it does, in one line.', 'One sentence', true),
  (2, 'Video', 'video url', 'Demo of the project running. State the problem, then show the solution.', '≤ 3 min', true),
  (3, 'Images', 'image', 'Screenshots or photos of the project.', 'Up to 5 images', false),
  (4, 'Overview', 'long text', 'Inspiration, what it does, how it was built, challenges, what''s next.', 'The full project story', true),
  (5, 'GitHub', 'repo url', 'Public repo with a README and run instructions.', 'Agents can clone this', true)
) as d (position, title, type, description, expected, required);

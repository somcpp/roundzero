-- Judging criteria: what gets scored, which schema blocks it reads, and how
-- the agent verifies it. Edited as a whole ordered list from Setup › Criteria.

create table public.criteria (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  -- 0-based order within the hackathon's rubric.
  position integer not null check (position >= 0),
  title text not null check (char_length(title) between 1 and 120),
  -- 'score' is 1–10; 'pass_fail' is a yes/no with notes.
  scale text not null default 'score' check (scale in ('score', 'pass_fail')),
  -- What great looks like; the rubric judges and agents score against.
  description text not null default '' check (char_length(description) <= 2000),
  -- How the agent verifies it. Text + check rather than an enum, so it's easy to add more.
  mechanisms text[] not null default '{agent_judge}' check (
    mechanisms <@ array['agent_judge', 'sandbox_run', 'video_reviewer', 'graphic_reviewer', 'code_scraper', 'web_scraper', 'human_only']
  ),
  weight integer not null default 0 check (weight between 0 and 100),
  -- Blocks are optional for entrants, so each criterion says what happens when its inputs are empty.
  if_missing text not null default 'judge' check (if_missing in ('judge', 'zero')),
  -- A failed gate makes the project ineligible, whatever its other scores.
  gate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index criteria_hackathon_id_position_idx on public.criteria (hackathon_id, position);

create trigger criteria_set_updated_at
before update on public.criteria
for each row execute function public.set_updated_at();

-- Which schema blocks a criterion reads. No rows means "all inputs".
create table public.criterion_inputs (
  criterion_id uuid not null references public.criteria (id) on delete cascade,
  block_id uuid not null references public.schema_blocks (id) on delete cascade,
  primary key (criterion_id, block_id)
);

create index criterion_inputs_block_id_idx on public.criterion_inputs (block_id);

-- Row level security: only the hackathon's owner can see or change its criteria.
alter table public.criteria enable row level security;
alter table public.criterion_inputs enable row level security;

create policy "Owners can read their criteria"
on public.criteria for select
to authenticated
using (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
));

create policy "Owners can create criteria"
on public.criteria for insert
to authenticated
with check (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
));

create policy "Owners can update their criteria"
on public.criteria for update
to authenticated
using (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
));

create policy "Owners can delete their criteria"
on public.criteria for delete
to authenticated
using (exists (
  select 1 from public.hackathons h
  where h.id = hackathon_id and h.owner_id = (select auth.uid())
));

-- Inputs follow their criterion; the block must belong to the same hackathon.
create policy "Owners can read their criterion inputs"
on public.criterion_inputs for select
to authenticated
using (exists (
  select 1 from public.criteria c
  join public.hackathons h on h.id = c.hackathon_id
  where c.id = criterion_id and h.owner_id = (select auth.uid())
));

create policy "Owners can create criterion inputs"
on public.criterion_inputs for insert
to authenticated
with check (exists (
  select 1 from public.criteria c
  join public.hackathons h on h.id = c.hackathon_id
  join public.schema_blocks b on b.id = block_id and b.hackathon_id = c.hackathon_id
  where c.id = criterion_id and h.owner_id = (select auth.uid())
));

create policy "Owners can delete criterion inputs"
on public.criterion_inputs for delete
to authenticated
using (exists (
  select 1 from public.criteria c
  join public.hackathons h on h.id = c.hackathon_id
  where c.id = criterion_id and h.owner_id = (select auth.uid())
));

grant select, insert, update, delete on public.criteria to authenticated;
grant select, insert, delete on public.criterion_inputs to authenticated;

-- Replace a hackathon's whole rubric in one transaction: criteria missing from
-- p_criteria are deleted, the rest are upserted in array order, and each
-- criterion's inputs are replaced with its "inputs" array of block ids. Runs as
-- the caller, so the policies above decide what it can touch.
create function public.save_criteria(p_hackathon_id uuid, p_criteria jsonb)
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
    (id, hackathon_id, position, title, scale, description, mechanisms, weight, if_missing, gate)
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
    coalesce((c.value ->> 'gate')::boolean, false)
  from jsonb_array_elements(p_criteria) with ordinality as c (value, ordinality)
  on conflict (id) do update set
    position = excluded.position,
    title = excluded.title,
    scale = excluded.scale,
    description = excluded.description,
    mechanisms = excluded.mechanisms,
    weight = excluded.weight,
    if_missing = excluded.if_missing,
    gate = excluded.gate
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

revoke execute on function public.save_criteria(uuid, jsonb) from public, anon;
grant execute on function public.save_criteria(uuid, jsonb) to authenticated;

-- Every hackathon starts with a balanced four-part rubric, wired to the
-- default schema blocks where they exist.
create function public.seed_criteria(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.criteria (hackathon_id, position, title, scale, description, mechanisms, weight, if_missing)
  values
    (p_hackathon_id, 0, 'Technical execution', 'score', 'Code runs, is structured, and does what the demo claims.', '{sandbox_run,agent_judge}', 30, 'zero'),
    (p_hackathon_id, 1, 'Video: problem & solution', 'score', 'Video clearly states the problem and shows the working solution within 3 minutes.', '{video_reviewer}', 25, 'zero'),
    (p_hackathon_id, 2, 'Impact', 'score', 'Solves a real problem for a clear audience, and could keep going after the event.', '{agent_judge}', 25, 'judge'),
    (p_hackathon_id, 3, 'Originality & design', 'score', 'Novel idea, thoughtful UX.', '{graphic_reviewer,agent_judge}', 20, 'judge');

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

-- Runs as the caller from the hackathon insert trigger, so creators need execute;
-- RLS still limits it to hackathons they own.
revoke execute on function public.seed_criteria(uuid) from public, anon;
grant execute on function public.seed_criteria(uuid) to authenticated;

create function public.seed_hackathon_criteria()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.seed_criteria(new.id);
  return new;
end;
$$;

-- Triggers on the same event fire in name order; number them so the schema
-- blocks exist before criteria link to them.
alter trigger hackathons_seed_schema_blocks on public.hackathons rename to hackathons_seed_1_schema_blocks;

create trigger hackathons_seed_2_criteria
after insert on public.hackathons
for each row execute function public.seed_hackathon_criteria();

-- Backfill hackathons created before this table existed.
select public.seed_criteria(id) from public.hackathons;

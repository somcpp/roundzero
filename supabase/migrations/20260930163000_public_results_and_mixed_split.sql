-- The public winners page, and a fairer "mixed" split of judging work.
--
-- /w/<slug> is read by visitors without an account, but RLS keeps projects,
-- rewards and awards private to the hackathon's owner. public_results()
-- returns only what that page shows, once results are published (and to the
-- owner before that, as a preview). Judges' scores, notes and redeemable
-- reward details (codes, links) stay private.
--
-- start_judging_phase's mixed strategy shifted the pool once per project, so a
-- run of projects could land on the same few judges (loads like 8/5/4/7 where
-- 6/6/6/6 was possible). It now rotates the pool once per lap of slots: every
-- judge still gets one slot per lap, so loads differ by at most one, and each
-- lap pairs judges differently.

-- ── Mixed split ───────────────────────────────────────────────────────────

create or replace function public.start_judging_phase(p_hackathon_id uuid, p_phase_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phase public.judging_phases;
  v_mixed boolean;
  v_pool integer;
  v_per integer;
  v_made integer;
begin
  select * into v_phase from public.judging_phases where id = p_phase_id and hackathon_id = p_hackathon_id;
  if not found then
    raise exception 'Phase not found' using errcode = 'P0002';
  end if;

  update public.judging_phases set started_at = now(), closed_at = null where id = p_phase_id;

  select coalesce((select strategy = 'mixed' from public.distribution_settings where hackathon_id = p_hackathon_id), false)
  into v_mixed;

  select count(*) into v_pool
  from public.judges j
  where j.hackathon_id = p_hackathon_id
    and (v_phase.judge_group_id is null or exists (
      select 1 from public.judge_group_members m where m.group_id = v_phase.judge_group_id and m.judge_id = j.id
    ));
  if v_pool = 0 then
    return 0;
  end if;
  v_per := least(coalesce(v_phase.reviews_per_project, v_pool), v_pool);

  -- Slot s is review k of project i: s = i × per + k. Even: slot s goes to
  -- judge s mod pool. Mixed: lap s / pool is rotated that many places, so no
  -- project gets a judge twice (per ≤ pool) and loads stay even.
  with pool as (
    select j.id, (row_number() over (order by j.name, j.id) - 1)::integer as idx
    from public.judges j
    where j.hackathon_id = p_hackathon_id
      and (v_phase.judge_group_id is null or exists (
        select 1 from public.judge_group_members m where m.group_id = v_phase.judge_group_id and m.judge_id = j.id
      ))
  ), items as (
    select p.id, (row_number() over (order by p.number) - 1)::integer as idx
    from public.projects p
    where p.phase_id = p_phase_id and p.status = 'active'
  ), slots as (
    select i.id as project_id, i.idx * v_per + k as s
    from items i
    cross join generate_series(0, v_per - 1) k
  ), inserted as (
    insert into public.judge_assignments (phase_id, project_id, judge_id)
    select p_phase_id, sl.project_id, pool.id
    from slots sl
    join pool on pool.idx = (sl.s + case when v_mixed then sl.s / v_pool else 0 end) % v_pool
    on conflict (phase_id, project_id, judge_id) do nothing
    returning 1
  )
  select count(*) into v_made from inserted;
  return v_made;
end;
$$;

-- ── Public results ────────────────────────────────────────────────────────

-- Everything the winners page needs, as one JSON object, or null when the
-- hackathon doesn't exist or isn't published (and the caller isn't its owner).
-- Only ranked finalists and award winners are included, disqualified ones
-- left out, and of each project only its name, pitch, links, team and images.
create function public.public_results(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with h as (
    select * from public.hackathons
    where slug = p_slug and (published or owner_id = (select auth.uid()))
  ),
  -- The name is the first text block and the pitch the next text or long text
  -- block, as lib/project-fields.ts projectHeadline() picks them.
  texts as (
    select b.id, b.type, b.position
    from public.schema_blocks b
    join h on h.id = b.hackathon_id
    where b.type in ('text', 'long text')
  ),
  name_block as (
    select id from texts where type = 'text' order by position limit 1
  ),
  pitch_block as (
    select id from texts where id is distinct from (select id from name_block) order by position limit 1
  ),
  blocks as (
    select b.id, b.title, b.type, b.position,
      case when b.id = (select id from name_block) then 'name'
           when b.id = (select id from pitch_block) then 'pitch' end as role
    from public.schema_blocks b
    join h on h.id = b.hackathon_id
    where b.id in (select id from name_block union all select id from pitch_block)
       or b.type in ('url', 'video url', 'repo url', 'team', 'image')
  ),
  shown as (
    select p.id, p.number, p.final_rank
    from public.projects p
    join h on h.id = p.hackathon_id
    where p.status <> 'disqualified'
      and (p.final_rank is not null or exists (
        select 1 from public.award_winners w where w.project_id = p.id
      ))
  )
  select jsonb_build_object(
    'hackathon', jsonb_build_object(
      'slug', h.slug, 'name', h.name, 'tagline', h.tagline,
      'starts_on', h.starts_on, 'ends_on', h.ends_on, 'stage', h.stage,
      'color', h.color, 'logo', h.logo, 'logo_path', h.logo_path, 'published', h.published
    ),
    'counts', jsonb_build_object(
      'projects', (select count(*) from public.projects p where p.hackathon_id = h.id),
      'judges', (select count(*) from public.judges j where j.hackathon_id = h.id)
    ),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'type', b.type, 'role', b.role) order by b.position)
      from blocks b
    ), '[]'),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'number', s.number,
        'final_rank', s.final_rank,
        'values', coalesce((
          select jsonb_object_agg(v.block_id, v.value)
          from public.project_values v
          where v.project_id = s.id and v.block_id in (select id from blocks)
        ), '{}')
      ) order by s.final_rank nulls last, s.number)
      from shown s
    ), '[]'),
    'tiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'description', t.description, 'recipients', t.recipients,
        'rank_from', t.rank_from, 'rank_to', t.rank_to, 'image_path', t.image_path,
        -- Labels only: a code or link in `detail` is for the winner's email.
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('kind', i.kind, 'label', i.label) order by i.position)
          from public.reward_items i
          where i.tier_id = t.id
        ), '[]')
      ) order by t.position)
      from public.reward_tiers t
      where t.hackathon_id = h.id
    ), '[]'),
    'awards', coalesce((
      select jsonb_agg(jsonb_build_object('tier_id', w.tier_id, 'project_id', w.project_id) order by t.position, w.position)
      from public.award_winners w
      join public.reward_tiers t on t.id = w.tier_id
      where t.hackathon_id = h.id and w.project_id in (select id from shown)
    ), '[]')
  )
  from h;
$$;

revoke execute on function public.public_results(text) from public;
grant execute on function public.public_results(text) to anon, authenticated;

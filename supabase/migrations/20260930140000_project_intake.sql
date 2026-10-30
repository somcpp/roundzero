-- Project intake: projects created from outside the admin UI, through the
-- Next.js endpoint at /api/intake. Two ways in, one per hackathon, each
-- switched on from Judging › Projects:
--
--   • API: a secret key (only its sha256 is stored) for scripts and agents
--     importing a spreadsheet or another tool's export.
--   • Submission form: a public page at /f/<token> that entrants fill in.
--
-- Callers are anonymous, so the endpoint talks to the database with the
-- server-only secret key (service_role). The functions below are the only way
-- in: they check the credential, rate-limit, and write projects in one
-- transaction. Nothing here is callable with the public key.

-- ── Settings ──────────────────────────────────────────────────────────────
-- One row per hackathon; no row means both are off.

create table public.intake_settings (
  hackathon_id uuid primary key references public.hackathons (id) on delete cascade,
  api_enabled boolean not null default false,
  -- sha256 of the key, hex. The key itself is shown once, when it's made.
  api_key_hash text unique check (api_key_hash ~ '^[0-9a-f]{64}$'),
  -- Last few characters, so the admin can tell which key is live.
  api_key_hint text check (char_length(api_key_hint) <= 8),
  api_key_created_at timestamptz,
  form_enabled boolean not null default false,
  -- Public: it's the /f/<token> URL. Regenerating it retires the old link.
  form_token text unique check (form_token ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not api_enabled or api_key_hash is not null),
  check (not form_enabled or form_token is not null)
);

create trigger intake_settings_set_updated_at
before update on public.intake_settings
for each row execute function public.set_updated_at();

alter table public.intake_settings enable row level security;

create policy "Owners can read their intake settings" on public.intake_settings for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create their intake settings" on public.intake_settings for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their intake settings" on public.intake_settings for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));

grant select, insert, update on public.intake_settings to authenticated;

-- ── Rate limits ───────────────────────────────────────────────────────────
-- Fixed-window counters, e.g. bucket 'ip:203.0.113.7' in the minute starting
-- 12:04. No grants or policies: only intake_rate_limit() below touches it.

create table public.intake_rate_limits (
  bucket text not null check (char_length(bucket) <= 200),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

create index intake_rate_limits_window_start_idx on public.intake_rate_limits (window_start);

alter table public.intake_rate_limits enable row level security;
-- Undo Supabase's default table grants, so it isn't even listed to clients.
revoke all on public.intake_rate_limits from anon, authenticated;

-- Count one hit against each limit in p_limits, an array of
-- {bucket, limit, seconds}. Returns the first bucket that's over its limit,
-- or null when the request may go ahead.
create function public.intake_rate_limit(p_limits jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l jsonb;
  v_seconds integer;
  v_hits integer;
begin
  for l in select value from jsonb_array_elements(p_limits) loop
    v_seconds := greatest((l ->> 'seconds')::integer, 1);
    insert into public.intake_rate_limits as r (bucket, window_start, hits)
    values (
      l ->> 'bucket',
      to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds),
      1
    )
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning hits into v_hits;

    if v_hits > (l ->> 'limit')::integer then
      return l ->> 'bucket';
    end if;
  end loop;

  -- Now and then, sweep windows nobody will look at again.
  if random() < 0.02 then
    delete from public.intake_rate_limits where window_start < now() - interval '1 day';
  end if;
  return null;
end;
$$;

-- ── Lookup ────────────────────────────────────────────────────────────────

-- The hackathon a credential opens, if that way in is switched on.
-- p_kind 'api' takes the key's sha256 hex; 'form' takes the form token.
create function public.intake_hackathon_id(p_kind text, p_credential text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.hackathon_id
  from public.intake_settings s
  where (p_kind = 'api' and s.api_enabled and s.api_key_hash = p_credential)
     or (p_kind = 'form' and s.form_enabled and s.form_token = p_credential);
$$;

-- What the endpoint and the public form need: the hackathon's public face and
-- its project schema in form order. Null when the credential doesn't open
-- anything.
create function public.intake_target(p_kind text, p_credential text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'hackathon', jsonb_build_object(
      'id', h.id, 'slug', h.slug, 'name', h.name, 'tagline', h.tagline,
      'color', h.color, 'logo', h.logo, 'logo_path', h.logo_path, 'stage', h.stage
    ),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'title', b.title, 'type', b.type, 'description', b.description, 'expected', b.expected
      ) order by b.position)
      from public.schema_blocks b
      where b.hackathon_id = h.id
    ), '[]')
  )
  from public.hackathons h
  where h.id = public.intake_hackathon_id(p_kind, p_credential);
$$;

-- ── Submit ────────────────────────────────────────────────────────────────

-- Create projects, in order, each with its values ({block id: value}; blocks
-- from elsewhere are skipped) and a 'submitted' entry in its trail saying
-- which way it came in. All or nothing. Returns [{id, number}].
create function public.intake_submit(p_kind text, p_credential text, p_projects jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hackathon_id uuid := public.intake_hackathon_id(p_kind, p_credential);
  v_project jsonb;
  v_id uuid;
  v_number integer;
  v_created jsonb := '[]';
begin
  if v_hackathon_id is null then
    raise exception 'Intake is switched off, or the credential is wrong' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_projects) <> 'array' or jsonb_array_length(p_projects) not between 1 and 100 then
    raise exception 'Send 1–100 projects at a time' using errcode = '22023';
  end if;

  -- One intake at a time per hackathon, so numbers come out in order without
  -- colliding. (An admin adding one by hand at the same instant can still
  -- collide; the unique constraint catches it and the caller retries.)
  perform pg_advisory_xact_lock(hashtextextended('intake:' || v_hackathon_id::text, 0));
  select coalesce(max(number), 0) into v_number from public.projects where hackathon_id = v_hackathon_id;

  for v_project in select value from jsonb_array_elements(p_projects) loop
    v_id := gen_random_uuid();
    v_number := v_number + 1;
    insert into public.projects (id, hackathon_id, number) values (v_id, v_hackathon_id, v_number);

    insert into public.project_values (project_id, block_id, value)
    select v_id, b.id, v.value
    from jsonb_each(coalesce(v_project -> 'values', '{}')) v (block_id, value)
    join public.schema_blocks b on b.id::text = v.block_id and b.hackathon_id = v_hackathon_id;

    insert into public.project_events (project_id, kind, actor_kind, actor_id, actor_name, data)
    values (
      v_id, 'submitted', 'system', null,
      case p_kind when 'api' then 'API' else 'Submission form' end,
      jsonb_build_object('via', p_kind)
    );

    v_created := v_created || jsonb_build_object('id', v_id, 'number', v_number);
  end loop;

  return v_created;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────
-- Server-side only: the Next.js endpoint calls these with the secret key.

revoke execute on function public.intake_rate_limit(jsonb) from public, anon, authenticated;
revoke execute on function public.intake_hackathon_id(text, text) from public, anon, authenticated;
revoke execute on function public.intake_target(text, text) from public, anon, authenticated;
revoke execute on function public.intake_submit(text, text, jsonb) from public, anon, authenticated;

grant execute on function public.intake_rate_limit(jsonb) to service_role;
grant execute on function public.intake_target(text, text) to service_role;
grant execute on function public.intake_submit(text, text, jsonb) to service_role;

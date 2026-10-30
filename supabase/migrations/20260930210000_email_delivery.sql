-- Email delivery for judging (src/workflows/*, src/lib/email/*):
--   • projects.contact_email: the team's address, a fixed intake field. Winner
--     and thank-you emails go here.
--   • hackathons.notify_email: where owner notifications go ("phase done",
--     "phase due"). Blank sends them to the owner's account email.
--   • email_sends: one row per email, unique per dedupe key, so a retried step
--     or a double click never sends twice, and the app can show what went out.
--   • email_runs: the durable workflow runs sending them, so resetting judging
--     can cancel what's still waiting.
-- Plus intake_submit and save_project learn contact_email.

-- ── Addresses ─────────────────────────────────────────────────────────────

alter table public.projects add column contact_email text not null default '' check (
  char_length(contact_email) <= 254 and (contact_email = '' or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

alter table public.hackathons add column notify_email text not null default '' check (
  char_length(notify_email) <= 254 and (notify_email = '' or notify_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ── Sent emails ───────────────────────────────────────────────────────────

create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  kind text not null check (kind in (
    'judge_invite', 'judge_batch', 'judge_last_call',
    'owner_phase_done', 'owner_phase_due',
    'winner', 'thank_you'
  )),
  -- e.g. "judge_invite:<phase>:<phase start>:<judge>".
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 256),
  phase_id uuid references public.judging_phases (id) on delete set null,
  judge_id uuid references public.judges (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  to_email text not null check (char_length(to_email) <= 254),
  subject text not null default '' check (char_length(subject) <= 300),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  -- Goes up each time a failed send is tried again. Part of Resend's
  -- idempotency key, so a crash mid-send never sends twice but a retry can.
  attempts smallint not null default 0 check (attempts between 0 and 1000),
  -- Resend's email id once accepted.
  provider_id text check (char_length(provider_id) <= 100),
  error text check (char_length(error) <= 2000),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (hackathon_id, dedupe_key)
);

create index email_sends_hackathon_id_kind_idx on public.email_sends (hackathon_id, kind);
create index email_sends_phase_id_idx on public.email_sends (phase_id) where phase_id is not null;
create index email_sends_judge_id_idx on public.email_sends (judge_id) where judge_id is not null;
create index email_sends_project_id_idx on public.email_sends (project_id) where project_id is not null;

-- ── Workflow runs ─────────────────────────────────────────────────────────

create table public.email_runs (
  run_id text primary key check (char_length(run_id) <= 200),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  kind text not null check (kind in ('phase', 'winners', 'thank_you')),
  phase_id uuid references public.judging_phases (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index email_runs_hackathon_id_idx on public.email_runs (hackathon_id);
create index email_runs_phase_id_idx on public.email_runs (phase_id) where phase_id is not null;

-- Row level security: owners can read what was sent. Only the server (secret
-- key) writes, from workflow steps and after checking ownership.
alter table public.email_sends enable row level security;
alter table public.email_runs enable row level security;

create policy "Owners can read their email sends" on public.email_sends for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can read their email runs" on public.email_runs for select to authenticated
using (public.owns_hackathon(hackathon_id));

grant select on public.email_sends, public.email_runs to authenticated;

-- ── Intake: contact_email on each project ─────────────────────────────────

-- Same as before (supabase/migrations/*_project_intake.sql), plus each
-- project's optional "contact_email".
create or replace function public.intake_submit(p_kind text, p_credential text, p_projects jsonb)
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
    insert into public.projects (id, hackathon_id, number, contact_email)
    values (v_id, v_hackathon_id, v_number, lower(btrim(coalesce(v_project ->> 'contact_email', ''))));

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

-- ── Admin edits: contact_email on save_project ────────────────────────────

-- Same as before (supabase/migrations/*_create_judging.sql), plus
-- p_project.contact_email. Left out, the address stays as it is.
create or replace function public.save_project(p_hackathon_id uuid, p_project jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_project ->> 'id')::uuid;
  v_values jsonb := coalesce(p_project -> 'values', '{}');
  v_email text := lower(btrim(p_project ->> 'contact_email'));
  v_old_email text;
  v_number integer;
  v_changed text[];
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  select number, contact_email into v_number, v_old_email
  from public.projects where id = v_id and hackathon_id = p_hackathon_id;

  if v_number is null then
    if exists (select 1 from public.projects where id = v_id) then
      raise exception 'Project not found' using errcode = 'P0002';
    end if;
    select coalesce(max(number), 0) + 1 into v_number from public.projects where hackathon_id = p_hackathon_id;
    insert into public.projects (id, hackathon_id, number, contact_email)
    values (v_id, p_hackathon_id, v_number, coalesce(v_email, ''));
    insert into public.project_events (project_id, kind) values (v_id, 'submitted');
  else
    select coalesce(array_agg(b.title order by b.position), '{}') into v_changed
    from public.schema_blocks b
    left join public.project_values o on o.project_id = v_id and o.block_id = b.id
    where b.hackathon_id = p_hackathon_id
      and o.value is distinct from v_values -> b.id::text;

    if v_email is not null and v_email <> v_old_email then
      v_changed := v_changed || 'Contact email';
      update public.projects set contact_email = v_email where id = v_id;
    end if;

    if cardinality(v_changed) = 0 then
      return v_number;
    end if;
    insert into public.project_events (project_id, kind, data)
    values (v_id, 'edited', jsonb_build_object('fields', to_jsonb(v_changed)));
    update public.projects set updated_at = now() where id = v_id;
  end if;

  delete from public.project_values where project_id = v_id;
  insert into public.project_values (project_id, block_id, value)
  select v_id, b.id, v.value
  from jsonb_each(v_values) v (block_id, value)
  join public.schema_blocks b on b.id::text = v.block_id and b.hackathon_id = p_hackathon_id;

  return v_number;
end;
$$;

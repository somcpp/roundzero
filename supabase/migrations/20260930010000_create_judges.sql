-- Judges for a hackathon, plus reusable custom fields (e.g. "Company" with
-- options "Anthropic", "OpenAI"…) to filter and group them by, and saved
-- groups. Edited from Setup › Judges. Photos live in the judge-images bucket.

-- True when the signed-in user owns the hackathon. Runs as the caller, so it
-- only ever sees hackathons RLS already lets them read.
create function public.owns_hackathon(p_hackathon_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.hackathons h
    where h.id = p_hackathon_id and h.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_hackathon(uuid) from public, anon;
grant execute on function public.owns_hackathon(uuid) to authenticated;

-- ── Judges ────────────────────────────────────────────────────────────────

create table public.judges (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  title text not null default '' check (char_length(title) <= 160),
  -- Optional until invites go out; '' means not set.
  email text not null default '' check (
    char_length(email) <= 254 and (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  -- Object path in the judge-images bucket: <hackathon_id>/<judge_id>/<file>.
  image_path text check (char_length(image_path) <= 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index judges_hackathon_id_idx on public.judges (hackathon_id);
-- One judge per email within a hackathon.
create unique index judges_hackathon_id_email_key on public.judges (hackathon_id, lower(email)) where email <> '';

create trigger judges_set_updated_at
before update on public.judges
for each row execute function public.set_updated_at();

-- ── Custom fields ─────────────────────────────────────────────────────────

create table public.judge_fields (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  -- 0-based order in the editor and filter bar.
  position integer not null check (position >= 0),
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index judge_fields_hackathon_id_position_idx on public.judge_fields (hackathon_id, position);

create trigger judge_fields_set_updated_at
before update on public.judge_fields
for each row execute function public.set_updated_at();

create table public.judge_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.judge_fields (id) on delete cascade,
  position integer not null check (position >= 0),
  label text not null check (char_length(label) between 1 and 80),
  -- Lets judge_field_values check an option belongs to its field.
  unique (field_id, id)
);

create index judge_field_options_field_id_position_idx on public.judge_field_options (field_id, position);

-- A judge's value for a field: one option per field.
create table public.judge_field_values (
  judge_id uuid not null references public.judges (id) on delete cascade,
  field_id uuid not null references public.judge_fields (id) on delete cascade,
  option_id uuid not null,
  primary key (judge_id, field_id),
  foreign key (field_id, option_id) references public.judge_field_options (field_id, id) on delete cascade
);

create index judge_field_values_field_id_option_id_idx on public.judge_field_values (field_id, option_id);

-- ── Groups ────────────────────────────────────────────────────────────────

create table public.judge_groups (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index judge_groups_hackathon_id_idx on public.judge_groups (hackathon_id);

create trigger judge_groups_set_updated_at
before update on public.judge_groups
for each row execute function public.set_updated_at();

create table public.judge_group_members (
  group_id uuid not null references public.judge_groups (id) on delete cascade,
  judge_id uuid not null references public.judges (id) on delete cascade,
  primary key (group_id, judge_id)
);

create index judge_group_members_judge_id_idx on public.judge_group_members (judge_id);

-- ── Row level security: only the hackathon's owner can see or change these ─

alter table public.judges enable row level security;
alter table public.judge_fields enable row level security;
alter table public.judge_field_options enable row level security;
alter table public.judge_field_values enable row level security;
alter table public.judge_groups enable row level security;
alter table public.judge_group_members enable row level security;

create policy "Owners can read their judges" on public.judges for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create judges" on public.judges for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their judges" on public.judges for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can delete their judges" on public.judges for delete to authenticated
using (public.owns_hackathon(hackathon_id));

create policy "Owners can read their judge fields" on public.judge_fields for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create judge fields" on public.judge_fields for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their judge fields" on public.judge_fields for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can delete their judge fields" on public.judge_fields for delete to authenticated
using (public.owns_hackathon(hackathon_id));

-- Options follow their field.
create policy "Owners can read their judge field options" on public.judge_field_options for select to authenticated
using (exists (select 1 from public.judge_fields f where f.id = field_id and public.owns_hackathon(f.hackathon_id)));
create policy "Owners can create judge field options" on public.judge_field_options for insert to authenticated
with check (exists (select 1 from public.judge_fields f where f.id = field_id and public.owns_hackathon(f.hackathon_id)));
create policy "Owners can update their judge field options" on public.judge_field_options for update to authenticated
using (exists (select 1 from public.judge_fields f where f.id = field_id and public.owns_hackathon(f.hackathon_id)))
with check (exists (select 1 from public.judge_fields f where f.id = field_id and public.owns_hackathon(f.hackathon_id)));
create policy "Owners can delete their judge field options" on public.judge_field_options for delete to authenticated
using (exists (select 1 from public.judge_fields f where f.id = field_id and public.owns_hackathon(f.hackathon_id)));

-- Values follow their judge; the field must belong to the same hackathon.
create policy "Owners can read their judge field values" on public.judge_field_values for select to authenticated
using (exists (select 1 from public.judges j where j.id = judge_id and public.owns_hackathon(j.hackathon_id)));
create policy "Owners can create judge field values" on public.judge_field_values for insert to authenticated
with check (exists (
  select 1 from public.judges j
  join public.judge_fields f on f.id = field_id and f.hackathon_id = j.hackathon_id
  where j.id = judge_id and public.owns_hackathon(j.hackathon_id)
));
create policy "Owners can delete their judge field values" on public.judge_field_values for delete to authenticated
using (exists (select 1 from public.judges j where j.id = judge_id and public.owns_hackathon(j.hackathon_id)));

create policy "Owners can read their judge groups" on public.judge_groups for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create judge groups" on public.judge_groups for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their judge groups" on public.judge_groups for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can delete their judge groups" on public.judge_groups for delete to authenticated
using (public.owns_hackathon(hackathon_id));

-- Members follow their group; the judge must belong to the same hackathon.
create policy "Owners can read their judge group members" on public.judge_group_members for select to authenticated
using (exists (select 1 from public.judge_groups g where g.id = group_id and public.owns_hackathon(g.hackathon_id)));
create policy "Owners can create judge group members" on public.judge_group_members for insert to authenticated
with check (exists (
  select 1 from public.judge_groups g
  join public.judges j on j.id = judge_id and j.hackathon_id = g.hackathon_id
  where g.id = group_id and public.owns_hackathon(g.hackathon_id)
));
create policy "Owners can delete their judge group members" on public.judge_group_members for delete to authenticated
using (exists (select 1 from public.judge_groups g where g.id = group_id and public.owns_hackathon(g.hackathon_id)));

grant select, insert, update, delete on public.judges to authenticated;
grant select, insert, update, delete on public.judge_fields to authenticated;
grant select, insert, update, delete on public.judge_field_options to authenticated;
grant select, insert, delete on public.judge_field_values to authenticated;
grant select, insert, update, delete on public.judge_groups to authenticated;
grant select, insert, delete on public.judge_group_members to authenticated;

-- ── Writes that touch several tables, one transaction each ────────────────
-- All run as the caller, so the policies above decide what they can touch.

-- Create or update one judge, replacing their field values ("values": an
-- object of field id → option id) and group memberships ("groups": group ids).
create function public.save_judge(p_hackathon_id uuid, p_judge jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_judge ->> 'id')::uuid;
begin
  insert into public.judges as t (id, hackathon_id, name, title, email, image_path)
  values (
    v_id,
    p_hackathon_id,
    p_judge ->> 'name',
    coalesce(p_judge ->> 'title', ''),
    coalesce(p_judge ->> 'email', ''),
    nullif(p_judge ->> 'image_path', '')
  )
  on conflict (id) do update set
    name = excluded.name,
    title = excluded.title,
    email = excluded.email,
    image_path = excluded.image_path
  -- An id from another hackathon is left alone rather than moved.
  where t.hackathon_id = excluded.hackathon_id;

  if not exists (select 1 from public.judges where id = v_id and hackathon_id = p_hackathon_id) then
    raise exception 'Judge not found' using errcode = 'P0002';
  end if;

  delete from public.judge_field_values where judge_id = v_id;
  insert into public.judge_field_values (judge_id, field_id, option_id)
  select v_id, f.id, o.id
  from jsonb_each_text(coalesce(p_judge -> 'values', '{}')) v (field_id, option_id)
  -- Skip fields and options deleted since the editor loaded.
  join public.judge_fields f on f.id = v.field_id::uuid and f.hackathon_id = p_hackathon_id
  join public.judge_field_options o on o.id = v.option_id::uuid and o.field_id = f.id;

  delete from public.judge_group_members where judge_id = v_id;
  insert into public.judge_group_members (group_id, judge_id)
  select distinct g.id, v_id
  from jsonb_array_elements_text(coalesce(p_judge -> 'groups', '[]')) x (group_id)
  join public.judge_groups g on g.id = x.group_id::uuid and g.hackathon_id = p_hackathon_id;
end;
$$;

revoke execute on function public.save_judge(uuid, jsonb) from public, anon;
grant execute on function public.save_judge(uuid, jsonb) to authenticated;

-- Replace a hackathon's custom fields with p_fields, in order. Each field has
-- an "options" array of {id, label}; fields and options missing from the
-- list are deleted, and judges' values for them go with them.
create function public.save_judge_fields(p_hackathon_id uuid, p_fields jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  delete from public.judge_fields
  where hackathon_id = p_hackathon_id
    and id not in (select (f ->> 'id')::uuid from jsonb_array_elements(p_fields) f);

  insert into public.judge_fields as t (id, hackathon_id, position, name)
  select (f.value ->> 'id')::uuid, p_hackathon_id, (f.ordinality - 1)::integer, f.value ->> 'name'
  from jsonb_array_elements(p_fields) with ordinality as f (value, ordinality)
  on conflict (id) do update set
    position = excluded.position,
    name = excluded.name
  where t.hackathon_id = excluded.hackathon_id;

  delete from public.judge_field_options o
  using public.judge_fields f
  where f.id = o.field_id
    and f.hackathon_id = p_hackathon_id
    and o.id not in (
      select (opt ->> 'id')::uuid
      from jsonb_array_elements(p_fields) x (field)
      cross join lateral jsonb_array_elements(coalesce(x.field -> 'options', '[]')) opt
    );

  insert into public.judge_field_options as t (id, field_id, position, label)
  select (o.value ->> 'id')::uuid, f.id, (o.ordinality - 1)::integer, o.value ->> 'label'
  from jsonb_array_elements(p_fields) x (field)
  join public.judge_fields f on f.id = (x.field ->> 'id')::uuid and f.hackathon_id = p_hackathon_id
  cross join lateral jsonb_array_elements(coalesce(x.field -> 'options', '[]')) with ordinality as o (value, ordinality)
  on conflict (id) do update set
    position = excluded.position,
    label = excluded.label
  -- An option can't move to another field.
  where t.field_id = excluded.field_id;
end;
$$;

revoke execute on function public.save_judge_fields(uuid, jsonb) from public, anon;
grant execute on function public.save_judge_fields(uuid, jsonb) to authenticated;

-- Create or update one saved group and replace its members ("members": judge ids).
create function public.save_judge_group(p_hackathon_id uuid, p_group jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_group ->> 'id')::uuid;
begin
  insert into public.judge_groups as t (id, hackathon_id, name)
  values (v_id, p_hackathon_id, p_group ->> 'name')
  on conflict (id) do update set name = excluded.name
  where t.hackathon_id = excluded.hackathon_id;

  if not exists (select 1 from public.judge_groups where id = v_id and hackathon_id = p_hackathon_id) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;

  delete from public.judge_group_members where group_id = v_id;
  insert into public.judge_group_members (group_id, judge_id)
  select distinct v_id, j.id
  from jsonb_array_elements_text(coalesce(p_group -> 'members', '[]')) x (judge_id)
  join public.judges j on j.id = x.judge_id::uuid and j.hackathon_id = p_hackathon_id;
end;
$$;

revoke execute on function public.save_judge_group(uuid, jsonb) from public, anon;
grant execute on function public.save_judge_group(uuid, jsonb) to authenticated;

-- ── Photos ────────────────────────────────────────────────────────────────
-- Public bucket: judge photos show on judge links and winners pages, and
-- paths are unguessable ids. Only the hackathon's owner can write to its
-- folder (the first path segment is the hackathon id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('judge-images', 'judge-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Owners can read their judge images" on storage.objects for select to authenticated
using (bucket_id = 'judge-images' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
));

create policy "Owners can upload judge images" on storage.objects for insert to authenticated
with check (bucket_id = 'judge-images' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
));

create policy "Owners can update their judge images" on storage.objects for update to authenticated
using (bucket_id = 'judge-images' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
))
with check (bucket_id = 'judge-images' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
));

create policy "Owners can delete their judge images" on storage.objects for delete to authenticated
using (bucket_id = 'judge-images' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
));

-- Banner images for hackathons, set from Setup › Branding. A banner replaces
-- the pixel-art cover on the hackathon's card, winners page and submission
-- form; with none (null) the pixel cover shows as before.

alter table public.hackathons
  -- Object path in the hackathon-banners bucket: <hackathon_id>/<file>. Must
  -- sit in this hackathon's own folder, so one can't point at another's banner.
  add column banner_path text check (
    char_length(banner_path) <= 512 and banner_path like id::text || '/%'
  );

-- ── Storage ───────────────────────────────────────────────────────────────
-- Public bucket, like hackathon-logos: banners show on the winners page and
-- the public submission form, and paths are unguessable ids. Only the
-- hackathon's owner can write to its folder (the first path segment is the
-- hackathon id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hackathon-banners', 'hackathon-banners', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Owners can read their hackathon banners" on storage.objects for select to authenticated
using (bucket_id = 'hackathon-banners' and public.owns_hackathon_folder(objects.name));
create policy "Owners can upload hackathon banners" on storage.objects for insert to authenticated
with check (bucket_id = 'hackathon-banners' and public.owns_hackathon_folder(objects.name));
create policy "Owners can update their hackathon banners" on storage.objects for update to authenticated
using (bucket_id = 'hackathon-banners' and public.owns_hackathon_folder(objects.name))
with check (bucket_id = 'hackathon-banners' and public.owns_hackathon_folder(objects.name));
create policy "Owners can delete their hackathon banners" on storage.objects for delete to authenticated
using (bucket_id = 'hackathon-banners' and public.owns_hackathon_folder(objects.name));

-- ── Submission form ───────────────────────────────────────────────────────
-- The public form (/f/[token]) loads the hackathon through intake_target(),
-- so it carries banner_path too. Otherwise as in *_project_intake.sql;
-- `create or replace` keeps its service_role-only grants.

create or replace function public.intake_target(p_kind text, p_credential text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'hackathon', jsonb_build_object(
      'id', h.id, 'slug', h.slug, 'name', h.name, 'tagline', h.tagline,
      'color', h.color, 'logo', h.logo, 'logo_path', h.logo_path,
      'banner_path', h.banner_path, 'stage', h.stage
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

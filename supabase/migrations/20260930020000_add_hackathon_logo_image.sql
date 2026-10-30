-- Uploaded logo images for hackathons, set from Setup › Branding. The image
-- lives in the hackathon-logos bucket; `logo` (initials) stays as the fallback.

alter table public.hackathons
  -- Object path in the hackathon-logos bucket: <hackathon_id>/<file>. Must sit
  -- in this hackathon's own folder, so one can't point at another's logo.
  add column logo_path text check (
    char_length(logo_path) <= 512 and logo_path like id::text || '/%'
  );

-- ── Storage ───────────────────────────────────────────────────────────────
-- Public bucket: logos show on judge links, the winners page and emails, and
-- paths are unguessable ids. Only the hackathon's owner can write to its
-- folder (the first path segment is the hackathon id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hackathon-logos', 'hackathon-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Owners can read their hackathon logos" on storage.objects for select to authenticated
using (bucket_id = 'hackathon-logos' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
));

create policy "Owners can upload hackathon logos" on storage.objects for insert to authenticated
with check (bucket_id = 'hackathon-logos' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
));

create policy "Owners can update their hackathon logos" on storage.objects for update to authenticated
using (bucket_id = 'hackathon-logos' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
))
with check (bucket_id = 'hackathon-logos' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
));

create policy "Owners can delete their hackathon logos" on storage.objects for delete to authenticated
using (bucket_id = 'hackathon-logos' and exists (
  select 1 from public.hackathons h
  where h.id::text = (storage.foldername(name))[1] and h.owner_id = (select auth.uid())
));

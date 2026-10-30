-- The judge-images and hackathon-logos policies referenced the object path as
-- a bare `name`, which inside `exists (select … from public.hackathons h …)`
-- resolves to hackathons.name, so no upload ever matched. Qualify it as
-- objects.name and route the check through one helper.

-- True when the signed-in user owns the hackathon whose id is the first
-- folder of a storage object path (<hackathon_id>/…).
create function public.owns_hackathon_folder(p_object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.hackathons h
    where h.id::text = (storage.foldername(p_object_name))[1] and h.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_hackathon_folder(text) from public, anon;
grant execute on function public.owns_hackathon_folder(text) to authenticated;

-- ── judge-images ──────────────────────────────────────────────────────────

drop policy "Owners can read their judge images" on storage.objects;
drop policy "Owners can upload judge images" on storage.objects;
drop policy "Owners can update their judge images" on storage.objects;
drop policy "Owners can delete their judge images" on storage.objects;

create policy "Owners can read their judge images" on storage.objects for select to authenticated
using (bucket_id = 'judge-images' and public.owns_hackathon_folder(objects.name));
create policy "Owners can upload judge images" on storage.objects for insert to authenticated
with check (bucket_id = 'judge-images' and public.owns_hackathon_folder(objects.name));
create policy "Owners can update their judge images" on storage.objects for update to authenticated
using (bucket_id = 'judge-images' and public.owns_hackathon_folder(objects.name))
with check (bucket_id = 'judge-images' and public.owns_hackathon_folder(objects.name));
create policy "Owners can delete their judge images" on storage.objects for delete to authenticated
using (bucket_id = 'judge-images' and public.owns_hackathon_folder(objects.name));

-- ── hackathon-logos ───────────────────────────────────────────────────────

drop policy "Owners can read their hackathon logos" on storage.objects;
drop policy "Owners can upload hackathon logos" on storage.objects;
drop policy "Owners can update their hackathon logos" on storage.objects;
drop policy "Owners can delete their hackathon logos" on storage.objects;

create policy "Owners can read their hackathon logos" on storage.objects for select to authenticated
using (bucket_id = 'hackathon-logos' and public.owns_hackathon_folder(objects.name));
create policy "Owners can upload hackathon logos" on storage.objects for insert to authenticated
with check (bucket_id = 'hackathon-logos' and public.owns_hackathon_folder(objects.name));
create policy "Owners can update their hackathon logos" on storage.objects for update to authenticated
using (bucket_id = 'hackathon-logos' and public.owns_hackathon_folder(objects.name))
with check (bucket_id = 'hackathon-logos' and public.owns_hackathon_folder(objects.name));
create policy "Owners can delete their hackathon logos" on storage.objects for delete to authenticated
using (bucket_id = 'hackathon-logos' and public.owns_hackathon_folder(objects.name));

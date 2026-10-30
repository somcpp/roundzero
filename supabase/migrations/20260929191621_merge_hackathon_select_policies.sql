-- One SELECT policy per role instead of two overlapping ones for
-- `authenticated`, so Postgres evaluates a single policy per row.

drop policy "Owners can read their hackathons" on public.hackathons;
drop policy "Anyone can read published hackathons" on public.hackathons;

create policy "Anyone can read published hackathons"
on public.hackathons for select
to anon
using (published);

create policy "Owners and viewers of published hackathons can read"
on public.hackathons for select
to authenticated
using (published or (select auth.uid()) = owner_id);

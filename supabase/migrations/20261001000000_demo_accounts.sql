-- Demo accounts: accounts with app_metadata.demo = true, which only the secret
-- key can set (scripts/seed-demo.mjs creates the shared demo login that the
-- sign-in page fills in when DEMO_MODE is on). A demo user can read the
-- hackathons flagged `demo`, and nothing else: every read policy below now
-- goes through can_view_hackathon(), while writes keep checking
-- owns_hackathon(), which a demo user never passes.

alter table public.hackathons add column demo boolean not null default false;

-- A demo user's dashboard lists the demo hackathons, newest first.
create index hackathons_demo_created_at_idx on public.hackathons (created_at desc) where demo;

-- True when the signed-in account is a demo account.
create function public.is_demo_user()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'demo', '') = 'true';
$$;

revoke execute on function public.is_demo_user() from public, anon;
grant execute on function public.is_demo_user() to authenticated;

-- True when the signed-in user may read the hackathon: they own it, or it's a
-- demo hackathon and they're on a demo account. Runs as the caller, like
-- owns_hackathon(), so it only sees hackathons RLS already lets them read.
create function public.can_view_hackathon(p_hackathon_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.hackathons h
    where h.id = p_hackathon_id
      and (h.owner_id = (select auth.uid()) or (h.demo and (select public.is_demo_user())))
  );
$$;

revoke execute on function public.can_view_hackathon(uuid) from public, anon;
grant execute on function public.can_view_hackathon(uuid) to authenticated;

-- ── Hackathons ────────────────────────────────────────────────────────────

alter policy "Owners and viewers of published hackathons can read" on public.hackathons
using (published or (select auth.uid()) = owner_id or (demo and (select public.is_demo_user())));

-- Demo accounts only look around; they can't start hackathons of their own.
alter policy "Owners can create hackathons" on public.hackathons
with check ((select auth.uid()) = owner_id and not (select public.is_demo_user()));

-- ── Everything that hangs off a hackathon: owners, plus demo viewers ──────

alter policy "Owners can read their schema blocks" on public.schema_blocks
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their criteria" on public.criteria
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their criterion inputs" on public.criterion_inputs
using (exists (select 1 from public.criteria c where c.id = criterion_id and public.can_view_hackathon(c.hackathon_id)));

alter policy "Owners can read their judges" on public.judges
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their judge fields" on public.judge_fields
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their judge field options" on public.judge_field_options
using (exists (select 1 from public.judge_fields f where f.id = field_id and public.can_view_hackathon(f.hackathon_id)));
alter policy "Owners can read their judge field values" on public.judge_field_values
using (exists (select 1 from public.judges j where j.id = judge_id and public.can_view_hackathon(j.hackathon_id)));
alter policy "Owners can read their judge groups" on public.judge_groups
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their judge group members" on public.judge_group_members
using (exists (select 1 from public.judge_groups g where g.id = group_id and public.can_view_hackathon(g.hackathon_id)));
alter policy "Owners can read their judge portal settings" on public.judge_portal_settings
using (public.can_view_hackathon(hackathon_id));

alter policy "Owners can read their phases" on public.judging_phases
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their distribution" on public.distribution_settings
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their intake settings" on public.intake_settings
using (public.can_view_hackathon(hackathon_id));

alter policy "Owners can read their projects" on public.projects
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their project values" on public.project_values
using (exists (select 1 from public.projects p where p.id = project_id and public.can_view_hackathon(p.hackathon_id)));
alter policy "Owners can read their project events" on public.project_events
using (exists (select 1 from public.projects p where p.id = project_id and public.can_view_hackathon(p.hackathon_id)));
alter policy "Owners can read their project chunks" on public.project_chunks
using (public.can_view_hackathon(hackathon_id));

alter policy "Owners can read their assignments" on public.judge_assignments
using (exists (select 1 from public.judging_phases ph where ph.id = phase_id and public.can_view_hackathon(ph.hackathon_id)));
alter policy "Owners can read their judge scores" on public.judge_scores
using (exists (
  select 1 from public.judge_assignments a
  join public.judging_phases ph on ph.id = a.phase_id
  where a.id = assignment_id and public.can_view_hackathon(ph.hackathon_id)
));
alter policy "Owners can read their agent reviews" on public.agent_reviews
using (exists (select 1 from public.projects p where p.id = project_id and public.can_view_hackathon(p.hackathon_id)));
alter policy "Owners can read their agent review steps" on public.agent_review_steps
using (exists (select 1 from public.projects p where p.id = project_id and public.can_view_hackathon(p.hackathon_id)));

alter policy "Owners can read their reward tiers" on public.reward_tiers
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their reward items" on public.reward_items
using (exists (select 1 from public.reward_tiers t where t.id = tier_id and public.can_view_hackathon(t.hackathon_id)));
alter policy "Owners can read their reward settings" on public.reward_settings
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their reward emails" on public.reward_emails
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their award winners" on public.award_winners
using (exists (select 1 from public.reward_tiers t where t.id = tier_id and public.can_view_hackathon(t.hackathon_id)));
alter policy "Owners can read their thank-you emails" on public.thank_you_emails
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their email sends" on public.email_sends
using (public.can_view_hackathon(hackathon_id));
alter policy "Owners can read their email runs" on public.email_runs
using (public.can_view_hackathon(hackathon_id));

-- Chats stay private to the admin who started them, except in a demo
-- hackathon, where demo users can read them as examples.
alter policy "Owners can read their chat threads" on public.chat_threads
using (
  (select auth.uid()) = owner_id
  or ((select public.is_demo_user()) and public.can_view_hackathon(hackathon_id))
);
alter policy "Owners can read their chat messages" on public.chat_messages
using (exists (
  select 1 from public.chat_threads t
  where t.id = thread_id
    and (
      t.owner_id = (select auth.uid())
      or ((select public.is_demo_user()) and public.can_view_hackathon(t.hackathon_id))
    )
));

-- ── Judge links ───────────────────────────────────────────────────────────
-- Judge links are the one way in that doesn't check ownership (judges don't
-- have accounts), and demo users can read a demo's judges, links included.
-- Every judge-link write goes through judge_assignments (save_review_scores
-- and judge_release_batch update it), so refuse those updates on a demo
-- hackathon unless they come from its owner or the server's secret key.

create function public.freeze_demo_assignments()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'service_role' and exists (
    select 1 from public.judging_phases ph
    join public.hackathons h on h.id = ph.hackathon_id
    where ph.id = new.phase_id and h.demo and h.owner_id is distinct from (select auth.uid())
  ) then
    raise exception 'This is a demo hackathon, so scores can''t change.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger judge_assignments_freeze_demo
before update on public.judge_assignments
for each row execute function public.freeze_demo_assignments();

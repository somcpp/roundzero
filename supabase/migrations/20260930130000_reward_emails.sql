-- Winner email settings: one row per hackathon, edited from Judging › Rewards.
-- Empty text means "use the default copy", so a hackathon without a row (or
-- with blank fields) still sends a sensible email.

create table public.reward_emails (
  hackathon_id uuid primary key references public.hackathons (id) on delete cascade,
  -- Sender display name; blank sends as the hackathon's name.
  from_name text not null default '' check (char_length(from_name) <= 80),
  -- Heading and intro. {project}, {hackathon} and {rank} are filled in per email.
  title text not null default '' check (char_length(title) <= 200),
  description text not null default '' check (char_length(description) <= 2000),
  -- Optional call-to-action button.
  link_url text not null default '' check (char_length(link_url) <= 2000 and (link_url = '' or link_url ~* '^https?://')),
  link_label text not null default '' check (char_length(link_label) <= 60),
  -- Small print under the list of rewards.
  fine_print text not null default '' check (char_length(fine_print) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reward_emails_set_updated_at
before update on public.reward_emails
for each row execute function public.set_updated_at();

-- Row level security: only the hackathon's owner can see or change it.
alter table public.reward_emails enable row level security;

create policy "Owners can read their reward emails" on public.reward_emails for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create reward emails" on public.reward_emails for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their reward emails" on public.reward_emails for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));

grant select, insert, update on public.reward_emails to authenticated;

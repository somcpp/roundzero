-- Thank-you email settings: one row per hackathon, edited from Judging ›
-- Rewards › Thank-you email. It goes to every project that didn't win, with
-- the winners and an optional thank-you gift. Empty text means "use the
-- default copy", so a hackathon without a row still sends a sensible email.

create table public.thank_you_emails (
  hackathon_id uuid primary key references public.hackathons (id) on delete cascade,
  -- Off keeps the email from going out at all.
  enabled boolean not null default true,
  -- Sender display name; blank sends as the hackathon's name.
  from_name text not null default '' check (char_length(from_name) <= 80),
  -- Subject, heading and message. {project} and {hackathon} are filled in per email.
  subject text not null default '' check (char_length(subject) <= 200),
  title text not null default '' check (char_length(title) <= 200),
  message text not null default '' check (char_length(message) <= 2000),
  -- List the winners under the message.
  show_winners boolean not null default true,
  -- The thank-you gift for everyone who took part. Items are reward items
  -- ({id, kind, label, detail}); an empty list leaves the gift out.
  gift_title text not null default '' check (char_length(gift_title) <= 120),
  gift_description text not null default '' check (char_length(gift_description) <= 500),
  gift_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(gift_items) = 'array' and jsonb_array_length(gift_items) <= 10),
  -- Optional call-to-action button, e.g. claim the gift or RSVP to demo night.
  link_url text not null default '' check (char_length(link_url) <= 2000 and (link_url = '' or link_url ~* '^https?://')),
  link_label text not null default '' check (char_length(link_label) <= 60),
  -- Small print under the gift.
  fine_print text not null default '' check (char_length(fine_print) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger thank_you_emails_set_updated_at
before update on public.thank_you_emails
for each row execute function public.set_updated_at();

-- Row level security: only the hackathon's owner can see or change it.
alter table public.thank_you_emails enable row level security;

create policy "Owners can read their thank-you emails" on public.thank_you_emails for select to authenticated
using (public.owns_hackathon(hackathon_id));
create policy "Owners can create thank-you emails" on public.thank_you_emails for insert to authenticated
with check (public.owns_hackathon(hackathon_id));
create policy "Owners can update their thank-you emails" on public.thank_you_emails for update to authenticated
using (public.owns_hackathon(hackathon_id))
with check (public.owns_hackathon(hackathon_id));

grant select, insert, update on public.thank_you_emails to authenticated;

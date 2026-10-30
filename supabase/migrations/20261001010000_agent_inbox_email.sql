-- The agent-failed inbox email (src/emails/agent-inbox.tsx): after an agent
-- run leaves gate failures waiting on a call, the owner hears about them
-- (src/workflows/agent-inbox). email_sends learns its kind.

alter table public.email_sends drop constraint email_sends_kind_check;
alter table public.email_sends add constraint email_sends_kind_check check (kind in (
  'judge_invite', 'judge_batch', 'judge_last_call',
  'owner_phase_done', 'owner_phase_due',
  'winner', 'thank_you',
  'agent_inbox'
));

-- The graphic reviewer is retired as a mechanism. Existing criteria drop it
-- (one left with nothing falls back to the agent judge, which is what the
-- agent already did with an empty list), the check stops allowing it, and new
-- hackathons' default rubric leaves it out. Old agent_review_steps rows keep
-- the name in their history; the project page skips mechanisms it doesn't know.

update public.criteria
set mechanisms = coalesce(nullif(array_remove(mechanisms, 'graphic_reviewer'), '{}'), '{agent_judge}')
where 'graphic_reviewer' = any (mechanisms);

alter table public.criteria drop constraint criteria_mechanisms_check;
alter table public.criteria add constraint criteria_mechanisms_check check (
  mechanisms <@ array['agent_judge', 'sandbox_run', 'video_reviewer', 'code_scraper', 'web_scraper', 'human_only']
);

create or replace function public.seed_criteria(p_hackathon_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.criteria
    (hackathon_id, position, title, scale, description, mechanisms, weight, if_missing, agent_guidance, agent_model)
  values
    (p_hackathon_id, 0, 'Technical execution', 'score', 'Code runs, is structured, and does what the demo claims.',
      '{sandbox_run,code_scraper,agent_judge}', 30, 'zero',
      'Check the core feature is really implemented, not mocked or hard-coded. Reward working run instructions and real tests, not README length.',
      'balanced'),
    (p_hackathon_id, 1, 'Video: problem & solution', 'score', 'Video clearly states the problem and shows the working solution within 3 minutes.',
      '{video_reviewer}', 25, 'zero',
      'Look for the problem stated in the first 30 seconds and the product actually running on screen. Going over 3 minutes is a soft penalty, not a zero.',
      'balanced'),
    (p_hackathon_id, 2, 'Impact', 'score', 'Solves a real problem for a clear audience, and could keep going after the event.',
      '{agent_judge,web_scraper}', 25, 'judge',
      'Name the audience and the problem. Evidence of real users beats claims of them.',
      'balanced'),
    (p_hackathon_id, 3, 'Originality & design', 'score', 'Novel idea, thoughtful UX.',
      '{agent_judge}', 20, 'judge',
      'Compare with well-known existing products. Reward a clear, thoughtful experience in what the team shows, not polish claimed in the description.',
      'balanced');

  insert into public.criterion_inputs (criterion_id, block_id)
  select c.id, b.id
  from public.criteria c
  join public.schema_blocks b on b.hackathon_id = c.hackathon_id
  where c.hackathon_id = p_hackathon_id
    and (
      (c.position = 0 and b.type = 'repo url')
      or (c.position = 1 and b.type = 'video url')
    );
end;
$$;

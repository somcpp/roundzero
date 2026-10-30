-- Project RAG and the judging chat. Every saved project is split into chunks
-- and embedded (Nebius Token Factory, 1024 dims) so the chat agent can search
-- submissions by meaning. Chat threads and their messages are saved per admin.

create extension if not exists vector with schema extensions;

-- ── Project chunks ────────────────────────────────────────────────────────

create table public.project_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Copied from the project so search can filter one hackathon without a join.
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  -- 'submission': the project's own field values. 'web': a page it links to
  -- (repo README, live demo), fetched at ingestion.
  source text not null check (source in ('submission', 'web')),
  source_url text check (char_length(source_url) <= 2048),
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) between 1 and 8000),
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now()
);

create index project_chunks_project_id_idx on public.project_chunks (project_id);
create index project_chunks_hackathon_id_idx on public.project_chunks (hackathon_id);
create index project_chunks_embedding_idx on public.project_chunks
using hnsw (embedding extensions.vector_cosine_ops);

alter table public.project_chunks enable row level security;

create policy "Owners can read their project chunks" on public.project_chunks for select to authenticated
using (public.owns_hackathon(hackathon_id));
-- The project must belong to the hackathon the chunk claims.
create policy "Owners can add project chunks" on public.project_chunks for insert to authenticated
with check (
  public.owns_hackathon(hackathon_id)
  and exists (select 1 from public.projects p where p.id = project_id and p.hackathon_id = project_chunks.hackathon_id)
);
create policy "Owners can delete project chunks" on public.project_chunks for delete to authenticated
using (public.owns_hackathon(hackathon_id));

grant select, insert, delete on public.project_chunks to authenticated;

-- Replace one project's chunks in one transaction. p_chunks is an array of
-- {source, source_url, content, embedding} where embedding is a JSON number
-- array; array order becomes chunk_index.
create function public.replace_project_chunks(p_project_id uuid, p_chunks jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hackathon_id uuid;
begin
  select hackathon_id into v_hackathon_id from public.projects where id = p_project_id;
  if v_hackathon_id is null then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  delete from public.project_chunks where project_id = p_project_id;

  insert into public.project_chunks (project_id, hackathon_id, source, source_url, chunk_index, content, embedding)
  select
    p_project_id,
    v_hackathon_id,
    c.value ->> 'source',
    nullif(c.value ->> 'source_url', ''),
    (c.ordinality - 1)::integer,
    c.value ->> 'content',
    (c.value -> 'embedding')::text::extensions.vector
  from jsonb_array_elements(p_chunks) with ordinality as c (value, ordinality);
end;
$$;

revoke execute on function public.replace_project_chunks(uuid, jsonb) from public, anon;
grant execute on function public.replace_project_chunks(uuid, jsonb) to authenticated;

-- The chunks nearest a query embedding, optionally limited to some projects.
-- Iterative scan keeps filtered HNSW searches from coming back short.
create function public.match_project_chunks(
  p_hackathon_id uuid,
  p_query extensions.vector(1024),
  p_count integer default 8,
  p_project_ids uuid[] default null
)
returns table (
  project_id uuid,
  number integer,
  source text,
  source_url text,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
set hnsw.iterative_scan = relaxed_order
as $$
  select
    c.project_id,
    p.number,
    c.source,
    c.source_url,
    c.content,
    1 - (c.embedding operator(extensions.<=>) p_query) as similarity
  from public.project_chunks c
  join public.projects p on p.id = c.project_id
  where c.hackathon_id = p_hackathon_id
    and (p_project_ids is null or c.project_id = any (p_project_ids))
  order by c.embedding operator(extensions.<=>) p_query
  limit least(greatest(p_count, 1), 50);
$$;

revoke execute on function public.match_project_chunks(uuid, extensions.vector, integer, uuid[]) from public, anon;
grant execute on function public.match_project_chunks(uuid, extensions.vector, integer, uuid[]) to authenticated;

-- ── Chat threads ──────────────────────────────────────────────────────────
-- Private to the admin who started them.

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) between 1 and 120),
  -- The filters the thread was scoped to, e.g. {"phaseId": "…", "status": "active"}.
  scope jsonb not null default '{}' check (jsonb_typeof(scope) = 'object' and octet_length(scope::text) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Covers the "my threads in this hackathon, newest first" read.
create index chat_threads_hackathon_id_owner_id_updated_at_idx
on public.chat_threads (hackathon_id, owner_id, updated_at desc);
create index chat_threads_owner_id_idx on public.chat_threads (owner_id);

create trigger chat_threads_set_updated_at
before update on public.chat_threads
for each row execute function public.set_updated_at();

-- AI SDK UIMessages, stored as sent: parts and metadata as JSON.
create table public.chat_messages (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  position integer not null check (position >= 0),
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null check (jsonb_typeof(parts) = 'array' and octet_length(parts::text) <= 500000),
  metadata jsonb,
  created_at timestamptz not null default now(),
  primary key (thread_id, id)
);

create index chat_messages_thread_id_position_idx on public.chat_messages (thread_id, position);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy "Owners can read their chat threads" on public.chat_threads for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "Owners can create chat threads" on public.chat_threads for insert to authenticated
with check ((select auth.uid()) = owner_id and public.owns_hackathon(hackathon_id));
create policy "Owners can update their chat threads" on public.chat_threads for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id and public.owns_hackathon(hackathon_id));
create policy "Owners can delete their chat threads" on public.chat_threads for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can read their chat messages" on public.chat_messages for select to authenticated
using (exists (select 1 from public.chat_threads t where t.id = thread_id and t.owner_id = (select auth.uid())));
create policy "Owners can add chat messages" on public.chat_messages for insert to authenticated
with check (exists (select 1 from public.chat_threads t where t.id = thread_id and t.owner_id = (select auth.uid())));
create policy "Owners can update their chat messages" on public.chat_messages for update to authenticated
using (exists (select 1 from public.chat_threads t where t.id = thread_id and t.owner_id = (select auth.uid())))
with check (exists (select 1 from public.chat_threads t where t.id = thread_id and t.owner_id = (select auth.uid())));
create policy "Owners can delete their chat messages" on public.chat_messages for delete to authenticated
using (exists (select 1 from public.chat_threads t where t.id = thread_id and t.owner_id = (select auth.uid())));

grant select, insert, update, delete on public.chat_threads to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;

-- Replace a thread's messages with p_messages (an array of UIMessages), in
-- order, and bump the thread so it sorts first.
create function public.save_chat_messages(p_thread_id uuid, p_messages jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.chat_threads where id = p_thread_id) then
    raise exception 'Chat not found' using errcode = 'P0002';
  end if;

  delete from public.chat_messages
  where thread_id = p_thread_id
    and id not in (select m ->> 'id' from jsonb_array_elements(p_messages) m);

  insert into public.chat_messages as t (thread_id, id, position, role, parts, metadata)
  select
    p_thread_id,
    m.value ->> 'id',
    (m.ordinality - 1)::integer,
    m.value ->> 'role',
    coalesce(m.value -> 'parts', '[]'),
    m.value -> 'metadata'
  from jsonb_array_elements(p_messages) with ordinality as m (value, ordinality)
  on conflict (thread_id, id) do update set
    position = excluded.position,
    role = excluded.role,
    parts = excluded.parts,
    metadata = excluded.metadata;

  update public.chat_threads set updated_at = now() where id = p_thread_id;
end;
$$;

revoke execute on function public.save_chat_messages(uuid, jsonb) from public, anon;
grant execute on function public.save_chat_messages(uuid, jsonb) to authenticated;

-- Fix for 20260930210000_email_delivery.sql: save_project appended
-- 'Contact email' to the changed-fields list with `||`, which Postgres reads
-- as text[] || unknown and tries to parse 'Contact email' as an array literal
-- ("malformed array literal"). So changing only a project's contact email
-- failed. Same function, with array_append.

create or replace function public.save_project(p_hackathon_id uuid, p_project jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_project ->> 'id')::uuid;
  v_values jsonb := coalesce(p_project -> 'values', '{}');
  v_email text := lower(btrim(p_project ->> 'contact_email'));
  v_old_email text;
  v_number integer;
  v_changed text[];
begin
  if not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'Hackathon not found' using errcode = 'P0002';
  end if;

  select number, contact_email into v_number, v_old_email
  from public.projects where id = v_id and hackathon_id = p_hackathon_id;

  if v_number is null then
    if exists (select 1 from public.projects where id = v_id) then
      raise exception 'Project not found' using errcode = 'P0002';
    end if;
    select coalesce(max(number), 0) + 1 into v_number from public.projects where hackathon_id = p_hackathon_id;
    insert into public.projects (id, hackathon_id, number, contact_email)
    values (v_id, p_hackathon_id, v_number, coalesce(v_email, ''));
    insert into public.project_events (project_id, kind) values (v_id, 'submitted');
  else
    select coalesce(array_agg(b.title order by b.position), '{}') into v_changed
    from public.schema_blocks b
    left join public.project_values o on o.project_id = v_id and o.block_id = b.id
    where b.hackathon_id = p_hackathon_id
      and o.value is distinct from v_values -> b.id::text;

    if v_email is not null and v_email <> v_old_email then
      v_changed := array_append(v_changed, 'Contact email');
      update public.projects set contact_email = v_email where id = v_id;
    end if;

    if cardinality(v_changed) = 0 then
      return v_number;
    end if;
    insert into public.project_events (project_id, kind, data)
    values (v_id, 'edited', jsonb_build_object('fields', to_jsonb(v_changed)));
    update public.projects set updated_at = now() where id = v_id;
  end if;

  delete from public.project_values where project_id = v_id;
  insert into public.project_values (project_id, block_id, value)
  select v_id, b.id, v.value
  from jsonb_each(v_values) v (block_id, value)
  join public.schema_blocks b on b.id::text = v.block_id and b.hackathon_id = p_hackathon_id;

  return v_number;
end;
$$;

-- Execute uma vez no SQL Editor de um NOVO projeto Supabase.
begin;
create table public.routes (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 80),
  author text not null check (char_length(btrim(author)) between 2 and 40),
  description text not null default '' check (char_length(description) <= 280),
  difficulty text not null check (difficulty in ('Fácil','Médio','Difícil')),
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index routes_owner_created on public.routes(owner_id,created_at desc);
alter table public.routes enable row level security;
-- Os dados das rotas são públicos; owner_id não é exposto pela API.
revoke all on public.routes from anon, authenticated;
grant select(id,name,author,description,difficulty,data,created_at) on public.routes to anon,authenticated;
create policy "Leitura pública das rotas" on public.routes for select to anon,authenticated using (true);

create function public.valid_route(d jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare f jsonb; v jsonb; field text; previous numeric := -1; t numeric;
begin
  if jsonb_typeof(d) <> 'object' or not (d ?& array['version','fps','frames']) or (d - array['version','fps','frames']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(d->'version') <> 'number' or (d->>'version')::numeric <> 1 then return false; end if;
  if jsonb_typeof(d->'fps') <> 'number' or (d->>'fps')::numeric not between 1 and 240 or mod((d->>'fps')::numeric,1) <> 0 then return false; end if;
  if jsonb_typeof(d->'frames') <> 'array' then return false; end if;
  if jsonb_array_length(d->'frames') not between 2 and 10000 or octet_length(d::text)>2000000 then return false; end if;
  for f in select value from jsonb_array_elements(d->'frames') loop
    if jsonb_typeof(f)<>'object' or not(f ?& array['t','position','rotation']) or (f-array['t','position','rotation'])<>'{}'::jsonb then return false; end if;
    if jsonb_typeof(f->'t')<>'number' then return false; end if;
    t := (f->>'t')::numeric;
    if t<0 or t>3600 or t<=previous then return false; end if;
    previous := t;
    foreach field in array array['position','rotation'] loop
      if jsonb_typeof(f->field)<>'array' then return false; end if;
      if jsonb_array_length(f->field)<>3 then return false; end if;
      for v in select value from jsonb_array_elements(f->field) loop
        if jsonb_typeof(v)<>'number' or abs(v::text::numeric)>1000000 then return false; end if;
      end loop;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $$;
alter table public.routes add constraint route_frames_valid check (public.valid_route(data));

create function public.publish_route(p_name text,p_author text,p_description text,p_difficulty text,p_data jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); new_id bigint;
begin
  if uid is null then raise exception 'Autenticação necessária'; end if;
  if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Confirme seu e-mail'; end if;
  -- Serializa envios do mesmo usuário para que chamadas simultâneas não burlem o limite.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if exists(select 1 from public.routes where owner_id=uid and created_at>now()-interval '1 minute') then raise exception 'Aguarde um minuto entre publicações'; end if;
  if (select count(*) from public.routes where owner_id=uid and created_at>now()-interval '1 day')>=30 then raise exception 'Limite diário atingido'; end if;
  if not public.valid_route(p_data) then raise exception 'Frames inválidos'; end if;
  insert into public.routes(owner_id,name,author,description,difficulty,data)
  values(uid,btrim(p_name),btrim(p_author),btrim(coalesce(p_description,'')),p_difficulty,p_data) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.publish_route(text,text,text,text,jsonb) from public,anon;
grant execute on function public.publish_route(text,text,text,text,jsonb) to authenticated;
commit;

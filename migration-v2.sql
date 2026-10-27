-- Atualização v2: não apaga rotas ou contas existentes.
begin;
alter table public.routes add column if not exists publisher_roblox_id text;
alter table public.routes add column if not exists authorship_status text not null default 'unverified' check(authorship_status='unverified');
grant select(publisher_roblox_id,authorship_status) on public.routes to anon,authenticated;
create or replace function public.valid_route(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare s jsonb; v jsonb; i integer; previous numeric:=-1; t numeric;
begin
if d is null or jsonb_typeof(d)<>'object' or not(d ?& array['format','version','name','samples']) or (d-array['format','version','name','samples'])<>'{}'::jsonb then return false; end if;
if (d->>'format') is distinct from 'GAMPILON_ROUTE_JSON' or jsonb_typeof(d->'version')<>'number' or (d->>'version')::numeric<>2 then return false; end if;
if jsonb_typeof(d->'name')<>'string' or char_length(btrim(d->>'name'))<1 or char_length(d->>'name')>80 then return false; end if;
if jsonb_typeof(d->'samples')<>'array' then return false; end if;
if jsonb_array_length(d->'samples') not between 2 and 10000 or octet_length(d::text)>2000000 then return false; end if;
for s in select value from jsonb_array_elements(d->'samples') loop
 if jsonb_typeof(s)<>'object' or not(s ?& array['CF','Velocity','Time','State']) or (s-array['CF','Velocity','Time','State'])<>'{}'::jsonb then return false; end if;
 if jsonb_typeof(s->'Time')<>'number' then return false; end if;
 t:=(s->>'Time')::numeric; if t<0 or t>3600 or t<=previous then return false; end if; previous:=t;
 if jsonb_typeof(s->'CF')<>'array' or jsonb_typeof(s->'Velocity')<>'array' then return false; end if;
 if jsonb_array_length(s->'CF')<>12 or jsonb_array_length(s->'Velocity')<>3 then return false; end if;
 for i in 0..11 loop
  v:=s->'CF'->i; if jsonb_typeof(v)<>'number' then return false; end if;
  if abs(v::text::numeric)>(case when i<3 then 1000000 else 1.001 end) then return false; end if;
 end loop;
 for v in select value from jsonb_array_elements(s->'Velocity') loop
  if jsonb_typeof(v)<>'number' or abs(v::text::numeric)>1000000 then return false; end if;
 end loop;
 if jsonb_typeof(s->'State')<>'string' or not(s->>'State'=any(array['FallingDown','Ragdoll','GettingUp','Jumping','Swimming','Freefall','Flying','Landed','Running','RunningNoPhysics','StrafingNoPhysics','Climbing','Seated','PlatformStanding','Dead','Physics','None'])) then return false; end if;
end loop; return true;
exception when others then return false;
end $$;
do $$ begin
if not exists(select 1 from pg_constraint where conname='route_frames_valid' and conrelid='public.routes'::regclass) then
alter table public.routes add constraint route_frames_valid check(public.valid_route(data)) not valid;
end if;
end $$;
create or replace function public.publish_route(p_name text,p_author text,p_description text,p_difficulty text,p_data jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid text; display_name text; new_id bigint;
begin
if uid is null then raise exception 'Entre com Roblox para publicar'; end if;
-- Não confie em user_metadata editável nem em p_author. Consulte a identidade verificada pelo provedor.
select i.provider_id, left(coalesce(nullif(i.identity_data->>'preferred_username',''),nullif(i.identity_data->>'name',''),'Roblox '||i.provider_id),40)
into rid,display_name from auth.identities i where i.user_id=uid and i.provider='custom:roblox' limit 1;
if rid is null or rid !~ '^[1-9][0-9]{0,19}$' then raise exception 'Entre com Roblox para publicar'; end if;
perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
if exists(select 1 from public.routes where owner_id=uid and created_at>now()-interval '1 minute') then raise exception 'Aguarde um minuto entre publicações'; end if;
if (select count(*) from public.routes where owner_id=uid and created_at>now()-interval '1 day')>=30 then raise exception 'Limite diário atingido'; end if;
if not public.valid_route(p_data) then raise exception 'Formato não reconhecido: use GAMPILON_ROUTE_JSON v2'; end if;
insert into public.routes(owner_id,name,author,description,difficulty,data,publisher_roblox_id,authorship_status)
values(uid,btrim(p_name),display_name,btrim(coalesce(p_description,'')),p_difficulty,p_data,rid,'unverified') returning id into new_id;
return new_id;
end $$;
revoke all on function public.publish_route(text,text,text,text,jsonb) from public,anon;
grant execute on function public.publish_route(text,text,text,text,jsonb) to authenticated;
commit;

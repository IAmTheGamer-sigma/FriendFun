-- FriendFun Groups - canonical Supabase schema
-- Run this once in the Supabase SQL Editor.

create table if not exists public.groups (
  id text primary key,
  name text not null,
  description text not null default '',
  creator text not null,
  members jsonb not null default '[]'::jsonb,
  created bigint not null default (extract(epoch from now()) * 1000)::bigint
);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='groups' and column_name='owner')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='groups' and column_name='creator') then
    alter table public.groups rename column owner to creator;
  end if;
end $$;

update public.groups
set description = coalesce(description, ''),
    members = case
      when members is null then '[]'::jsonb
      when jsonb_typeof(members) = 'array' then members
      else '[]'::jsonb
    end
where description is null or members is null or jsonb_typeof(members) <> 'array';

create index if not exists groups_created_idx on public.groups (created desc);
create index if not exists groups_creator_idx on public.groups (creator);
create unique index if not exists groups_name_lower_idx on public.groups (lower(name));

-- After confirming every existing row has a creator:
-- alter table public.groups alter column creator set not null;

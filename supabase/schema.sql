-- «Наша кухня»: база данных для Supabase.
-- Как применить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- ПЕРЕД ЗАПУСКОМ впишите ниже две почты, с которыми вы будете входить в приложение.

-- 1. Кто имеет доступ (только эти почты увидят и смогут менять данные)
create table if not exists public.members (
  email text primary key
);
insert into public.members (email) values
  ('ваша-почта@example.com'),
  ('почта-жены@example.com')
on conflict do nothing;

-- 2. Все данные приложения в одной таблице: kind = recipes | pantry | shopping | preserves | custom_ingredients | menu
create table if not exists public.items (
  id         text primary key,
  kind       text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_kind_idx on public.items (kind);

-- 3. Проверка «это кто-то из нас»
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 4. Защита строк: читать и писать могут только участники
alter table public.items   enable row level security;
alter table public.members enable row level security;  -- политик нет: через API таблицу никто не читает

drop policy if exists "items_select" on public.items;
drop policy if exists "items_insert" on public.items;
drop policy if exists "items_update" on public.items;
drop policy if exists "items_delete" on public.items;
create policy "items_select" on public.items for select to authenticated using (public.is_member());
create policy "items_insert" on public.items for insert to authenticated with check (public.is_member());
create policy "items_update" on public.items for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "items_delete" on public.items for delete to authenticated using (public.is_member());

-- 5. Живое обновление: изменения жены сразу появляются у вас и наоборот
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end $$;

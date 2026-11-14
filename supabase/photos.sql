-- «Наша кухня»: хранилище фото блюд.
-- Как применить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Фото доступны по прямой ссылке (её знает только приложение), загружать и удалять могут только участники.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos_insert" on storage.objects;
drop policy if exists "photos_update" on storage.objects;
drop policy if exists "photos_delete" on storage.objects;

create policy "photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member());
create policy "photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_member());
create policy "photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_member());

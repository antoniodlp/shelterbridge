-- Private photo bucket. The web app serves photos only through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('person-photos', 'person-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy person_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'person-photos' and (select app.current_app_role()) is not null);

create policy person_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'person-photos' and (select app.current_app_role()) is not null);

create policy person_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'person-photos' and (select app.current_app_role()) is not null)
  with check (bucket_id = 'person-photos' and (select app.current_app_role()) is not null);

create policy person_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'person-photos' and (select app.current_app_role()) = 'admin');

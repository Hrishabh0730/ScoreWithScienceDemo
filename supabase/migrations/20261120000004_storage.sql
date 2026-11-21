-- Storage buckets.
-- notes-pdf   : PRIVATE. Full PDFs. Only the admin can upload; students download
--               through the website's /api/download route after an ownership check.
-- note-images : public. Cover images and sample preview pages only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('notes-pdf', 'notes-pdf', false, 52428800, array['application/pdf']),
  ('note-images', 'note-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "admin manages note pdfs" on storage.objects for all to authenticated
  using (bucket_id = 'notes-pdf' and public.is_admin())
  with check (bucket_id = 'notes-pdf' and public.is_admin());

create policy "admin manages note images" on storage.objects for all to authenticated
  using (bucket_id = 'note-images' and public.is_admin())
  with check (bucket_id = 'note-images' and public.is_admin());

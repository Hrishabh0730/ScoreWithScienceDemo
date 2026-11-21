-- Row Level Security. Students see only their own data; the admin sees everything.
-- Payment state is written only by the server (service role), never by browsers.

alter table public.site_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.notes enable row level security;
alter table public.note_files enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.refunds enable row level security;
alter table public.webhook_events enable row level security;
alter table public.slots enable row level security;
alter table public.blocked_periods enable row level security;
alter table public.bookings enable row level security;
alter table public.videos enable row level security;
alter table public.testimonials enable row level security;
alter table public.faqs enable row level security;
alter table public.contact_messages enable row level security;

-- Settings: public read, admin write
create policy settings_read on public.site_settings for select using (true);
create policy settings_admin on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profiles
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Students may only edit these columns (never role/email/consent).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, class_level, board) on public.profiles to authenticated;

-- Notes: published notes are public; admin manages all
create policy notes_public_read on public.notes for select using (is_published or public.is_admin());
create policy notes_admin_write on public.notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy note_files_admin on public.note_files for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Orders: read own; writes only via server
create policy orders_read on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy order_items_read on public.order_items for select to authenticated
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
create policy refunds_admin_read on public.refunds for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.orders, public.order_items, public.refunds from anon, authenticated;
-- webhook_events: no policies => only the service role can touch it.
revoke all on public.webhook_events from anon, authenticated;

-- Availability: admin manages; students see slots only through their own bookings
-- (bookable slots are listed via the available_slots() function).
create policy slots_admin on public.slots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy slots_own_booking_read on public.slots for select to authenticated
  using (exists (select 1 from public.bookings b where b.slot_id = slots.id and b.user_id = auth.uid()));
create policy blocked_admin on public.blocked_periods for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Bookings: read own; created only through reserve_slot(); admin may update
create policy bookings_read on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy bookings_admin_update on public.bookings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.bookings from anon, authenticated;

-- Content
create policy videos_read on public.videos for select using (is_published or public.is_admin());
create policy videos_admin on public.videos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy testimonials_read on public.testimonials for select using (is_published or public.is_admin());
create policy testimonials_admin on public.testimonials for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy faqs_read on public.faqs for select using (is_published or public.is_admin());
create policy faqs_admin on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Contact messages are inserted by the server; only the admin can read them.
create policy contact_admin on public.contact_messages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert on public.contact_messages from anon;

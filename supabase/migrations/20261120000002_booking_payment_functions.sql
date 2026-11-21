-- Booking & payment logic. Availability is enforced HERE, in the database,
-- with row locks, so the browser can never book a slot the teacher has not opened.

create or replace function public.make_ref(p_prefix text)
returns text language sql volatile as $$
  select p_prefix || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-'
         || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
$$;

-- Price of a session, computed from admin-controlled settings (rupees) -> paise.
-- Returns NULL when the service/duration combination is not offered.
create or replace function public.booking_price_paise(p_service text, p_minutes integer)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  p jsonb := coalesce(public.setting('pricing'), '{}'::jsonb);
begin
  if p_service = 'tuition' then
    if p_minutes is null or p_minutes < 30 or p_minutes % 30 <> 0 then return null; end if;
    return round(coalesce((p->>'tuition_per_hour')::numeric, 100) * p_minutes / 60.0 * 100)::integer;
  elsif p_service = 'doubt' then
    if p_minutes = 30 then return round(coalesce((p->>'doubt_30')::numeric, 50) * 100)::integer; end if;
    if p_minutes = 60 then return round(coalesce((p->>'doubt_60')::numeric, 100) * 100)::integer; end if;
    return null;
  end if;
  return null;
end $$;

-- Seats taken: accepted bookings + holds that have not expired yet.
-- 'needs_review' bookings do NOT take a seat (the teacher decides on them separately),
-- so a late or problematic payment can never push out a student with a valid hold.
create or replace function public.slot_taken_count(p_slot uuid, p_exclude uuid default null)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.bookings b
  where b.slot_id = p_slot
    and (p_exclude is null or b.id <> p_exclude)
    and (b.status in ('confirmed', 'completed')
         or (b.status = 'pending_payment' and b.hold_expires_at > now()))
$$;

-- Returns NULL when the slot can be booked for the service, otherwise a reason code.
-- p_for_confirm relaxes the "minimum notice" rule for payments that started in time.
create or replace function public.slot_unavailable_reason(
  s public.slots, p_service text, p_for_confirm boolean default false, p_exclude uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  b jsonb := coalesce(public.setting('booking'), '{}'::jsonb);
  v_notice_h numeric := coalesce((b->>'min_notice_hours')::numeric, 2);
  v_max_days numeric := coalesce((b->>'max_days_ahead')::numeric, 60);
begin
  if coalesce((b->>'bookings_open')::boolean, false) is not true then return 'bookings_closed'; end if;
  if s.archived then return 'removed'; end if;
  if not s.is_open then return 'closed'; end if;
  if p_service = 'tuition' and not s.allow_tuition then return 'service_not_offered'; end if;
  if p_service = 'doubt' and not s.allow_doubt then return 'service_not_offered'; end if;
  if p_service not in ('tuition', 'doubt') then return 'service_not_offered'; end if;
  if public.booking_price_paise(p_service, s.duration_minutes) is null then return 'duration_not_offered'; end if;
  if s.start_at <= now() then return 'in_past'; end if;
  if not p_for_confirm then
    if s.start_at < now() + make_interval(mins => (v_notice_h * 60)::integer) then return 'too_soon'; end if;
    if s.start_at > now() + make_interval(days => v_max_days::integer) then return 'too_far'; end if;
  end if;
  if exists (select 1 from public.blocked_periods bp
             where tstzrange(bp.start_at, bp.end_at, '[)') && tstzrange(s.start_at, s.end_at, '[)')) then
    return 'blocked';
  end if;
  if public.slot_taken_count(s.id, p_exclude) >= s.capacity then return 'full'; end if;
  return null;
end $$;

-- Public listing of bookable slots. Only slots the teacher opened ever appear.
create or replace function public.available_slots(p_service text, p_minutes integer default null)
returns table (slot_id uuid, start_at timestamptz, end_at timestamptz, minutes integer,
               seats_left integer, price_paise integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.start_at, s.end_at, s.duration_minutes,
         s.capacity - public.slot_taken_count(s.id),
         public.booking_price_paise(p_service, s.duration_minutes)
  from public.slots s
  where not s.archived and s.is_open and s.start_at > now()
    and (p_minutes is null or s.duration_minutes = p_minutes)
    and public.slot_unavailable_reason(s, p_service) is null
  order by s.start_at
  limit 500
$$;

-- Step 4+5 of the booking workflow: validate and temporarily hold the slot.
-- Runs as the logged-in student (auth.uid()). The price is computed here, never taken from the browser.
create or replace function public.reserve_slot(
  p_slot uuid, p_service text, p_class integer, p_board text, p_topic text default null)
returns public.bookings language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.slots;
  v_reason text;
  v_hold integer := coalesce((public.setting('booking')->>'hold_minutes')::integer, 10);
  r public.bookings;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_service is null or p_service not in ('tuition', 'doubt') then raise exception 'invalid_service'; end if;
  if p_class is null or p_class not in (8, 9, 10) or p_board is null or p_board not in ('CBSE', 'ICSE') then
    raise exception 'invalid_class_or_board';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then raise exception 'no_profile'; end if;

  -- Lock the slot row: concurrent reservations for the same slot run one at a time.
  select * into s from public.slots where id = p_slot for update;
  if not found then raise exception 'slot_unavailable:not_found'; end if;

  update public.bookings set status = 'expired'
   where slot_id = p_slot and status = 'pending_payment' and hold_expires_at <= now();

  v_reason := public.slot_unavailable_reason(s, p_service);
  if v_reason is not null then raise exception 'slot_unavailable:%', v_reason; end if;

  if exists (select 1 from public.bookings
             where slot_id = p_slot and user_id = v_uid
               and (status in ('confirmed', 'needs_review')
                    or (status = 'pending_payment' and hold_expires_at > now()))) then
    raise exception 'already_booked';
  end if;

  if (select count(*) from public.bookings
      where user_id = v_uid and status = 'pending_payment' and hold_expires_at > now()) >= 2 then
    raise exception 'too_many_pending';
  end if;

  insert into public.bookings (booking_number, user_id, slot_id, service, class_level, board, topic,
                               amount_paise, status, hold_expires_at)
  values (public.make_ref('SWS-B'), v_uid, p_slot, p_service, p_class, p_board,
          nullif(left(btrim(coalesce(p_topic, '')), 500), ''),
          public.booking_price_paise(p_service, s.duration_minutes),
          'pending_payment', now() + make_interval(mins => v_hold))
  returning * into r;
  return r;
end $$;

-- Student closed the payment window: free the seat immediately.
create or replace function public.release_booking(p_booking uuid)
returns void language sql volatile security definer set search_path = public as $$
  update public.bookings set status = 'released'
   where id = p_booking and user_id = auth.uid() and status = 'pending_payment'
$$;

-- Steps 7-9: called by the server ONLY after Razorpay has confirmed the payment.
-- Idempotent: duplicate webhooks / retries return the existing state.
-- The booking is confirmed only if the slot is STILL valid; otherwise it goes to
-- 'needs_review' so the teacher decides (accept or refund) — never auto-accepted.
create or replace function public.confirm_booking_payment(
  p_booking uuid, p_payment_id text, p_amount_paise integer, p_method text default null)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  r public.bookings;
  s public.slots;
  v_reason text;
  v_new text;
  v_note text;
begin
  select * into r from public.bookings where id = p_booking;
  if not found then raise exception 'booking_not_found'; end if;

  -- Same lock order as reserve_slot: slot first, then booking.
  select * into s from public.slots where id = r.slot_id for update;
  select * into r from public.bookings where id = p_booking for update;

  if r.status in ('confirmed', 'needs_review', 'completed', 'refunded') then
    return 'already_processed:' || r.status;
  end if;

  if p_amount_paise is distinct from r.amount_paise then
    v_new := 'needs_review';
    v_note := format('Amount mismatch: paid %s paise, expected %s paise', p_amount_paise, r.amount_paise);
  elsif r.status = 'cancelled' then
    v_new := 'needs_review';
    v_note := 'Payment received after this hold was cancelled (slot closed, time blocked or bookings closed)';
  else
    v_reason := public.slot_unavailable_reason(s, r.service, true, r.id);
    if v_reason is null then
      v_new := 'confirmed';
    else
      v_new := 'needs_review';
      v_note := 'Payment received but slot is no longer available: ' || v_reason;
    end if;
  end if;

  update public.bookings
     set status = v_new,
         confirmed_at = case when v_new = 'confirmed' then now() else confirmed_at end,
         admin_note = coalesce(v_note, admin_note),
         hold_expires_at = null
   where id = r.id;

  update public.orders
     set status = case when v_new = 'confirmed' then 'paid' else 'needs_review' end,
         razorpay_payment_id = coalesce(razorpay_payment_id, p_payment_id),
         payment_method = coalesce(p_method, payment_method),
         paid_at = coalesce(paid_at, now())
   where id = r.order_id;

  return v_new;
end $$;

-- Notes order paid. Idempotent.
create or replace function public.mark_notes_order_paid(
  p_order uuid, p_payment_id text, p_amount_paise integer, p_method text default null)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order and kind = 'notes' for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'created' then return 'already_processed:' || o.status; end if;
  if p_amount_paise is distinct from o.amount_paise then
    update public.orders set status = 'needs_review', razorpay_payment_id = p_payment_id,
           last_error = format('Amount mismatch: paid %s, expected %s', p_amount_paise, o.amount_paise),
           paid_at = now()
     where id = o.id;
    return 'needs_review';
  end if;
  update public.orders
     set status = 'paid', razorpay_payment_id = p_payment_id, payment_method = p_method, paid_at = now()
   where id = o.id;
  return 'paid';
end $$;

-- Does the current user own this note (has a paid order containing it)?
create or replace function public.user_owns_note(p_user uuid, p_note uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.note_id = p_note and o.user_id = p_user and o.status = 'paid')
$$;

-- Teacher closes a slot: no new holds, and any in-progress holds are cancelled.
create or replace function public.admin_close_slot(p_slot uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.slots where id = p_slot for update;
  update public.slots set is_open = false where id = p_slot;
  update public.bookings set status = 'cancelled', cancelled_at = now(),
         admin_note = coalesce(admin_note, 'Hold cancelled: slot closed by teacher')
   where slot_id = p_slot and status = 'pending_payment';
end $$;

-- Teacher stops ALL bookings instantly.
create or replace function public.admin_set_bookings_open(p_open boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.site_settings (key, value) values ('booking', jsonb_build_object('bookings_open', p_open))
  on conflict (key) do update set value = public.site_settings.value || jsonb_build_object('bookings_open', p_open);
  if not p_open then
    -- Lock affected slots in a stable order, then cancel live holds.
    perform 1 from public.slots s where exists
      (select 1 from public.bookings b where b.slot_id = s.id and b.status = 'pending_payment')
      order by s.id for update;
    update public.bookings set status = 'cancelled', cancelled_at = now(),
           admin_note = coalesce(admin_note, 'Hold cancelled: bookings closed by teacher')
     where status = 'pending_payment';
  end if;
end $$;

-- Teacher removes a slot. Slots with booking history are archived instead of deleted.
create or replace function public.admin_remove_slot(p_slot uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.slots where id = p_slot for update;
  if exists (select 1 from public.bookings where slot_id = p_slot
             and status in ('confirmed', 'needs_review', 'completed')) then
    raise exception 'slot_has_bookings';
  end if;
  update public.bookings set status = 'cancelled', cancelled_at = now()
   where slot_id = p_slot and status = 'pending_payment';
  if exists (select 1 from public.bookings where slot_id = p_slot) then
    update public.slots set archived = true, is_open = false where id = p_slot;
    return 'archived';
  end if;
  delete from public.slots where id = p_slot;
  return 'deleted';
end $$;

-- Dashboard numbers.
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'notes_revenue_paise', (select coalesce(sum(amount_paise), 0) from orders where kind = 'notes' and status = 'paid'),
    'booking_revenue_paise', (select coalesce(sum(amount_paise), 0) from orders where kind = 'booking' and status = 'paid'),
    'refunded_paise', (select coalesce(sum(amount_paise), 0) from refunds where status in ('recorded', 'processed')),
    'notes_sold', (select count(*) from order_items oi join orders o on o.id = oi.order_id where o.status = 'paid'),
    'students', (select count(*) from profiles where role = 'student'),
    'upcoming_bookings', (select count(*) from bookings b join slots s on s.id = b.slot_id
                          where b.status = 'confirmed' and s.start_at > now()),
    'needs_review', (select count(*) from bookings where status = 'needs_review')
                    + (select count(*) from orders where kind = 'notes' and status = 'needs_review'),
    'pending_payments', (select count(*) from bookings where status = 'pending_payment' and hold_expires_at > now())
                        + (select count(*) from orders where kind = 'notes' and status = 'created'
                           and created_at > now() - interval '1 hour'),
    'open_slots', (select count(*) from slots s where not archived and is_open and start_at > now())
  );
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is callable by default.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.setting(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.booking_price_paise(text, integer) to anon, authenticated;
grant execute on function public.available_slots(text, integer) to anon, authenticated;
grant execute on function public.reserve_slot(uuid, text, integer, text, text) to authenticated;
grant execute on function public.release_booking(uuid) to authenticated;
grant execute on function public.admin_close_slot(uuid) to authenticated;
grant execute on function public.admin_set_bookings_open(boolean) to authenticated;
grant execute on function public.admin_remove_slot(uuid) to authenticated;
grant execute on function public.admin_stats() to authenticated;
-- Used inside RLS policies / triggers:
grant execute on function public.touch_updated_at() to anon, authenticated;
-- confirm_booking_payment, mark_notes_order_paid, user_owns_note, make_ref, handle_new_user:
-- service_role only (the server, after verifying with Razorpay).
grant execute on all functions in schema public to service_role;

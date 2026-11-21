-- ScoreWithScience core schema
-- Money is stored in paise (integer). ₹10 = 1000 paise.
-- All timestamps are timestamptz; the UI displays them in Asia/Kolkata.

-- ---------------------------------------------------------------------------
-- Settings (editable from the admin dashboard)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.setting(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.site_settings where key = p_key
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user). Role can only be changed by SQL / service role.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  email text,
  phone text check (phone is null or phone ~ '^[0-9+ -]{7,16}$'),
  class_level smallint check (class_level in (8, 9, 10)),
  board text check (board in ('CBSE', 'ICSE')),
  guardian_consent boolean not null default false,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- Create a profile automatically when someone signs up. Role is ALWAYS 'student'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_class smallint;
  v_board text;
  v_phone text;
begin
  begin v_class := nullif(m->>'class_level', '')::smallint; exception when others then v_class := null; end;
  if v_class not in (8, 9, 10) then v_class := null; end if;
  v_board := case when m->>'board' in ('CBSE', 'ICSE') then m->>'board' else null end;
  v_phone := nullif(regexp_replace(coalesce(m->>'phone', ''), '[^0-9+ -]', '', 'g'), '');
  if v_phone is not null and v_phone !~ '^[0-9+ -]{7,16}$' then v_phone := null; end if;

  insert into public.profiles (id, full_name, email, phone, class_level, board, guardian_consent)
  values (
    new.id,
    left(coalesce(m->>'full_name', ''), 100),
    new.email,
    v_phone,
    v_class,
    v_board,
    coalesce((m->>'guardian_consent')::boolean, false)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Notes store
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 150),
  chapter_no smallint check (chapter_no between 0 and 99),
  class_level smallint not null check (class_level in (8, 9, 10)),
  board text not null check (board in ('CBSE', 'ICSE')),
  subject text not null check (subject in ('Science', 'Chemistry', 'Physics', 'Biology')),
  description text not null default '' check (char_length(description) <= 2000),
  price_paise integer not null default 1000 check (price_paise >= 100 and price_paise <= 10000000),
  cover_path text,
  preview_paths text[] not null default '{}',
  is_published boolean not null default false,
  is_available boolean not null default false,
  pages integer check (pages is null or pages > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_filter_idx on public.notes (is_published, class_level, board, subject, chapter_no);

-- Private PDF location is kept in a separate admin-only table so it never
-- leaks through the public notes listing.
create table public.note_files (
  note_id uuid primary key references public.notes (id) on delete cascade,
  pdf_path text not null,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders and payments (notes purchases and booking payments)
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('notes', 'booking')),
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in ('created', 'paid', 'needs_review', 'refunded', 'partially_refunded', 'cancelled')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  payment_method text,
  last_error text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete restrict,
  title_snapshot text not null,
  price_paise integer not null check (price_paise >= 0),
  unique (order_id, note_id)
);
create index order_items_note_idx on public.order_items (note_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  razorpay_refund_id text unique,
  status text not null default 'recorded' check (status in ('recorded', 'pending', 'processed', 'failed')),
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Webhook de-duplication: each Razorpay event id is processed once.
create table public.webhook_events (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result text
);

-- ---------------------------------------------------------------------------
-- Teacher availability
-- ---------------------------------------------------------------------------
create table public.slots (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes integer generated always as ((extract(epoch from (end_at - start_at)) / 60)::integer) stored,
  allow_tuition boolean not null default true,
  allow_doubt boolean not null default true,
  capacity integer not null default 1 check (capacity between 1 and 50),
  is_open boolean not null default true,
  archived boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  check (end_at - start_at <= interval '4 hours'),
  check (allow_tuition or allow_doubt),
  -- The teacher can never be in two slots at once.
  constraint slots_no_overlap exclude using gist (tstzrange(start_at, end_at, '[)') with &&) where (not archived)
);
create index slots_start_idx on public.slots (start_at) where not archived;

create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  slot_id uuid not null references public.slots (id) on delete restrict,
  service text not null check (service in ('tuition', 'doubt')),
  class_level smallint not null check (class_level in (8, 9, 10)),
  board text not null check (board in ('CBSE', 'ICSE')),
  topic text check (topic is null or char_length(topic) <= 500),
  amount_paise integer not null check (amount_paise > 0),
  status text not null default 'pending_payment' check (status in (
    'pending_payment', -- slot held while the student pays
    'released',        -- student closed the payment window
    'expired',         -- hold ran out
    'confirmed',       -- paid and accepted
    'needs_review',    -- money received but slot no longer valid: teacher decides
    'cancelled',       -- cancelled by teacher
    'refunded',
    'completed'
  )),
  hold_expires_at timestamptz,
  order_id uuid references public.orders (id),
  meeting_link text,
  admin_note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);
create index bookings_slot_idx on public.bookings (slot_id, status);
create index bookings_user_idx on public.bookings (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Website content
-- ---------------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_url text not null check (youtube_url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/'),
  title text not null check (char_length(title) <= 200),
  thumbnail_url text,
  class_level smallint check (class_level in (8, 9, 10)),
  board text check (board in ('CBSE', 'ICSE')),
  chapter text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(author_name) <= 80),
  author_detail text check (char_length(author_detail) <= 120),
  quote text not null check (char_length(quote) <= 1000),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 100),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 20),
  message text not null check (char_length(message) <= 3000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger notes_touch before update on public.notes for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();

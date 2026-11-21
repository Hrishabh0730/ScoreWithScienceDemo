-- Default settings and starter content. Safe to re-run (it won't overwrite edits).
-- Everything here is editable in the admin dashboard.

insert into public.site_settings (key, value) values
('pricing', '{"note_default": 10, "tuition_per_hour": 100, "doubt_30": 50, "doubt_60": 100}'),
('booking', '{"bookings_open": true, "hold_minutes": 10, "min_notice_hours": 2, "max_days_ahead": 60}'),
('site', '{
  "tagline": "Understand Science. Improve Your Score.",
  "hero_title": "Science that finally makes sense.",
  "hero_subtitle": "Handwritten notes, one-to-one Chemistry tuition and quick doubt-solving for Classes 8, 9 and 10 — CBSE and ICSE.",
  "about": "ScoreWithScience helps students understand Science properly, not just memorise it. Clear handwritten notes, patient one-to-one Chemistry classes and fast doubt-solving — all at prices that work for Indian families.",
  "contact_email": "",
  "whatsapp_number": "",
  "youtube_channel_url": "https://www.youtube.com/@ScoreWithScience",
  "instagram_url": "",
  "facebook_url": "",
  "x_url": "",
  "telegram_url": "",
  "business_name": "ScoreWithScience",
  "business_address": "",
  "ga_measurement_id": "",
  "google_site_verification": ""
}')
on conflict (key) do nothing;

insert into public.faqs (question, answer, sort_order)
select * from (values
 ('How do I get the notes after paying?', 'As soon as your payment is confirmed, the notes appear in your account under "My notes". You can download them any time — you never pay twice for the same chapter.', 1),
 ('Are the notes for CBSE or ICSE?', 'Both. Every chapter is labelled with its class and board, and you can filter the store by class, board and subject.', 2),
 ('How do online classes happen?', 'Classes are one-to-one and online. After your booking is confirmed, the class link appears in your account before the session.', 3),
 ('What is the difference between tuition and a doubt session?', 'Tuition is a planned lesson on a chapter or topic (₹100 per hour). A doubt session is a short focused session to clear specific questions (₹50 for 30 minutes or ₹100 for 60 minutes).', 4),
 ('Which payment methods can I use?', 'UPI, debit and credit cards, net banking and wallets — whatever Razorpay offers at checkout. The amount is always shown before you pay.', 5),
 ('Can I cancel or reschedule a class?', 'Please see the Booking policy and the Refund & cancellation policy for the details, or contact us as early as possible.', 6),
 ('Is my child''s information safe?', 'We collect only what we need to run classes and deliver notes, and we never sell personal data. See our Privacy policy for details.', 7)
) as v(q, a, s)
where not exists (select 1 from public.faqs);

-- Chapter list (published but NOT available until you upload the PDF and switch it on).
-- Check chapter names against the current syllabus before going live.
insert into public.notes (title, chapter_no, class_level, board, subject, description, price_paise, is_published, is_available)
select t, n, c, b, s, d, 1000, true, false from (values
 ('Chemical Reactions and Equations', 1, 10, 'CBSE', 'Science', 'Types of reactions, balancing equations, oxidation and reduction, with exam-focused examples.'),
 ('Acids, Bases and Salts', 2, 10, 'CBSE', 'Science', 'Indicators, pH, reactions of acids and bases, and important salts.'),
 ('Metals and Non-metals', 3, 10, 'CBSE', 'Science', 'Physical and chemical properties, reactivity series, ionic compounds and extraction of metals.'),
 ('Carbon and its Compounds', 4, 10, 'CBSE', 'Science', 'Covalent bonding, homologous series, nomenclature and important carbon compounds.'),
 ('Periodic Table, Periodic Properties and Variations of Properties', 1, 10, 'ICSE', 'Chemistry', 'Modern periodic table, periodic trends and their explanations.'),
 ('Chemical Bonding', 2, 10, 'ICSE', 'Chemistry', 'Electrovalent, covalent and coordinate bonding with electron-dot diagrams.'),
 ('Acids, Bases and Salts', 3, 10, 'ICSE', 'Chemistry', 'Definitions, preparation of salts, and properties of acids and bases.'),
 ('Analytical Chemistry', 4, 10, 'ICSE', 'Chemistry', 'Action of alkalis on salt solutions and identification of ions.'),
 ('Mole Concept and Stoichiometry', 5, 10, 'ICSE', 'Chemistry', 'Gas laws, mole calculations and stoichiometry with solved numericals.'),
 ('Electrolysis', 6, 10, 'ICSE', 'Chemistry', 'Electrolytes, electrode reactions, and applications of electrolysis.')
) as v(t, n, c, b, s, d)
where not exists (select 1 from public.notes);

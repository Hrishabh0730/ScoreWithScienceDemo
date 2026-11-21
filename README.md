# ScoreWithScience — website

Notes store, Chemistry tuition and doubt-session booking with teacher-controlled availability,
Razorpay payments and an admin dashboard.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Razorpay · hosted on Netlify (recommended) or any Node host.

---

## 1. What's built

**Public site** — home page (hero with your logo, CTAs, classes/boards, notes, tuition, doubts, YouTube, testimonial placeholders, FAQ, contact), notes store with search and class/board/subject filters, chapter pages with sample previews, cart, tuition and doubt booking pages, videos page, contact form, five editable policies, SEO metadata + JSON-LD, `sitemap.xml`, `robots.txt`, mobile navigation, WhatsApp button (appears once you add a number), optional Google Analytics 4 and Search Console verification.

**Student accounts** — register (name, email, password, class, board, optional phone, parent/guardian confirmation), email confirmation, login/logout, password reset, profile edit, "My notes" downloads, upcoming classes with join link, booking history, payment history and printable receipts.

**Notes delivery** — PDFs live in a **private** bucket. Downloads go through `/api/download/:id`, which checks on the server that the student has a **paid** order for that chapter, then stamps every page with the buyer's email and order number (PDFs under 4 MB; larger files use a 60-second signed link). Multi-chapter cart, one payment. Already-owned chapters can't be bought twice.

**Booking system (teacher-controlled)**
- Nothing is bookable unless you open a slot. There is a global "Close all bookings now" switch.
- Slots: date, time, length (30/60/90/120 min), tuition and/or doubt, capacity, open/closed. Slots can never overlap.
- Block whole days or hours, close a whole day, remove slots.
- Rules: hold time while paying (default 10 min), minimum notice (default 2 h), how far ahead students can book (default 60 days).
- Flow: the student picks a slot → **the database** re-checks it and locks it (`reserve_slot`) → a Razorpay order is created for the **server-computed** price → after payment, the server verifies the signature **and** re-fetches the payment from Razorpay → the booking is confirmed only if the slot is still valid.
- If money arrives for a slot that was closed, blocked, full or cancelled in the meantime, the booking goes to **"Needs review"**. You are never forced to accept it: accept it, or cancel and refund (through Razorpay, or record a manual refund).
- Closing the payment window releases the hold at once. If the payment still completes (e.g. approved later in a UPI app) or the browser closes, the **webhook** confirms it.

**Admin dashboard** (`/admin`, admin role only) — revenue overview, notes and class revenue, students, upcoming classes, payments in progress, items needing review; availability calendar; bookings (class link, complete, accept, cancel, refund); payments (refunds); notes (upload PDF/cover/previews, publish, availability, price, bulk price); students; YouTube videos; website text, contact details, social links, prices, analytics, policies; FAQs; testimonials; contact messages; CSV export of bookings, orders and students. A banner shows whether payments are OFF, in TEST mode or LIVE.

**Security** — Row Level Security on every table; students can only read their own data and can't change roles, prices, bookings or payment status; payment-confirmation functions can only be called by the server; webhook signatures verified and every event de-duplicated; secrets only in environment variables; live payments need an explicit `ALLOW_LIVE_PAYMENTS=true`.

---

## 2. What needs your accounts / credentials

| Service | Needed for | Cost to start |
|---|---|---|
| Supabase | database, logins, file storage | Free plan |
| Razorpay | payments (test mode first, then KYC for live) | No setup fee; per-transaction fee |
| Netlify (or Vercel Pro) | hosting | Netlify Free |
| Domain registrar | your `.in` / `.com` address | ~₹600–1,000/yr renewal |
| An SMTP / email service (e.g. Resend) | **required** for students to receive signup and password-reset emails | Free tier |
| GitHub | storing the code, deploys, daily keep-alive | Free |
| Google Analytics / Search Console | optional | Free |

Never paste secret keys into chat, code or GitHub. Put them only in `.env.local` (your computer) and your host's environment-variable settings.

---

## 3. Set up Supabase (≈15 minutes)

1. Go to https://supabase.com → **New project**. Choose region **Mumbai (ap-south-1)**. Save the database password somewhere safe.
2. Open **SQL Editor** → **New query**. Paste and run each file **in this order**:
   1. `supabase/migrations/20261120000001_schema.sql`
   2. `supabase/migrations/20261120000002_booking_payment_functions.sql`
   3. `supabase/migrations/20261120000003_rls.sql`
   4. `supabase/migrations/20261120000004_storage.sql`
   5. `supabase/seed.sql` (default prices, booking rules, FAQs and a starter chapter list marked "Coming soon" — check chapter names against the current syllabus)
3. **Authentication → URL Configuration**
   - Site URL: `https://YOURDOMAIN` (use `http://localhost:3000` until you deploy)
   - Redirect URLs: add `https://YOURDOMAIN/**` and `http://localhost:3000/**`
4. **Authentication → Sign In / Providers → Email**: keep *Confirm email* ON. Minimum password length 8.
5. **Custom SMTP (required before real students sign up).** Supabase's built-in email only delivers to your own team's addresses and is heavily rate-limited. Example with Resend: create an account at resend.com, verify your domain (3 DNS records), create an SMTP password, then in Supabase **Authentication → Emails → SMTP Settings**: host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key, sender `noreply@YOURDOMAIN`. Then raise **Authentication → Rate Limits → emails per hour** to e.g. 100.
6. **Project Settings → API Keys**: copy the *Project URL*, the *publishable* (or legacy anon) key and the *secret* (or legacy service_role) key into your env file (see `.env.example`).
7. **Make yourself admin:** run the site, register with your email, confirm it, then in SQL Editor run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   Log out and back in — an **Admin** button appears.

---

## 4. Set up Razorpay (test mode first)

1. Sign up at https://dashboard.razorpay.com. Make sure the dashboard toggle says **Test Mode**.
2. **Account & Settings → API Keys → Generate Test Key.** Copy the Key ID (`rzp_test_…`) and Key Secret (shown once).
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` = Key ID · `RAZORPAY_KEY_SECRET` = Key Secret
3. **Account & Settings → Webhooks → Add New Webhook** (after you deploy — Razorpay can't reach `localhost`):
   - URL: `https://YOURDOMAIN/api/webhooks/razorpay`
   - Secret: any long random string → put the same value in `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`, `refund.failed`
4. Payment capture: leave Razorpay's default automatic capture. (The site also captures "authorized" payments itself.)
5. **Going live later:** complete Razorpay KYC/activation (PAN, bank account, business details; your site must show contact details and policies — fill those in under Admin → Website content). Then generate **live** keys, add a **separate live-mode webhook**, set the live keys in your host, set `ALLOW_LIVE_PAYMENTS=true` and redeploy. Until that variable is `true`, live keys are refused and payments stay off.

---

## 5. Run locally

```bash
npm install
cp .env.example .env.local     # fill in Supabase + Razorpay TEST keys
npm run dev                    # http://localhost:3000
npm run test                   # unit tests
npm run build                  # production build
```

---

## 6. Deploy (recommended: Netlify Free)

Vercel's free Hobby plan is for **non-commercial use only**, and this site takes payments, so on Vercel you'd need Pro (US$20/month). Netlify's free plan allows commercial projects, so start there.

1. Create a **private** GitHub repository and push this folder (`.env.local` is git-ignored — keep it that way).
2. Netlify → **Add new project → Import an existing project** → choose the repo. Netlify detects Next.js; build command `npm run build`.
3. **Site configuration → Environment variables**: add every variable from `.env.example` with your real values. Set `NEXT_PUBLIC_SITE_URL` to your Netlify URL for now (e.g. `https://scorewithscience.netlify.app`).
4. Deploy. Then update Supabase *Site URL / Redirect URLs* and add the Razorpay webhook with that URL.
5. Changing any `NEXT_PUBLIC_…` variable needs a redeploy (they are built into the pages).
6. **Keep-alive:** in GitHub → repo **Settings → Secrets and variables → Actions → Variables**, add `SITE_URL` = your site URL. The included workflow pings the site daily so the Supabase free project never pauses.

Alternatives: Vercel Pro, or any Node 20+ server/VPS with `npm run build && npm start`.

---

## 7. Connect your domain

1. Buy the domain (e.g. `scorewithscience.in`) from any registrar.
2. Netlify → **Domain management → Add a domain** → follow the DNS instructions (either point the registrar's nameservers to Netlify, or add the A/CNAME records Netlify shows). HTTPS is issued automatically.
3. Then update, everywhere: `NEXT_PUBLIC_SITE_URL` (redeploy), Supabase Site URL + Redirect URLs, the Razorpay webhook URL, and the website URL in your Razorpay account. In Google Search Console add the domain and paste the verification tag into Admin → Website content.

---

## 8. Upload handwritten notes

Admin → **Notes** → **+ Add chapter** (or **Edit** a "Coming soon" chapter):
1. Fill in title, chapter number, class, board, subject, price, description.
2. **Full notes PDF** — choose the file (max 50 MB). It goes to private storage.
3. Optional: a cover image and up to 8 sample preview pages (these are public — use pages you're happy to share).
4. Tick **Show in store** and **Available to buy**, then **Save chapter**.
Tip: scan at 150–200 dpi and compress PDFs to under 4 MB so every download gets the buyer watermark.

## 9. Open and close teaching slots

Admin → **Availability**
- **Open new slots:** pick From/To dates, a time window (IST), slot length, weekdays to repeat, which session types are allowed, max students per slot. E.g. 5–7 pm, 60 min, Mon/Wed/Fri for a month → one-hour slots on those evenings.
- **Upcoming slots:** click a slot to change types/capacity, **Close slot** (instantly stops new payments and cancels anyone mid-payment) or **Remove**. **Close whole day** closes every slot that day.
- **Block dates or hours:** for holidays/exams — slots inside are hidden and unbookable.
- **Close all bookings now:** one click stops every booking and payment site-wide. Click **Open bookings** to resume.
- **Booking rules:** payment hold time, minimum notice, how far ahead.

## 10. Manage student bookings

Admin → **Bookings** (filters: Upcoming, Needs review, Paying now, Past, Cancelled, All)
- Open a booking to see student contact details and their topic.
- **Save link:** paste your Google Meet/Zoom link — it appears as **Join class** in the student's account.
- **Mark completed**, **Cancel booking**, and **Refund** (via Razorpay, partial or full, or "record only" if you refunded by UPI yourself).
- **Needs review** = paid but the slot was no longer valid. **Accept booking** or cancel and refund.
- **Export CSV** for spreadsheets.

## 11. Test payments

With TEST keys (the admin banner says *TEST MODE*), go through a real checkout:
- **UPI:** use Razorpay's test UPI IDs (e.g. `success@razorpay` succeeds, `failure@razorpay` fails).
- **Cards:** use the test card numbers listed on Razorpay's "Test Card Details" docs page.
- Checklist: buy two chapters together → download both; book a tuition and a 30-min doubt slot; close the payment window and check the slot reappears; close a slot while a second browser is paying → it shows in *Needs review* → refund it; in Razorpay Dashboard → Webhooks, check deliveries show `200`.
- No real money moves in test mode.

---

## 12. Estimated monthly running cost (checked Nov 2026; verify before you sign up)

| Item | Starting setup | Notes |
|---|---|---|
| Hosting — Netlify Free | ₹0 | 300 credits/month: about 20 credits per GB of traffic, 15 per production deploy. Plenty for a small site with compressed PDFs; Personal plan is US$9/mo (≈₹860) if you outgrow it. Vercel Pro would be US$20/mo (≈₹1,900). |
| Database/auth/storage — Supabase Free | ₹0 | 500 MB database, 1 GB file storage (~250 PDFs of 4 MB), 5 GB egress, 50,000 monthly users. Pauses after 7 days idle (the keep-alive job prevents this). No automatic backups — export important data. Pro is US$25/mo (≈₹2,400). |
| Email — Resend Free (as SMTP) | ₹0 | 3,000 emails/month, max 100/day. |
| Domain (.in) | ≈₹50–85/month | ≈₹600–1,000/year at renewal (first-year offers are cheaper). |
| Razorpay | 2% + 18% GST per successful payment (≈2.36%) | No setup fee or annual fee on the standard plan. ₹10 note → ≈₹0.24 fee; ₹100 class → ≈₹2.36. Some premium methods (Amex, EMI, etc.) cost more. |
| **Total fixed** | **≈₹50–85/month** (just the domain) | Plus ≈2.36% of what you collect. |

When you grow: ~₹2,400/mo for Supabase Pro (backups, no pausing, 100 GB storage) and maybe ₹860/mo for Netlify Personal.

---

## 13. Known limitations / still to do

- **Tested locally, not on live services.** All database rules were tested on PostgreSQL 16 (70 checks incl. 25-way concurrent booking races), and the full site was tested in a real browser (104 checks) against the real Supabase Auth server + PostgREST with a **mock** Razorpay API and **mock** file storage. It has not yet run against your real Supabase project, real Razorpay test mode or Netlify — please do the checklist in §11 after setup.
- Razorpay Checkout's own popup could not be loaded in the test environment; it was simulated.
- PDFs over 4 MB are delivered via a 60-second signed link **without** the watermark.
- Watermarking deters sharing; it can't prevent screenshots or determined copying.
- No automatic email to *you* on new bookings — check the dashboard (booking/receipt emails to students work if you add `RESEND_API_KEY`).
- No rescheduling button — cancel + rebook, or edit via support.
- Contact form spam protection is a honeypot + simple per-IP limit.
- Policies are reasonable starting templates, not legal advice. Children's data in India falls under the DPDP Act, 2023 — have a professional review the privacy policy and parental-consent approach before launch.
- The seed chapter list covers Class 10 CBSE Science and ICSE Chemistry only; add Class 8/9 chapters from the admin panel.
- Prices: changing tuition/doubt prices affects new bookings only; existing holds keep their price.

## Project layout

```
src/app/               pages, API routes (api/), admin dashboard (admin/)
src/components/        UI components, booking flow, Razorpay checkout hook
src/lib/               config, Supabase clients, payments, watermark, formatting
supabase/migrations/   database schema, booking/payment functions, RLS, storage
supabase/seed.sql      default settings and starter content
supabase/tests/        database test suite (Python + local Postgres)
tests/                 unit tests (vitest) and the end-to-end harness (tests/e2e — paths are for the build machine; adapt before reuse)
```

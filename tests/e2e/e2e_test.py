"""End-to-end browser tests for ScoreWithScience against a local Supabase-style stack + mock Razorpay."""
import hashlib, hmac, json, re, subprocess, sys, time, uuid, urllib.request
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright, expect

APP = "http://localhost:3000"
GW = "http://localhost:54321"
RZP = "http://127.0.0.1:4010"
WEBHOOK_SECRET = "e2e_webhook_secret_abc"
KEYS = dict(l.split("=", 1) for l in open("/home/claude/work/e2e/keys.sh").read().replace("export ", "").replace('"', "").split("\n") if "=" in l)
SERVICE = KEYS["SERVICE_KEY"]
IST = timezone(timedelta(hours=5, minutes=30))
SHOTS = "/home/claude/work/e2e/shots"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  [{detail}]"), flush=True)


def sql(q):
    return subprocess.run(["psql", "-h", "/tmp", "-p", "54329", "-U", "postgres", "-d", "sws_e2e", "-tA", "-c", q], capture_output=True, text=True, check=True).stdout.strip()


def http(method, url, data=None, headers=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(data).encode() if data is not None else None, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def send_webhook(event, payment, event_id=None, bad_sig=False):
    body = json.dumps({"entity": "event", "event": event, "payload": {"payment": {"entity": payment}}, "created_at": int(time.time())}).encode()
    sig = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if bad_sig:
        sig = "0" * 64
    req = urllib.request.Request(f"{APP}/api/webhooks/razorpay", data=body, method="POST", headers={"Content-Type": "application/json", "x-razorpay-signature": sig, "x-razorpay-event-id": event_id or f"evt_{uuid.uuid4().hex[:12]}"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def rzp_state():
    return http("GET", f"{RZP}/__test/state")[1]


def safe(fn):
    def w(*a, **k):
        try:
            return fn(*a, **k)
        except Exception as e:  # noqa: BLE001
            check(f"{fn.__name__} raised", False, repr(e)[:400])
    return w


# ------------------------------------------------------------------ setup
sql("truncate public.bookings, public.orders, public.order_items, public.refunds, public.slots, public.blocked_periods, public.webhook_events, public.contact_messages, public.videos, public.testimonials cascade")
sql("delete from public.notes where title like 'Mole Concept Test Upload%'")
sql("delete from public.profiles; delete from auth.users;")
sql("update public.site_settings set value = value || '{\"bookings_open\": true, \"min_notice_hours\": 2}'::jsonb where key='booking'")
sql("update public.site_settings set value = value || '{\"whatsapp_number\": \"\"}'::jsonb where key='site'")
ADMIN_EMAIL, ADMIN_PW = "teacher@test.local", "Teacher#2026pw"
st, adm = http("POST", f"{GW}/auth/v1/admin/users", {"email": ADMIN_EMAIL, "password": ADMIN_PW, "email_confirm": True, "user_metadata": {"full_name": "Teacher"}}, {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"})
assert st == 200, adm
sql(f"update public.profiles set role='admin' where id='{adm['id']}'")
NOTE_A = sql("select id from notes where board='ICSE' and title='Chemical Bonding'")
NOTE_B = sql("select id from notes where board='CBSE' and title='Acids, Bases and Salts'")
NOTE_C = sql("select id from notes where board='CBSE' and title='Metals and Non-metals'")
for n in (NOTE_A, NOTE_B, NOTE_C):
    sql(f"insert into note_files (note_id, pdf_path, size_bytes) values ('{n}', 'notes/sample.pdf', 1139) on conflict (note_id) do update set pdf_path=excluded.pdf_path")
sql(f"update notes set is_available=true where id in ('{NOTE_A}','{NOTE_B}','{NOTE_C}')")
FAKE_JS = urllib.request.urlopen(f"{RZP}/checkout.js").read().decode()
open("/home/claude/work/e2e/mail.log", "w").close()

S1 = {"email": f"asha{uuid.uuid4().hex[:5]}@test.local", "pw": "Student#123", "name": "Asha Verma"}
S2 = {"email": f"rohan{uuid.uuid4().hex[:5]}@test.local", "pw": "Student#456", "name": "Rohan Das"}


def new_context(browser, mobile=False):
    ctx = browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1280, "height": 900}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    ctx.route("https://checkout.razorpay.com/v1/checkout.js", lambda r: r.fulfill(body=FAKE_JS, content_type="application/javascript"))
    return ctx


def wait_url(page, pred, timeout=15000):
    end = time.time() + timeout / 1000
    while time.time() < end:
        if pred(page.url):
            page.wait_for_load_state()
            return
        page.wait_for_timeout(150)
    raise TimeoutError(f"url condition not met, at {page.url}")


def submit(page, locator):
    with page.expect_navigation(timeout=15000):
        locator.click()
    page.wait_for_load_state()


def login(page, email, pw, next_path=None):
    page.goto(f"{APP}/login" + (f"?next={next_path}" if next_path else ""))
    page.fill("#email", email)
    page.fill("#password", pw)
    page.click("button:has-text('Log in')")
    wait_url(page, lambda u: "/login" not in u)


def logout(page):
    page.goto(f"{APP}/account")
    page.click("button:has-text('Log out')")
    wait_url(page, lambda u: u.rstrip("/") == APP)
    page.get_by_role("link", name="Log in").first.wait_for(timeout=10000)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True)

    # ------------------------------------------------ public pages + mobile
    @safe
    def public_pages():
        ctx = new_context(browser, mobile=True)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        for path, text in [("/", "Explore Notes"), ("/notes", "Handwritten notes"), ("/tuition", "One-to-one"), ("/doubts", "doubts"), ("/videos", "Video lessons"), ("/contact", "here to help"), ("/policies/privacy", "What we collect"), ("/book", "What would you like")]:
            r = page.goto(APP + path)
            ok = r.status == 200 and page.get_by_text(text, exact=False).first.is_visible()
            check(f"page {path} renders on mobile", ok, f"status {r.status}")
            overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"page {path} has no horizontal overflow on 390px", overflow <= 1, f"overflow {overflow}px")
        page.goto(APP + "/")
        page.screenshot(path=f"{SHOTS}/m-home.png", full_page=True)
        page.wait_for_load_state("networkidle")
        page.click("button[aria-label='Open menu']")
        page.locator("#mobile-nav").wait_for(timeout=5000)
        check("mobile menu opens", page.locator("#mobile-nav").is_visible())
        page.goto(APP + "/notes")
        page.screenshot(path=f"{SHOTS}/m-notes.png", full_page=True)
        check("no client JS errors on public pages", not errors, "; ".join(errors)[:300])
        for path in ["/sitemap.xml", "/robots.txt"]:
            r = page.goto(APP + path)
            check(f"{path} served", r.status == 200)
        check("sitemap lists note pages", "/notes/" in page.goto(APP + "/sitemap.xml").text())
        html = urllib.request.urlopen(APP + "/").read().decode()
        check("home has SEO title + description + JSON-LD", "<title>ScoreWithScience" in html and 'name="description"' in html and "application/ld+json" in html)
        ctx.close()
    public_pages()

    # ------------------------------------------------ registration / login / logout / recovery
    @safe
    def auth_flow():
        ctx = new_context(browser)
        page = ctx.new_page()
        page.goto(APP + "/register")
        page.fill("#full_name", S1["name"]); page.fill("#email", S1["email"]); page.fill("#password", S1["pw"])
        page.select_option("#class_level", "10"); page.select_option("#board", "ICSE")
        page.check("input[name=guardian_consent]"); page.check("input[name=terms]")
        page.click("button:has-text('Create account')")
        page.wait_for_url(re.compile("/account"), timeout=15000)
        check("student registration -> account page", page.get_by_role("heading", name=re.compile("Hi Asha")).is_visible())
        prof = sql(f"select full_name||'|'||class_level||'|'||board||'|'||guardian_consent||'|'||role from profiles where email='{S1['email']}'")
        check("profile stored with class/board/consent, role student", prof == "Asha Verma|10|ICSE|true|student", prof)
        logout(page)
        check("logout returns home and shows Log in", page.get_by_role("link", name="Log in").first.is_visible())
        page.goto(APP + "/login")
        page.fill("#email", S1["email"]); page.fill("#password", "wrong-password")
        page.click("button:has-text('Log in')")
        page.get_by_text("Email or password is incorrect").wait_for(timeout=10000)
        check("wrong password rejected", "/login" in page.url)
        login(page, S1["email"], S1["pw"])
        check("login works", "/account" in page.url)
        logout(page)
        # Password recovery via emailed link
        page.goto(APP + "/forgot-password")
        page.fill("#email", S1["email"])
        page.click("button:has-text('Send reset link')")
        page.get_by_text("reset link is on its way").wait_for(timeout=10000)
        time.sleep(1.5)
        mail = open("/home/claude/work/e2e/mail.log").read()
        links = re.findall(r'href="([^"]+verify[^"]+)"', mail.replace("=\r\n", "").replace("=\n", "").replace("=3D", "="))
        check("password reset email sent", bool(links), mail[-300:])
        link = links[-1].replace("&amp;", "&")
        page.goto(link)
        page.wait_for_url(re.compile("/reset-password"), timeout=15000)
        page.fill("#password", "NewPass#789"); page.fill("#confirm", "NewPass#789")
        page.click("button:has-text('Save new password')")
        page.wait_for_url(re.compile("/account"), timeout=15000)
        check("password reset completes", page.get_by_text("password has been updated").is_visible())
        S1["pw"] = "NewPass#789"
        logout(page)
        login(page, S1["email"], S1["pw"])
        check("login with new password", "/account" in page.url)
        ctx.close()
        # second student (registered by UI as well)
        ctx = new_context(browser); page = ctx.new_page()
        page.goto(APP + "/register")
        page.fill("#full_name", S2["name"]); page.fill("#email", S2["email"]); page.fill("#password", S2["pw"])
        page.select_option("#class_level", "9"); page.select_option("#board", "CBSE")
        page.check("input[name=guardian_consent]"); page.check("input[name=terms]")
        page.click("button:has-text('Create account')")
        page.wait_for_url(re.compile("/account"), timeout=15000)
        ctx.close()
    auth_flow()

    # ------------------------------------------------ admin access restrictions
    @safe
    def admin_restrictions():
        ctx = new_context(browser); page = ctx.new_page()
        page.goto(APP + "/admin")
        check("anonymous /admin -> login", "/login" in page.url)
        r = ctx.request.get(APP + "/api/admin/export?type=students")
        check("anonymous CSV export forbidden", r.status == 403)
        login(page, S1["email"], S1["pw"])
        page.goto(APP + "/admin/availability")
        check("student /admin -> account with notice", "/account" in page.url and page.get_by_text("administrator only").is_visible())
        r = ctx.request.get(APP + "/api/admin/export?type=bookings")
        check("student CSV export forbidden", r.status == 403)
        ctx.close()
    admin_restrictions()

    # ------------------------------------------------ admin: open slots via UI
    tomorrow = (datetime.now(IST) + timedelta(days=1)).strftime("%Y-%m-%d")
    day2 = (datetime.now(IST) + timedelta(days=2)).strftime("%Y-%m-%d")

    @safe
    def admin_availability():
        ctx = new_context(browser); page = ctx.new_page()
        login(page, ADMIN_EMAIL, ADMIN_PW, "/admin")
        check("admin can open dashboard", page.get_by_role("heading", name="Overview").is_visible())
        page.goto(APP + "/admin/availability")
        f = page.locator("form:has(button:has-text('Open slots'))")
        f.locator("input[name=date_from]").fill(tomorrow)
        f.locator("input[name=start_time]").fill("17:00"); f.locator("input[name=end_time]").fill("19:00")
        f.locator("select[name=slot_minutes]").select_option("60")
        submit(page, f.locator("button:has-text('Open slots')"))
        check("admin opens 2 x 60-min slots", page.get_by_text("2 slot(s) opened").is_visible())
        f = page.locator("form:has(button:has-text('Open slots'))")
        f.locator("input[name=date_from]").fill(day2)
        f.locator("input[name=start_time]").fill("10:00"); f.locator("input[name=end_time]").fill("11:00")
        f.locator("select[name=slot_minutes]").select_option("30")
        f.locator("input[name=allow_tuition]").uncheck()
        submit(page, f.locator("button:has-text('Open slots')"))
        check("admin opens 2 x 30-min doubt-only slots", page.get_by_text("2 slot(s) opened").is_visible())
        # overlapping creation is skipped
        f = page.locator("form:has(button:has-text('Open slots'))")
        f.locator("input[name=date_from]").fill(tomorrow)
        f.locator("input[name=start_time]").fill("17:30"); f.locator("input[name=end_time]").fill("18:30")
        f.locator("select[name=slot_minutes]").select_option("60")
        submit(page, f.locator("button:has-text('Open slots')"))
        check("overlapping slot creation is refused", page.get_by_text("No future slots fit").is_visible() or page.get_by_text("0 slot(s) opened").is_visible() or page.get_by_text("skipped").is_visible())
        n = sql("select count(*) from slots where not archived")
        check("4 slots exist in DB", n == "4", n)
        page.screenshot(path=f"{SHOTS}/d-admin-availability.png", full_page=True)
        ctx.close()
    admin_availability()

    # ------------------------------------------------ notes purchase (multi-item), download, restrictions
    @safe
    def notes_purchase():
        ctx = new_context(browser); page = ctx.new_page()
        login(page, S1["email"], S1["pw"])
        page.goto(APP + "/notes?board=ICSE")
        check("filter by board shows only ICSE", page.locator("article").count() >= 1 and page.locator("article:has-text('CBSE')").count() == 0)
        page.goto(APP + "/notes?q=bonding")
        check("search finds Chemical Bonding", page.locator("article:has-text('Chemical Bonding')").count() == 1)
        page.goto(APP + "/notes?q=electrolysis")
        check("unavailable chapter shows Coming soon", page.locator("article:has-text('Coming soon')").count() == 1)
        for nid in (NOTE_A, NOTE_B):
            page.goto(f"{APP}/notes/{nid}")
            page.click("button:has-text('Add to cart')")
            page.get_by_role("link", name="Go to cart →").wait_for()
        page.goto(APP + "/cart")
        page.get_by_role("button", name=re.compile("Pay ₹20")).wait_for(timeout=10000)
        check("cart shows 2 items and total ₹20", page.locator("li:has-text('Remove')").count() == 2)
        page.screenshot(path=f"{SHOTS}/d-cart.png", full_page=True)
        page.click("button:has-text('Pay ₹20')")
        page.wait_for_url(re.compile("/checkout/complete"), timeout=20000)
        check("multi-chapter purchase succeeds", page.get_by_role("heading", name=re.compile("Your notes are ready")).is_visible())
        last = page.evaluate("window.__RZP_LAST") if False else None
        o = sql(f"select status||'|'||amount_paise||'|'||(select count(*) from order_items where order_id=o.id) from orders o join profiles p on p.id=o.user_id where p.email='{S1['email']}' and kind='notes'")
        check("order paid, ₹20 (2000 paise), 2 items", o == "paid|2000|2", o)
        page.goto(APP + "/account")
        check("account lists both purchased notes", page.locator("a:has-text('Download PDF')").count() == 2)
        with page.expect_download() as dl:
            page.locator("a:has-text('Download PDF')").first.click()
        path = dl.value.path()
        data = open(path, "rb").read()
        check("download is a PDF", data[:5] == b"%PDF-")
        import pypdf
        txt = "\n".join(pg.extract_text() for pg in pypdf.PdfReader(path).pages)
        order_no = sql(f"select order_number from orders o join profiles p on p.id=o.user_id where p.email='{S1['email']}' and kind='notes' limit 1")
        check("PDF watermarked with buyer email + order number on every page", order_no in txt and S1["email"] in txt and txt.count("Licensed to") >= 4, txt[:300])
        # receipt
        page.goto(f"{APP}/account/receipt/{order_no}")
        check("receipt page shows total", page.get_by_text("Total paid").is_visible() and page.get_by_text("₹20").first.is_visible())
        # Owning: second purchase of same note blocked
        r = ctx.request.post(APP + "/api/notes/checkout", data={"noteIds": [NOTE_A]})
        check("cannot buy an already-owned note again", r.status == 409 and "already own" in r.json()["error"], r.text())
        # Unavailable / unpublished / fake note
        r = ctx.request.post(APP + "/api/notes/checkout", data={"noteIds": [str(uuid.uuid4())]})
        check("checkout rejects unknown note", r.status == 409)
        no_pdf = sql("select id from notes where title='Electrolysis'")
        r = ctx.request.post(APP + "/api/notes/checkout", data={"noteIds": [no_pdf]})
        check("checkout rejects unavailable note", r.status == 409)
        # Price manipulation: extra fields ignored, amount from DB
        before = len(rzp_state()["orders"])
        r = ctx.request.post(APP + "/api/notes/checkout", data={"noteIds": [NOTE_C], "amount": 1, "price_paise": 1})
        st = rzp_state()["orders"]
        check("server ignores client price; Razorpay order = DB price (₹10)", r.status == 200 and r.json()["amount"] == 1000 and st[-1]["amount"] == 1000 and len(st) == before + 1, r.text())
        ctx.close()

        # Student 2: no access to S1's notes, anonymous no access
        ctx2 = new_context(browser); p2 = ctx2.new_page()
        r = ctx2.request.get(f"{APP}/api/download/{NOTE_A}")
        check("anonymous cannot download notes", r.status == 401)
        login(p2, S2["email"], S2["pw"])
        r = ctx2.request.get(f"{APP}/api/download/{NOTE_A}")
        check("unpaid student cannot download notes", r.status == 403)
        r = ctx2.request.get(f"{GW}/storage/v1/object/public/notes-pdf/notes/sample.pdf")
        # (mock storage has no auth on reads; in Supabase the bucket is private — verified by bucket config below)
        check("notes-pdf bucket configured PRIVATE", sql("select public from storage.buckets where id='notes-pdf'") == "f")
        # Failed payment
        p2.goto(f"{APP}/notes/{NOTE_C}"); p2.click("button:has-text('Add to cart')")
        p2.goto(APP + "/cart"); p2.get_by_role("button", name=re.compile("Pay ₹10")).wait_for()
        p2.evaluate("window.__RZP_MODE='fail'")
        p2.click("button:has-text('Pay ₹10')")
        p2.get_by_text("Payment failed").wait_for(timeout=10000)
        check("failed payment shows message, no access", ctx2.request.get(f"{APP}/api/download/{NOTE_C}").status == 403)
        # Paid but browser closed -> webhook confirms
        p2.evaluate("window.__RZP_MODE='paid_then_closed'")
        p2.click("button:has-text('Pay ₹10')")
        p2.get_by_text("Payment window closed").wait_for(timeout=10000)
        paid = p2.evaluate("window.__RZP_PAID")
        check("before webhook: still no access", ctx2.request.get(f"{APP}/api/download/{NOTE_C}").status == 403)
        code, j = send_webhook("payment.captured", paid["payment"], bad_sig=True)
        check("webhook with bad signature rejected", code == 400, j)
        eid = f"evt_{uuid.uuid4().hex[:10]}"
        code, j = send_webhook("payment.captured", paid["payment"], event_id=eid)
        check("webhook confirms payment after browser closed", code == 200 and j.get("result") == "paid", j)
        check("after webhook: access granted", ctx2.request.get(f"{APP}/api/download/{NOTE_C}").status == 200)
        code, j = send_webhook("payment.captured", paid["payment"], event_id=eid)
        check("duplicate webhook event ignored", code == 200 and j.get("duplicate") is True, j)
        code, j = send_webhook("order.paid", paid["payment"])
        check("different event for same payment is idempotent", code == 200 and str(j.get("result", "")).startswith("already_processed"), j)
        n = sql(f"select count(*) from orders where razorpay_payment_id='{paid['razorpay_payment_id']}'")
        check("payment recorded exactly once", n == "1", n)
        # Wrong amount reported by gateway -> needs review, no access
        p2.goto(f"{APP}/notes/{NOTE_A}"); p2.click("button:has-text('Add to cart')")
        p2.goto(APP + "/cart"); p2.get_by_role("button", name=re.compile("Pay ₹10")).wait_for()
        p2.evaluate("window.__RZP_MODE='wrong_amount'")
        p2.click("button:has-text('Pay ₹10')")
        p2.wait_for_url(re.compile("/checkout/complete"), timeout=20000)
        check("amount mismatch from gateway -> order under review, no access", ctx2.request.get(f"{APP}/api/download/{NOTE_A}").status == 403 and sql(f"select count(*) from orders o join profiles p on p.id=o.user_id where p.email='{S2['email']}' and o.status='needs_review'") == "1")
        # Forged verify (bad signature)
        r = ctx2.request.post(APP + "/api/payments/verify", data={"razorpay_order_id": "order_x1234", "razorpay_payment_id": "pay_x1234", "razorpay_signature": "f" * 64})
        check("forged payment signature rejected", r.status == 400)
        ctx2.close()
    notes_purchase()

    # ------------------------------------------------ bookings
    @safe
    def bookings():
        ctx = new_context(browser); page = ctx.new_page()
        login(page, S1["email"], S1["pw"])
        page.goto(APP + "/tuition")
        page.get_by_role("radio", name="Class 10").click()
        page.get_by_role("radio", name="ICSE").click()
        page.locator("#book [aria-label=Date] button").first.click()
        slot_btns = page.locator("#book [aria-label=Time] button")
        check("tuition shows the 2 open 60-min slots for tomorrow", slot_btns.count() == 2, str(slot_btns.count()))
        slot_btns.first.click()
        check("summary shows duration & price", page.get_by_text("1 hr").first.is_visible() and page.get_by_role("button", name="Reserve & pay ₹100").is_visible())
        page.screenshot(path=f"{SHOTS}/d-tuition-booking.png", full_page=True)
        page.click("button:has-text('Reserve & pay ₹100')")
        page.wait_for_url(re.compile("/checkout/complete"), timeout=20000)
        check("tuition booking confirmed after payment", page.get_by_role("heading", name=re.compile("Your class is booked")).is_visible())
        last = page.evaluate("1")
        b = sql(f"select b.status||'|'||b.amount_paise||'|'||o.status from bookings b join orders o on o.id=b.order_id join profiles p on p.id=b.user_id where p.email='{S1['email']}'")
        check("booking confirmed, ₹100, order paid", b == "confirmed|10000|paid", b)
        page.goto(APP + "/account")
        check("upcoming classes shows booking", page.locator("#upcoming").get_by_text("Chemistry tuition").is_visible())
        booked_slot = sql(f"select slot_id from bookings b join profiles p on p.id=b.user_id where p.email='{S1['email']}' and status='confirmed'")
        # Same slot from another student: hidden + rejected
        ctx2 = new_context(browser); p2 = ctx2.new_page()
        login(p2, S2["email"], S2["pw"])
        slots = ctx2.request.get(APP + "/api/slots?service=tuition").json()["slots"]
        check("booked slot no longer offered to others", booked_slot not in [s["slot_id"] for s in slots] and len(slots) == 1, json.dumps(slots)[:200])
        before = len(rzp_state()["orders"])
        r = ctx2.request.post(APP + "/api/bookings/reserve", data={"slotId": booked_slot, "service": "tuition", "classLevel": 9, "board": "CBSE"})
        check("attempt to book a full slot is rejected", r.status == 409 and "someone just booked" in r.json()["error"], r.text())
        check("no payment order created for full slot", len(rzp_state()["orders"]) == before)
        # Doubt slot on a tuition-only... and nonexistent slot
        r = ctx2.request.post(APP + "/api/bookings/reserve", data={"slotId": str(uuid.uuid4()), "service": "doubt", "classLevel": 9, "board": "CBSE"})
        check("unknown slot id rejected", r.status == 409)
        r = ctx2.request.post(APP + "/api/bookings/reserve", data={"slotId": booked_slot, "service": "tuition", "classLevel": 11, "board": "CBSE"})
        check("invalid class rejected by validation", r.status == 400)
        # Doubt 30-min via UI
        p2.goto(APP + "/doubts")
        p2.get_by_role("radio", name="Class 9").click(); p2.get_by_role("radio", name="CBSE").click()
        p2.get_by_role("radio", name="30 min").click()
        p2.locator("#book [aria-label=Date] button").first.click()
        check("doubt shows 30-min slots only (tuition-only slots excluded)", p2.locator("#book [aria-label=Time] button").count() == 2)
        p2.locator("#book [aria-label=Time] button").first.click()
        p2.fill("#book textarea", "Balancing redox equations")
        p2.click("button:has-text('Reserve & pay ₹50')")
        p2.wait_for_url(re.compile("/checkout/complete"), timeout=20000)
        check("doubt session (30 min, ₹50) booked", p2.get_by_role("heading", name=re.compile("Your class is booked")).is_visible() and sql(f"select amount_paise||'|'||topic from bookings b join profiles p on p.id=b.user_id where p.email='{S2['email']}' and status='confirmed'") == "5000|Balancing redox equations")
        # Dismiss releases hold
        p2.goto(APP + "/doubts")
        p2.get_by_role("radio", name="30 min").click()
        p2.locator("#book [aria-label=Date] button").first.click()
        p2.locator("#book [aria-label=Time] button").first.click()
        p2.evaluate("window.__RZP_MODE='dismiss'")
        p2.click("button:has-text('Reserve & pay ₹50')")
        p2.get_by_text("slot was released").wait_for(timeout=10000)
        check("closing payment window releases the hold", sql("select count(*) from bookings where status='pending_payment' and hold_expires_at>now()") == "0")
        # Admin closes the slot while a student is paying -> needs review, refund
        remaining = ctx2.request.get(APP + "/api/slots?service=tuition").json()["slots"][0]["slot_id"]
        r = ctx2.request.post(APP + "/api/bookings/reserve", data={"slotId": remaining, "service": "tuition", "classLevel": 9, "board": "CBSE"})
        check("hold created for remaining slot", r.status == 200, r.text())
        hold = r.json()
        check("payment window timeout set within hold period", 60 <= hold["timeoutSeconds"] <= 600, hold["timeoutSeconds"])
        actx = new_context(browser); ap = actx.new_page()
        login(ap, ADMIN_EMAIL, ADMIN_PW, "/admin")
        ap.goto(APP + "/admin/availability")
        ap.on("dialog", lambda d: d.accept())
        row = ap.locator("details:has-text('paying now')").first
        row.locator("summary").click()
        row.locator("button:has-text('Close slot')").click()
        ap.get_by_text("Slot closed").wait_for(timeout=10000)
        check("admin closing slot cancels in-progress hold", sql(f"select status from bookings where id='{hold['bookingId']}'") == "cancelled")
        slots_now = ctx2.request.get(APP + "/api/slots?service=tuition").json()["slots"]
        check("closed slot hidden from students", remaining not in [s["slot_id"] for s in slots_now])
        r2 = ctx2.request.post(APP + "/api/bookings/reserve", data={"slotId": remaining, "service": "tuition", "classLevel": 9, "board": "CBSE"})
        check("cannot start payment for a closed slot", r2.status == 409 and "closed" in r2.json()["error"], r2.text())
        # the student's payment completes anyway (was already in progress)
        code, paid = http("GET", f"{RZP}/__test/pay?order_id={hold['razorpayOrderId']}")
        r3 = ctx2.request.post(APP + "/api/payments/verify", data={k: paid[k] for k in ("razorpay_order_id", "razorpay_payment_id", "razorpay_signature")})
        check("late payment for closed slot -> needs_review (teacher not forced)", r3.json().get("status") == "needs_review", r3.text())
        ap.goto(APP + "/admin/bookings?status=needs_review")
        check("admin sees booking needing review", ap.get_by_text("Payment received after this hold was cancelled").first.is_visible())
        ap.screenshot(path=f"{SHOTS}/d-admin-review.png", full_page=True)
        f = ap.locator("form:has(button:has-text('Refund'))").first
        f.locator("select[name=mode]").select_option("razorpay")
        f.locator("button:has-text('Refund')").click()
        ap.get_by_text("Refund sent through Razorpay").wait_for(timeout=10000)
        st = sql(f"select b.status||'|'||o.status||'|'||(select count(*) from refunds r where r.order_id=o.id) from bookings b join orders o on o.id=b.order_id where b.id='{hold['bookingId']}'")
        check("refund issued via Razorpay and recorded", st == "refunded|refunded|1", st)
        check("Razorpay refund API was called", any(e["path"].endswith("/refund") for e in rzp_state()["log"]))
        # Global close
        ap.goto(APP + "/admin/availability")
        ap.click("button:has-text('Close all bookings now')")
        ap.get_by_text("All bookings CLOSED").wait_for(timeout=10000)
        check("global close hides all slots", ctx2.request.get(APP + "/api/slots?service=doubt").json()["slots"] == [])
        any_slot = sql("select id from slots where is_open and start_at > now() limit 1")
        r4 = ctx2.request.post(APP + "/api/bookings/reserve", data={"slotId": any_slot, "service": "doubt", "classLevel": 9, "board": "CBSE"})
        check("global close blocks payment start", r4.status == 409 and "closed" in r4.json()["error"].lower(), r4.text())
        ap.click("button:has-text('Open bookings')")
        ap.get_by_text("Bookings are OPEN").first.wait_for(timeout=10000)
        check("reopening restores slots", len(ctx2.request.get(APP + "/api/slots?service=doubt").json()["slots"]) >= 1)
        # Block a date
        ap.goto(APP + "/admin/availability")
        bf = ap.locator("#blocks form")
        bf.locator("input[name=day]").fill(day2)
        bf.locator("button:has-text('Block')").click()
        ap.get_by_text("Time blocked").wait_for(timeout=10000)
        check("blocked date hides its slots", ctx2.request.get(APP + "/api/slots?service=doubt").json()["slots"] == [])
        # admin meeting link + student sees join button
        ap.goto(APP + "/admin/bookings?status=upcoming")
        d = ap.locator("details:has-text('Asha')").first
        d.locator("summary").click()
        d.locator("input[name=meeting_link]").fill("https://meet.google.com/abc-defg-hij")
        d.locator("button:has-text('Save link')").click()
        ap.get_by_text("Booking updated").wait_for(timeout=10000)
        page.goto(APP + "/account")
        check("student sees Join class link", page.get_by_role("link", name="Join class").is_visible())
        # CSV export
        r = actx.request.get(APP + "/api/admin/export?type=bookings")
        check("admin CSV export of bookings", r.status == 200 and "booking_number" in r.text() and "Asha" in r.text())
        r = actx.request.get(APP + "/api/admin/export?type=orders")
        check("admin CSV export of orders", r.status == 200 and "SWS-N-" in r.text())
        ap.goto(APP + "/admin")
        check("dashboard shows revenue", ap.get_by_text("Total revenue").is_visible())
        ap.screenshot(path=f"{SHOTS}/d-admin-overview.png", full_page=True)
        for c in (ctx, ctx2, actx):
            c.close()
    bookings()

    # ------------------------------------------------ admin notes upload + content + contact
    @safe
    def admin_content():
        actx = new_context(browser); ap = actx.new_page()
        login(ap, ADMIN_EMAIL, ADMIN_PW, "/admin")
        ap.goto(APP + "/admin/notes/new")
        ap.fill("input[name=title]", "Mole Concept Test Upload")
        ap.fill("input[name=chapter_no]", "5")
        ap.select_option("select[name=class_level]", "10"); ap.select_option("select[name=board]", "ICSE")
        ap.fill("textarea[name=description]", "Uploaded in E2E test")
        ap.locator("input[type=file][accept='application/pdf']").set_input_files("/home/claude/work/e2e/upload-test.pdf")
        ap.get_by_text("PDF uploaded").or_(ap.get_by_text("upload-test.pdf")).first.wait_for(timeout=15000)
        ap.check("input[name=is_available]")
        ap.click("button:has-text('Save chapter')")
        ap.get_by_text("Saved.").wait_for(timeout=10000)
        nid = sql("select id from notes where title='Mole Concept Test Upload'")
        check("admin uploads PDF + creates chapter", bool(nid) and sql(f"select count(*) from note_files where note_id='{nid}'") == "1")
        ap.goto(APP + "/notes?q=Mole%20Concept%20Test")
        check("uploaded chapter visible & available in store", ap.locator("article:has-text('Available')").count() == 1)
        # Student can't upload to storage
        sctx = new_context(browser); sp = sctx.new_page(); login(sp, S2["email"], S2["pw"])
        res = sp.evaluate("""async () => { const { createBrowserClient } = await import('/_next/static/chunks/doesnotexist.js').catch(()=>({})); return null; }""")
        token = None
        for c in sctx.cookies():
            if c["name"].startswith("sb-") and "auth-token" in c["name"]:
                token = c["value"]
        import base64 as b64
        raw = token[len("base64-"):] if token and token.startswith("base64-") else token
        sess = json.loads(b64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))) if raw else {}
        req = urllib.request.Request(f"{GW}/storage/v1/object/notes-pdf/notes/evil.pdf", data=b"%PDF-evil", method="POST", headers={"Authorization": f"Bearer {sess.get('access_token','')}", "apikey": KEYS['ANON_KEY']})
        try:
            urllib.request.urlopen(req); code = 200
        except urllib.error.HTTPError as e:
            code = e.code
        check("student cannot upload to notes storage", code == 403, code)
        # price change
        ap.goto(f"{APP}/admin/notes/{nid}")
        ap.fill("input[name=price]", "15")
        ap.click("button:has-text('Save chapter')")
        ap.get_by_text("Saved.").wait_for()
        check("admin changes chapter price", sql(f"select price_paise from notes where id='{nid}'") == "1500")
        # content: whatsapp + youtube video + faq
        ap.goto(APP + "/admin/content")
        ap.fill("input[name=whatsapp_number]", "+91 90000 00000")
        ap.click("button:has-text('Save website content')")
        ap.get_by_text("Website content saved").wait_for()
        ap.goto(APP + "/admin/videos")
        ap.fill("input[name=youtube_url]", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        ap.fill("input[name=title]", "Periodic Classification Part 1")
        ap.locator("button:has-text('Save')").first.click()
        ap.get_by_text("Saved.").wait_for()
        time.sleep(1)
        hp = sctx.new_page(); hp.goto(APP + "/")
        check("WhatsApp button appears after admin edit", hp.locator("a[aria-label='Chat with us on WhatsApp']").count() == 1)
        check("YouTube video appears on home page", hp.get_by_text("Periodic Classification Part 1").is_visible())
        # contact form
        hp.goto(APP + "/contact")
        hp.fill("#c-name", "Parent Test"); hp.fill("#c-email", "parent@test.local"); hp.fill("#c-msg", "When is the next batch?")
        hp.click("button:has-text('Send message')")
        hp.get_by_text("message received").wait_for(timeout=10000)
        ap.goto(APP + "/admin/messages")
        check("contact message reaches admin", ap.get_by_text("When is the next batch?").is_visible())
        # policy edit
        ap.goto(APP + "/admin/content#policies")
        d = ap.locator("details:has-text('Booking policy')")
        d.locator("summary").click()
        d.locator("textarea").fill("## Test heading\n\n- Custom booking rule for E2E")
        d.locator("button:has-text('Save')").click()
        ap.get_by_text("Policy saved").wait_for()
        hp.goto(APP + "/policies/booking")
        check("edited policy is shown", hp.get_by_text("Custom booking rule for E2E").is_visible())
        sctx.close(); actx.close()
    admin_content()

    # desktop screenshots
    @safe
    def shots():
        ctx = new_context(browser); page = ctx.new_page()
        for path, name in [("/", "d-home"), ("/notes", "d-notes"), (f"/notes/{NOTE_A}", "d-note"), ("/doubts", "d-doubts")]:
            page.goto(APP + path)
            page.screenshot(path=f"{SHOTS}/{name}.png", full_page=True)
        login(page, S1["email"], S1["pw"])
        page.screenshot(path=f"{SHOTS}/d-account.png", full_page=True)
        ctx.close()
        mctx = new_context(browser, mobile=True); mp = mctx.new_page()
        login(mp, S1["email"], S1["pw"])
        mp.screenshot(path=f"{SHOTS}/m-account.png", full_page=True)
        mp.goto(APP + "/tuition")
        mp.screenshot(path=f"{SHOTS}/m-tuition.png", full_page=True)
        mctx.close()
    shots()

    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
for f in failed:
    print("FAILED:", f[0], f[2])
sys.exit(1 if failed else 0)

"""
Database-level tests for availability, booking, payment and permission rules.

Runs against a local PostgreSQL that has the Supabase stub + all migrations applied
(see supabase/tests/README.md). Usage:
    DATABASE_URL=postgresql://postgres@localhost:54329/sws_test python3 supabase/tests/test_booking_db.py
"""
import os
import sys
import threading
import uuid

import psycopg

DSN = os.environ.get("DATABASE_URL", "host=/tmp port=54329 user=postgres dbname=sws")
results = []


def conn():
    c = psycopg.connect(DSN, autocommit=False)
    return c


def as_user(cur, uid):
    cur.execute("select set_config('role', 'authenticated', true), set_config('request.jwt.claim.sub', %s, true)", (str(uid),))


def as_anon(cur):
    cur.execute("select set_config('role', 'anon', true), set_config('request.jwt.claim.sub', '', true)")


def as_service(cur):
    cur.execute("select set_config('role', 'service_role', true), set_config('request.jwt.claim.sub', '', true)")


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))


def run(uid, sql, params=None, role="user"):
    """Run one statement in its own transaction as the given role. Returns (rows, error)."""
    with conn() as c:
        with c.cursor() as cur:
            try:
                if role == "user":
                    as_user(cur, uid)
                elif role == "anon":
                    as_anon(cur)
                elif role == "service":
                    as_service(cur)
                cur.execute(sql, params)
                rows = cur.fetchall() if cur.description else []
                c.commit()
                return rows, None
            except Exception as e:  # noqa: BLE001
                c.rollback()
                return None, str(e).splitlines()[0]


def admin_sql(sql, params=None):
    rows, err = run(None, sql, params, role="postgres")
    if err:
        raise RuntimeError(err)
    return rows


def new_user(email, meta=None):
    import json
    uid = uuid.uuid4()
    admin_sql("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s)",
              (uid, email, json.dumps(meta or {"full_name": email.split('@')[0], "class_level": "10", "board": "CBSE"})))
    return uid


def make_slot(admin, start_offset, minutes=60, capacity=1, tuition=True, doubt=True):
    rows, err = run(admin, """insert into slots (start_at, end_at, capacity, allow_tuition, allow_doubt)
        values (now() + %s::interval, now() + %s::interval + make_interval(mins => %s), %s, %s, %s) returning id""",
                    (start_offset, start_offset, minutes, capacity, tuition, doubt))
    if err:
        raise RuntimeError(err)
    return rows[0][0]


def reserve(uid, slot, service="doubt"):
    return run(uid, "select id, status, amount_paise from reserve_slot(%s, %s, 10, 'CBSE', 'test')", (slot, service))


def attach_order(booking_id, uid, amount):
    rows = admin_sql("""insert into orders (order_number, user_id, kind, amount_paise, razorpay_order_id)
        values (make_ref('SWS-B'), %s, 'booking', %s, %s) returning id""", (uid, amount, "order_" + uuid.uuid4().hex[:12]))
    admin_sql("update bookings set order_id = %s where id = %s", (rows[0][0], booking_id))
    return rows[0][0]


def confirm(booking_id, amount, pay_id=None):
    return run(None, "select confirm_booking_payment(%s, %s, %s, 'upi')",
               (booking_id, pay_id or "pay_" + uuid.uuid4().hex[:12], amount), role="service")


def main():
    # Fresh data
    admin_sql("truncate bookings, orders, order_items, refunds, slots, blocked_periods, webhook_events, contact_messages cascade")
    admin_sql("update site_settings set value = value || '{\"bookings_open\": true}' where key = 'booking'")

    a = new_user(f"a{uuid.uuid4().hex[:6]}@t.in")
    b = new_user(f"b{uuid.uuid4().hex[:6]}@t.in")
    adm = new_user(f"admin{uuid.uuid4().hex[:6]}@t.in")
    admin_sql("update profiles set role = 'admin' where id = %s", (adm,))

    # --- profile & role protection
    p = admin_sql("select role, class_level, board from profiles where id = %s", (a,))[0]
    check("signup creates student profile from metadata", p == ("student", 10, "CBSE"), str(p))
    evil = new_user(f"e{uuid.uuid4().hex[:6]}@t.in", {"full_name": "x", "role": "admin"})
    check("signup metadata cannot grant admin", admin_sql("select role from profiles where id=%s", (evil,))[0][0] == "student")
    _, err = run(a, "update profiles set role = 'admin' where id = auth.uid()")
    check("student cannot make themselves admin", err and "permission denied" in err, err or "no error")
    rows, err = run(a, "update profiles set full_name = 'Asha' where id = auth.uid() returning full_name")
    check("student can edit own name", rows == [("Asha",)], err or str(rows))
    rows, _ = run(a, "select count(*) from profiles")
    check("student sees only own profile", rows == [(1,)], str(rows))

    # --- slot management permissions
    _, err = run(a, "insert into slots (start_at, end_at) values (now() + interval '1 day', now() + interval '25 hours')")
    check("student cannot create slots", err is not None, "inserted!")
    rows, _ = run(None, "select count(*) from available_slots('doubt', null)", role="anon")
    check("no slots visible until teacher opens one", rows == [(0,)], str(rows))

    s1 = make_slot(adm, "1 day", 60)
    rows, _ = run(None, "select minutes, seats_left, price_paise from available_slots('doubt', 60)", role="anon")
    check("opened slot is listed with server price (doubt 60 = ₹100)", rows == [(60, 1, 10000)], str(rows))
    rows, _ = run(None, "select count(*) from available_slots('doubt', 30)", role="anon")
    check("duration filter works", rows == [(0,)], str(rows))
    rows, _ = run(None, "select price_paise from available_slots('tuition', null)", role="anon")
    check("tuition 60 min = ₹100", rows == [(10000,)], str(rows))
    _, err = run(a, "select * from slots")
    rows, _ = run(a, "select count(*) from slots")
    check("student cannot list raw slots table", rows == [(0,)], str(rows))

    _, err = run(adm, "insert into slots (start_at, end_at) select start_at + interval '30 minutes', end_at + interval '30 minutes' from slots where id = %s", (s1,))
    check("overlapping slots are rejected", err and "slots_no_overlap" in err, err or "inserted")

    # --- reservation & double booking
    rows, err = reserve(a, s1)
    check("student A can hold an open slot", rows and rows[0][1] == "pending_payment" and rows[0][2] == 10000, err or str(rows))
    bk_a = rows[0][0]
    _, err = reserve(b, s1)
    check("student B cannot take a full slot", err and "slot_unavailable:full" in err, err or "reserved!")
    _, err = reserve(a, s1)
    check("same student cannot hold same slot twice", err and ("already_booked" in err or "full" in err), err or "reserved!")
    _, err = run(a, "insert into bookings (booking_number,user_id,slot_id,service,class_level,board,amount_paise,status) values ('x',auth.uid(),%s,'doubt',10,'CBSE',1,'confirmed')", (s1,))
    check("student cannot insert a booking directly", err is not None, "inserted!")
    _, err = run(a, "update bookings set status='confirmed', amount_paise=1 where id=%s returning id", (bk_a,))
    rows, _ = run(a, "select status, amount_paise from bookings where id=%s", (bk_a,))
    check("student cannot alter booking status/price", rows == [("pending_payment", 10000)], str(rows))
    _, err = run(a, "select confirm_booking_payment(%s, 'pay_fake', 10000)", (bk_a,))
    check("student cannot call payment confirmation", err and "permission denied" in err, err or "allowed!")

    order_a = attach_order(bk_a, a, 10000)
    pay = "pay_" + uuid.uuid4().hex[:12]
    rows, err = confirm(bk_a, 10000, pay)
    check("verified payment confirms booking", rows == [("confirmed",)], err or str(rows))
    rows, err = confirm(bk_a, 10000, pay)
    check("duplicate payment event is idempotent", rows and rows[0][0].startswith("already_processed"), err or str(rows))
    st = admin_sql("select status, razorpay_payment_id from orders where id=%s", (order_a,))[0]
    check("order marked paid with payment id", st == ("paid", pay), str(st))
    rows, _ = run(None, "select count(*) from available_slots('doubt', null)", role="anon")
    check("full slot disappears from listing", rows == [(0,)], str(rows))
    rows, _ = run(b, "select count(*) from bookings")
    check("student B cannot see A's booking", rows == [(0,)], str(rows))
    rows, _ = run(a, "select count(*) from slots")
    check("student A can see the slot of own booking", rows == [(1,)], str(rows))

    # --- closing a slot
    s2 = make_slot(adm, "2 days", 30)
    rows, err = reserve(b, s2)
    bk_b = rows[0][0]
    attach_order(bk_b, b, 5000)
    check("doubt 30 min priced ₹50", rows[0][2] == 5000, str(rows))
    _, err = run(adm, "select admin_close_slot(%s)", (s2,))
    check("admin can close slot", err is None, err)
    st = admin_sql("select status from bookings where id=%s", (bk_b,))[0][0]
    check("closing slot cancels in-progress hold", st == "cancelled", st)
    _, err = reserve(a, s2)
    check("cannot reserve a closed slot", err and "slot_unavailable:closed" in err, err or "reserved!")
    rows, _ = confirm(bk_b, 5000)
    check("payment after teacher closed slot -> needs_review (not auto-accepted)", rows == [("needs_review",)], str(rows))
    _, err = run(a, "select admin_close_slot(%s)", (s1,))
    check("student cannot close slots", err and "forbidden" in err, err or "allowed!")

    # --- blocked periods
    s3 = make_slot(adm, "3 days", 60)
    admin_sql("insert into blocked_periods (start_at, end_at) select start_at - interval '1 hour', start_at + interval '10 minutes' from slots where id=%s", (s3,))
    rows, _ = run(None, "select count(*) from available_slots('tuition', null) where slot_id = %s", (s3,), role="anon")
    check("blocked period hides slot", rows == [(0,)], str(rows))
    _, err = reserve(a, s3, "tuition")
    check("cannot reserve slot in blocked period", err and "blocked" in err, err or "reserved!")

    # --- hold expiry & late payment
    s4 = make_slot(adm, "4 days", 60)
    rows, _ = reserve(a, s4)
    bk_late = rows[0][0]
    attach_order(bk_late, a, 10000)
    admin_sql("update bookings set hold_expires_at = now() - interval '1 second' where id=%s", (bk_late,))
    rows, err = reserve(b, s4)
    check("expired hold frees the slot for others", rows and rows[0][1] == "pending_payment", err)
    bk_b4 = rows[0][0]
    attach_order(bk_b4, b, 10000)
    rows, _ = confirm(bk_late, 10000)
    check("late payment for a slot taken by someone else -> needs_review", rows == [("needs_review",)], str(rows))
    rows, _ = confirm(bk_b4, 10000)
    check("valid holder's payment still confirms", rows == [("confirmed",)], str(rows))

    s5 = make_slot(adm, "5 days", 60)
    rows, _ = reserve(a, s5)
    bk5 = rows[0][0]
    attach_order(bk5, a, 10000)
    admin_sql("update bookings set hold_expires_at = now() - interval '1 second' where id=%s", (bk5,))
    rows, _ = confirm(bk5, 10000)
    check("payment after browser closed / hold expired, slot still free -> confirmed", rows == [("confirmed",)], str(rows))

    # --- release on payment window close
    s6 = make_slot(adm, "6 days", 60)
    rows, _ = reserve(a, s6)
    run(a, "select release_booking(%s)", (rows[0][0],))
    rows, err = reserve(b, s6)
    check("released hold frees seat immediately", rows is not None, err)
    _, err = run(b, "select release_booking(%s)", (bk_a,))
    st = admin_sql("select status from bookings where id=%s", (bk_a,))[0][0]
    check("student cannot release someone else's booking", st == "confirmed", st)

    # --- amount mismatch
    s7 = make_slot(adm, "7 days", 60)
    rows, _ = reserve(a, s7)
    bk7 = rows[0][0]
    attach_order(bk7, a, 10000)
    rows, _ = confirm(bk7, 100)
    check("amount mismatch -> needs_review", rows == [("needs_review",)], str(rows))

    # --- pending hold limit
    s8, s9, s10 = make_slot(adm, "8 days"), make_slot(adm, "9 days"), make_slot(adm, "10 days")
    new = new_user(f"n{uuid.uuid4().hex[:6]}@t.in")
    reserve(new, s8); reserve(new, s9)
    _, err = reserve(new, s10)
    check("one student cannot hold more than 2 slots at once", err and "too_many_pending" in err, err or "reserved!")

    # --- rules: notice, duration, service, global switch
    s_soon = make_slot(adm, "1 hour", 60)
    _, err = reserve(a, s_soon)
    check("minimum notice enforced", err and "too_soon" in err, err or "reserved!")
    s_90 = make_slot(adm, "11 days", 90)
    _, err = reserve(a, s_90, "doubt")
    check("doubt session cannot be 90 min", err and "duration_not_offered" in err, err or "reserved!")
    rows, _ = reserve(new, s_90, "tuition") if False else (None, None)
    s_t = make_slot(adm, "12 days", 60, tuition=True, doubt=False)
    _, err = reserve(a, s_t, "doubt")
    check("service not allowed in slot is rejected", err and "service_not_offered" in err, err or "reserved!")
    rows, _ = run(None, "select price_paise from available_slots('tuition', 90)", role="anon")
    check("tuition 90 min = ₹150", rows == [(15000,)], str(rows))
    _, err = run(a, "select reserve_slot(%s, 'doubt', 10, 'CBSE', null)", (str(uuid.uuid4()),))
    check("unknown slot id rejected", err and "not_found" in err, err)

    s_g = make_slot(adm, "13 days", 60)
    rows, _ = reserve(b, s_g)
    bk_g = rows[0][0]
    _, err = run(adm, "select admin_set_bookings_open(false)")
    rows, _ = run(None, "select count(*) from available_slots('doubt', null)", role="anon")
    check("close all bookings hides every slot", rows == [(0,)], str(rows))
    _, err = reserve(a, s_t, "tuition")
    check("close all bookings blocks reservations", err and "bookings_closed" in err, err or "reserved!")
    st = admin_sql("select status from bookings where id=%s", (bk_g,))[0][0]
    check("close all bookings cancels live holds", st == "cancelled", st)
    _, err = run(b, "select admin_set_bookings_open(true)")
    check("student cannot reopen bookings", err and "forbidden" in err, err or "allowed")
    run(adm, "select admin_set_bookings_open(true)")
    rows, _ = run(None, "select count(*) > 0 from available_slots('doubt', null)", role="anon")
    check("reopening restores listing", rows == [(True,)], str(rows))

    # --- remove slot
    rows, err = run(adm, "select admin_remove_slot(%s)", (s1,))
    check("slot with confirmed booking cannot be removed", err and "slot_has_bookings" in err, err or str(rows))
    s_rm = make_slot(adm, "20 days", 60)
    rows, _ = run(adm, "select admin_remove_slot(%s)", (s_rm,))
    check("empty slot is deleted", rows == [("deleted",)], str(rows))

    # --- concurrency: 25 students race for a 1-seat and a 3-seat slot
    for cap in (1, 3):
        sc = make_slot(adm, f"{30 + cap} days", 60, capacity=cap)
        users = [new_user(f"c{uuid.uuid4().hex[:8]}@t.in") for _ in range(25)]
        ok = []
        barrier = threading.Barrier(len(users))

        def worker(u):
            with conn() as c:
                with c.cursor() as cur:
                    as_user(cur, u)
                    barrier.wait()
                    try:
                        cur.execute("select id from reserve_slot(%s, 'tuition', 9, 'ICSE', null)", (sc,))
                        c.commit()
                        ok.append(u)
                    except Exception:  # noqa: BLE001
                        c.rollback()

        ts = [threading.Thread(target=worker, args=(u,)) for u in users]
        [t.start() for t in ts]
        [t.join() for t in ts]
        held = admin_sql("select count(*) from bookings where slot_id=%s and status='pending_payment'", (sc,))[0][0]
        check(f"race: 25 concurrent bookings on capacity {cap} -> exactly {cap} holds", len(ok) == cap and held == cap, f"ok={len(ok)} held={held}")

    # --- notes ownership
    note = admin_sql("select id from notes limit 1")[0][0]
    admin_sql("insert into note_files (note_id, pdf_path) values (%s, 'x/y.pdf') on conflict do nothing", (note,))
    rows, _ = run(a, "select count(*) from note_files")
    check("students cannot see private PDF paths", rows == [(0,)], str(rows))
    rows, _ = run(None, "select count(*) from note_files", role="anon")
    check("anonymous cannot see private PDF paths", rows == [(0,)], str(rows))
    o = admin_sql("insert into orders (order_number,user_id,kind,amount_paise) values (make_ref('SWS-N'),%s,'notes',1000) returning id", (a,))[0][0]
    admin_sql("insert into order_items (order_id, note_id, title_snapshot, price_paise) values (%s,%s,'t',1000)", (o, note))
    owns = admin_sql("select user_owns_note(%s,%s)", (a, note))[0][0]
    check("unpaid order does not grant access", owns is False)
    rows, _ = run(None, "select mark_notes_order_paid(%s,'pay_n1',1000)", (o,), role="service")
    rows2, _ = run(None, "select mark_notes_order_paid(%s,'pay_n1',1000)", (o,), role="service")
    check("notes payment marks paid, duplicate is idempotent", rows == [("paid",)] and rows2[0][0].startswith("already"), f"{rows} {rows2}")
    check("paid order grants access", admin_sql("select user_owns_note(%s,%s)", (a, note))[0][0] is True)
    check("other student has no access", admin_sql("select user_owns_note(%s,%s)", (b, note))[0][0] is False)
    rows, err = run(a, "select user_owns_note(%s,%s)", (b, note))
    check("student cannot probe ownership function", err and "permission denied" in err, err or str(rows))
    _, err = run(a, "insert into orders (order_number,user_id,kind,amount_paise,status) values ('hack',auth.uid(),'notes',1,'paid')")
    check("student cannot create a paid order", err is not None, "inserted!")
    rows, _ = run(b, "select count(*) from orders")
    check("student B sees only own orders", rows[0][0] == admin_sql("select count(*) from orders where user_id=%s", (b,))[0][0])
    _, err = run(a, "update notes set price_paise = 1 returning id")
    rows = admin_sql("select count(*) from notes where price_paise = 100")
    check("student cannot change note prices", rows == [(0,)], str(rows))
    rows, _ = run(None, "select count(*) from notes where not is_published", role="anon")
    check("unpublished notes hidden from public", rows == [(0,)], str(rows))
    rows, _ = run(None, "select count(*) from webhook_events", role="anon")
    _, err = run(a, "select * from webhook_events")
    check("webhook log not readable by students", err and "permission denied" in err, err)

    # --- admin
    rows, err = run(adm, "select admin_stats()->>'students'")
    check("admin can read dashboard stats", rows and int(rows[0][0]) >= 2, err or str(rows))
    _, err = run(a, "select admin_stats()")
    check("student cannot read dashboard stats", err and "forbidden" in err, err)
    rows, _ = run(adm, "select count(*) from bookings")
    check("admin can see all bookings", rows[0][0] >= 5, str(rows))
    _, err = run(None, "insert into contact_messages (name,email,message) values ('x','x@x','hi')", role="anon")
    check("anonymous cannot write contact table directly (server does it)", err is not None, "inserted")

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

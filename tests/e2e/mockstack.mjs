// Local test infrastructure (NOT part of the website):
//  :54321  Supabase-style gateway -> /rest/v1 (PostgREST :3001), /auth/v1 (GoTrue :9999), /storage/v1 (mock storage)
//  :4010   Mock Razorpay API + fake checkout.js + test controls
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const KEY_ID = process.env.RZP_KEY_ID;
const KEY_SECRET = process.env.RZP_KEY_SECRET;
const STORE = "/home/claude/work/e2e/storage";
fs.mkdirSync(STORE, { recursive: true });

function proxy(req, res, port, newPath) {
  const p = http.request({ host: "127.0.0.1", port, path: newPath, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } }, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res);
  });
  p.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
}
const body = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
const send = (res, code, obj, extra = {}) => { res.writeHead(code, { "Content-Type": "application/json", ...cors, ...extra }); res.end(JSON.stringify(obj)); };

// ---------------- gateway ----------------
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (u.pathname.startsWith("/rest/v1")) return proxy(req, res, 3001, req.url.replace("/rest/v1", "") || "/");
  if (u.pathname.startsWith("/auth/v1")) return proxy(req, res, 9999, req.url.replace("/auth/v1", "") || "/");
  if (u.pathname.startsWith("/storage/v1/")) {
    const rest = decodeURIComponent(u.pathname.replace("/storage/v1", ""));
    let m;
    if (req.method === "POST" && (m = rest.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
      return send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=test` });
    }
    if (req.method === "GET" && (m = rest.match(/^\/object\/(?:public\/|authenticated\/|sign\/)?([^/]+)\/(.+)$/))) {
      const f = path.join(STORE, m[1], m[2]);
      if (!f.startsWith(STORE) || !fs.existsSync(f)) return send(res, 404, { error: "not_found", message: "Object not found" });
      res.writeHead(200, { "Content-Type": m[1] === "notes-pdf" ? "application/pdf" : "image/png", ...cors });
      return res.end(fs.readFileSync(f));
    }
    if ((req.method === "POST" || req.method === "PUT") && (m = rest.match(/^\/object\/([^/]+)\/(.+)$/))) {
      // Mimic storage RLS: only an admin JWT (checked via PostgREST is_admin) or service role may write.
      const auth = req.headers.authorization || "";
      const r = await fetch("http://127.0.0.1:3001/rpc/is_admin", { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
      const isAdmin = r.ok && (await r.json()) === true;
      const isService = (() => { try { return JSON.parse(Buffer.from(auth.split(".")[1], "base64url")).role === "service_role"; } catch { return false; } })();
      if (!isAdmin && !isService) return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      const f = path.join(STORE, m[1], m[2]);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, await body(req));
      return send(res, 200, { Key: `${m[1]}/${m[2]}`, Id: crypto.randomUUID() });
    }
    if (req.method === "DELETE") return send(res, 200, []);
    return send(res, 404, { error: "unhandled storage route " + rest });
  }
  send(res, 404, { error: "no route" });
}).listen(54321, "127.0.0.1");

// ---------------- mock Razorpay ----------------
const orders = new Map();
const payments = new Map();
const log = [];
const sig = (o, p) => crypto.createHmac("sha256", KEY_SECRET).update(`${o}|${p}`).digest("hex");
const rid = (p) => `${p}_${crypto.randomBytes(7).toString("hex")}`;

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (u.pathname.startsWith("/v1/")) {
    const auth = Buffer.from((req.headers.authorization || "").replace("Basic ", ""), "base64").toString();
    if (auth !== `${KEY_ID}:${KEY_SECRET}`) return send(res, 401, { error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } });
    const b = req.method === "POST" ? JSON.parse((await body(req)).toString() || "{}") : {};
    log.push({ method: req.method, path: u.pathname, body: b });
    let m;
    if (req.method === "POST" && u.pathname === "/v1/orders") {
      const o = { id: rid("order"), entity: "order", amount: b.amount, currency: b.currency, receipt: b.receipt, notes: b.notes, status: "created" };
      orders.set(o.id, o);
      return send(res, 200, o);
    }
    if (req.method === "GET" && (m = u.pathname.match(/^\/v1\/payments\/(\w+)$/))) {
      const p = payments.get(m[1]);
      return p ? send(res, 200, p) : send(res, 400, { error: { description: "The id provided does not exist" } });
    }
    if (req.method === "POST" && (m = u.pathname.match(/^\/v1\/payments\/(\w+)\/capture$/))) {
      const p = payments.get(m[1]); p.status = "captured"; return send(res, 200, p);
    }
    if (req.method === "POST" && (m = u.pathname.match(/^\/v1\/payments\/(\w+)\/refund$/))) {
      const p = payments.get(m[1]);
      if (!p) return send(res, 400, { error: { description: "no payment" } });
      return send(res, 200, { id: rid("rfnd"), entity: "refund", amount: b.amount ?? p.amount, payment_id: p.id, status: "processed" });
    }
    return send(res, 404, { error: { description: "mock: unhandled " + u.pathname } });
  }
  // Test controls
  if (u.pathname === "/__test/pay") {
    const o = orders.get(u.searchParams.get("order_id"));
    if (!o) return send(res, 404, { error: "unknown order" });
    const p = {
      id: rid("pay"), entity: "payment", order_id: o.id, currency: "INR", method: "upi",
      amount: Number(u.searchParams.get("amount") || o.amount),
      status: u.searchParams.get("status") || "captured",
      error_description: u.searchParams.get("status") === "failed" ? "Payment declined by bank (mock)" : null,
    };
    payments.set(p.id, p);
    return send(res, 200, { razorpay_order_id: o.id, razorpay_payment_id: p.id, razorpay_signature: sig(o.id, p.id), payment: p });
  }
  if (u.pathname === "/__test/state") return send(res, 200, { orders: [...orders.values()], payments: [...payments.values()], log });
  if (u.pathname === "/checkout.js") {
    res.writeHead(200, { "Content-Type": "application/javascript", ...cors });
    return res.end(`
      window.Razorpay = function (opts) { this.opts = opts; this.handlers = {}; };
      window.Razorpay.prototype.on = function (ev, cb) { this.handlers[ev] = cb; };
      window.Razorpay.prototype.open = async function () {
        const mode = window.__RZP_MODE || "success";
        window.__RZP_LAST = { amount: this.opts.amount, order_id: this.opts.order_id, description: this.opts.description, timeout: this.opts.timeout };
        const pay = async (extra) => (await fetch("http://127.0.0.1:4010/__test/pay?order_id=" + this.opts.order_id + (extra || ""))).json();
        if (mode === "dismiss") return this.opts.modal.ondismiss();
        if (mode === "fail") { const r = await pay("&status=failed"); this.handlers["payment.failed"] && this.handlers["payment.failed"]({ error: { description: "Payment declined by bank (mock)" } }); return this.opts.modal.ondismiss(); }
        if (mode === "paid_then_closed") { const r = await pay(); window.__RZP_PAID = r; return this.opts.modal.ondismiss(); }
        if (mode === "wrong_amount") { const r = await pay("&amount=100"); return this.opts.handler(r); }
        const r = await pay();
        window.__RZP_PAID = r;
        this.opts.handler({ razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature });
      };`);
  }
  send(res, 404, { error: "no route" });
}).listen(4010, "127.0.0.1");

console.log("mock stack up: gateway :54321, razorpay :4010");

import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { RAZORPAY_KEY_ID, paymentsStatus, serverSecrets } from "@/lib/config";

let client: Razorpay | null = null;

export function razorpay() {
  const status = paymentsStatus();
  if (!status.ok) throw new Error(status.reason || "Payments are not available");
  if (!client) {
    client = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: serverSecrets().razorpayKeySecret });
    // Automated-test seam: point the SDK at a local mock. Only ever honoured with TEST keys.
    const mock = process.env.RAZORPAY_TEST_ONLY_MOCK_API_URL;
    if (mock && RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
      (client as unknown as { api: { rq: { defaults: { baseURL: string } } } }).api.rq.defaults.baseURL = mock;
    }
  }
  return client;
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = serverSecrets().razorpayKeySecret) {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = serverSecrets().razorpayWebhookSecret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export interface RzpPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_description?: string | null;
}

/**
 * Ask Razorpay directly for the payment (never trust the browser).
 * Captures it if it is only authorised (in case auto-capture is off).
 */
export async function fetchAndCapturePayment(paymentId: string): Promise<RzpPayment> {
  const rzp = razorpay();
  let p = (await rzp.payments.fetch(paymentId)) as unknown as RzpPayment;
  if (p.status === "authorized") {
    p = (await rzp.payments.capture(paymentId, p.amount, p.currency)) as unknown as RzpPayment;
  }
  return p;
}

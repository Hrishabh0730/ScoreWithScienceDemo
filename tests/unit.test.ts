import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toCsv } from "@/lib/csv";
import { inr, istToIso, youtubeId } from "@/lib/format";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay";
import { safeNext } from "@/lib/safe-next";
import { watermarkPdf } from "@/lib/watermark";
import { PDFDocument } from "pdf-lib";

describe("Razorpay signatures", () => {
  const secret = "test_secret";
  it("accepts a valid checkout signature", () => {
    const sig = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, secret)).toBe(true);
  });
  it("rejects tampered order/payment ids or signature", () => {
    const sig = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature("order_2", "pay_1", sig, secret)).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", sig.replace(/.$/, "0"), secret)).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, "")).toBe(false);
  });
  it("verifies webhook body signature", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const sig = crypto.createHmac("sha256", "wh").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, "wh")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, "wh")).toBe(false);
    expect(verifyWebhookSignature(body, null, "wh")).toBe(false);
  });
});

describe("helpers", () => {
  it("formats rupees", () => {
    expect(inr(1000)).toBe("₹10");
    expect(inr(15050)).toBe("₹150.50");
  });
  it("converts IST input to UTC", () => {
    expect(istToIso("2026-12-01", "17:00")).toBe("2026-12-01T11:30:00.000Z");
    expect(() => istToIso("bad", "17:00")).toThrow();
  });
  it("only allows local redirects", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("//evil.com")).toBe("/account");
    expect(safeNext("https://evil.com")).toBe("/account");
    expect(safeNext("/\\evil.com")).toBe("/account");
  });
  it("neutralises CSV formula injection", () => {
    const csv = toCsv([{ a: "=HYPERLINK(1)", b: 'x,"y"' }], ["a", "b"]);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain('"x,""y"""');
  });
  it("parses YouTube ids", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=abc123XYZ_-")).toBe("abc123XYZ_-");
    expect(youtubeId("https://youtu.be/abc123XYZ_-")).toBe("abc123XYZ_-");
    expect(youtubeId("https://www.youtube.com/shorts/abc123XYZ_-")).toBe("abc123XYZ_-");
  });
});

describe("watermark", () => {
  it("stamps every page and keeps page count", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    const out = await watermarkPdf(await doc.save(), "Licensed to a@b.in | Order SWS-N-1");
    const back = await PDFDocument.load(out);
    expect(back.getPageCount()).toBe(2);
    expect(out.length).toBeGreaterThan(500);
  });
});

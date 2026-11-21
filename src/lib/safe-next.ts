/** Only allow same-site relative redirect targets. */
export function safeNext(n: FormDataEntryValue | string | null | undefined, fallback = "/account") {
  const s = String(n ?? "");
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

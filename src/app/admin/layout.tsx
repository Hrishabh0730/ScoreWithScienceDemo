import type { Metadata } from "next";
import { AdminNav } from "./AdminNav";
import { requireAdmin } from "@/lib/auth";
import { paymentsStatus } from "@/lib/config";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const pay = paymentsStatus();
  return (
    <div className="bg-navy-50/40">
      {pay.mode !== "live" && (
        <div className={`text-center text-xs font-semibold ${pay.ok ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"} px-4 py-2`}>
          {pay.ok ? "Payments are in TEST MODE — no real money moves." : `Payments are OFF: ${pay.reason}`}
        </div>
      )}
      {pay.mode === "live" && !pay.ok && <div className="bg-red-100 px-4 py-2 text-center text-xs font-semibold text-red-800">{pay.reason}</div>}
      <div className="container-x grid gap-6 py-6 lg:grid-cols-[210px_1fr]">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

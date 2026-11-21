import { Notice } from "@/components/ui";

export function AdminHeader({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">{title}</h1>
        {lead && <p className="mt-1 text-sm text-muted">{lead}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export async function Flash({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  if (!sp.ok && !sp.err) return null;
  return <div className="mb-5">{sp.err ? <Notice tone="error">{sp.err}</Notice> : <Notice tone="success">{sp.ok}</Notice>}</div>;
}

export function Panel({ title, children, id, actions }: { title: string; children: React.ReactNode; id?: string; actions?: React.ReactNode }) {
  return (
    <section id={id} className="card mb-6 scroll-mt-24 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 className="font-bold text-navy-900">{title}</h2>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-semibold text-navy-900">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-5 w-5 accent-navy-800" />
      {label}
    </label>
  );
}

export type SP = Promise<{ ok?: string; err?: string; [k: string]: string | undefined }>;

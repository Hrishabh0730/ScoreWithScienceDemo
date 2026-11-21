import Image from "next/image";

export function AuthShell({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="grid-paper min-h-[70vh] py-12">
      <div className="container-x max-w-md">
        <div className="card p-6 sm:p-8">
          <Image src="/logo.png" alt="" width={56} height={56} className="rounded-full" />
          <h1 className="mt-4 text-2xl font-extrabold text-navy-900">{title}</h1>
          {lead && <p className="mt-1 text-sm text-muted">{lead}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

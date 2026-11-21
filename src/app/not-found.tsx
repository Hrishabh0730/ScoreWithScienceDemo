import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="font-hand text-3xl text-saffron-500">Oops — this reaction didn&apos;t happen.</p>
      <h1 className="h-section mt-3">Page not found</h1>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="btn-primary">Go home</Link>
        <Link href="/notes" className="btn-outline">Browse notes</Link>
      </div>
    </div>
  );
}

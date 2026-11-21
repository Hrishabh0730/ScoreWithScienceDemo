"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { useCart } from "@/components/CartProvider";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/config";

const NAV = [
  { href: "/notes", label: "Notes" },
  { href: "/tuition", label: "Chemistry Tuition" },
  { href: "/doubts", label: "Doubt Sessions" },
  { href: "/videos", label: "Videos" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

function useAuthState(pathname: string) {
  const [state, setState] = useState<{ loggedIn: boolean; admin: boolean }>({ loggedIn: false, admin: false });
  // Re-check on every navigation: login/logout happen in server actions, which the
  // browser client doesn't hear about, so we refresh state when the route changes.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = createClient();
    const load = async () => {
      const { data } = await sb.auth.getUser();
      if (!data.user) return setState({ loggedIn: false, admin: false });
      const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      setState({ loggedIn: true, admin: p?.role === "admin" });
    };
    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, [pathname]);
  return state;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { items } = useCart();
  const auth = useAuthState(pathname);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the menu on navigation
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors ${
        scrolled ? "border-line bg-white/90 backdrop-blur-md" : "border-transparent bg-paper/70 backdrop-blur-sm"
      }`}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-navy-50 ${
                pathname === n.href ? "text-navy-900" : "text-muted"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/cart" className="btn-ghost relative !px-3" aria-label={`Cart, ${items.length} items`}>
            <CartIcon />
            {items.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-saffron-500 px-1 text-[11px] font-bold text-white">
                {items.length}
              </span>
            )}
          </Link>
          {auth.admin && (
            <Link href="/admin" className="btn-outline btn-sm hidden sm:inline-flex">
              Admin
            </Link>
          )}
          <Link href={auth.loggedIn ? "/account" : "/login"} className="btn-primary btn-sm hidden sm:inline-flex">
            {auth.loggedIn ? "My account" : "Log in"}
          </Link>
          <button
            className="btn-ghost !px-3 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-white lg:hidden">
          <div className="container-x grid gap-1 py-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-xl px-3 py-3 font-semibold text-navy-900 hover:bg-navy-50">
                {n.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href={auth.loggedIn ? "/account" : "/login"} className="btn-primary">
                {auth.loggedIn ? "My account" : "Log in"}
              </Link>
              {auth.admin ? (
                <Link href="/admin" className="btn-outline">
                  Admin
                </Link>
              ) : (
                !auth.loggedIn && (
                  <Link href="/register" className="btn-outline">
                    Sign up
                  </Link>
                )
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6.2" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </svg>
  );
}

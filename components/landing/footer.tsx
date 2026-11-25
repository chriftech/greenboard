import Link from "next/link";
import { Logo } from "./logo";

/** The site footer, shared by the landing and pricing pages. */
export function Footer() {
  return (
    <footer className="border-t border-ink/10 px-4 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="size-8" />
          <span className="font-display text-lg font-bold">greenboard</span>
        </Link>
        <nav className="flex gap-6 text-sm text-ink/60">
          <Link href="/#how" className="hover:text-ink">
            How it works
          </Link>
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
        </nav>
        <p className="text-sm text-ink/50">© 2026 Greenboard</p>
      </div>
    </footer>
  );
}

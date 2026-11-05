"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#try", label: "Try it" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3">
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 ${
          scrolled || open
            ? "border border-forest/10 bg-white/80 shadow-lg shadow-forest/5 backdrop-blur-xl"
            : "border border-transparent"
        }`}
      >
        <a href="#top" className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight text-forest">
            greenboard
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-sm font-medium text-forest/70 transition-colors hover:text-forest after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-leaf after:transition-transform hover:after:scale-x-100"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a href="#start" className="text-sm font-semibold text-forest/80 hover:text-forest">
            Log in
          </a>
          <a
            href="#start"
            className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-zest transition-transform hover:-translate-y-0.5 hover:shadow-lg"
          >
            Get started
          </a>
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl text-forest md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div className="gb-rise mx-auto mt-2 max-w-6xl rounded-2xl border border-forest/10 bg-white p-4 shadow-xl md:hidden">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 font-medium text-forest hover:bg-mint"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#start"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-xl bg-forest px-3 py-3 text-center font-semibold text-zest"
          >
            Get started
          </a>
        </div>
      )}
    </header>
  );
}

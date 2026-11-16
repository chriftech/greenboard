"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { Compass, House, LifeBuoy, LogIn, LogOut, UserPlus } from "lucide-react";
import { UserAvatar } from "@/components/auth/user-avatar";
import { authActions, useAuth } from "@/lib/auth";

/**
 * The board header's account button: your avatar (or Guest), opening a menu with
 * Help, the tour, and Log out (or Log in and Sign up for guests).
 */
export function ProfileMenu({ onStartTour }: { onStartTour: () => void }) {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <span aria-hidden className="mx-1 size-9 animate-pulse rounded-full bg-ink/10" />;
  }

  const user = auth.status === "signed-in" ? auth.user : null;
  const label = user ? user.name || user.email || "Your account" : "Guest";

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Account menu for ${label}`}
        className="ml-1 rounded-full p-0.5 ring-2 ring-transparent transition-shadow hover:ring-ink/15 focus-visible:outline-none focus-visible:ring-iris data-popup-open:ring-iris"
      >
        {user ? (
          <UserAvatar user={user} className="size-8 text-xs" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-peach text-xs font-bold text-on-accent">G</span>
        )}
      </Menu.Trigger>

      <Menu.Portal>
        {/* Below the task drawer (z-50) but above the board and its sticky bits. */}
        <Menu.Positioner sideOffset={8} align="end" className="z-40">
          <Menu.Popup className="w-64 origin-(--transform-origin) rounded-2xl border border-ink/10 bg-surface p-1.5 text-ink shadow-[0_20px_50px_-15px_rgb(46_51_73/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {/* Who's signed in: not an option, just a heading for the menu. */}
            <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-2">
              {user ? (
                <UserAvatar user={user} className="size-10 text-sm" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-peach text-sm font-bold text-on-accent">
                  G
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{label}</p>
                <p className="truncate text-xs text-ink/55">
                  {user ? (user.name && user.email ? user.email : "Signed in") : "Saved in this browser"}
                </p>
              </div>
            </div>

            <Separator />

            {!user && (
              <>
                <LinkOption href="/login" icon={<LogIn className="size-4" />}>
                  Log in
                </LinkOption>
                <LinkOption href="/signup" icon={<UserPlus className="size-4" />}>
                  Sign up
                </LinkOption>
                <Separator />
              </>
            )}

            <LinkOption href="/help" icon={<LifeBuoy className="size-4" />}>
              Help &amp; feedback
            </LinkOption>
            {/* Let the menu close first, so the tour's spotlight isn't fighting it for focus. */}
            <Option icon={<Compass className="size-4" />} onClick={() => window.setTimeout(onStartTour, 150)}>
              Take the tour
            </Option>
            {!user && (
              <LinkOption href="/" icon={<House className="size-4" />}>
                Home page
              </LinkOption>
            )}

            {user && (
              <>
                <Separator />
                <Option icon={<LogOut className="size-4" />} danger onClick={() => authActions.logOut().catch(() => {})}>
                  Log out
                </Option>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const optionClass = (danger = false) =>
  `flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium outline-none transition-colors ${
    danger ? "text-coral data-highlighted:bg-coral/10" : "text-ink/80 data-highlighted:bg-mist data-highlighted:text-ink"
  }`;

function Option({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Menu.Item onClick={onClick} className={optionClass(danger)}>
      <span className={danger ? "" : "text-ink/50"}>{icon}</span>
      {children}
    </Menu.Item>
  );
}

function LinkOption({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Menu.LinkItem render={<Link href={href} />} closeOnClick className={optionClass()}>
      <span className="text-ink/50">{icon}</span>
      {children}
    </Menu.LinkItem>
  );
}

function Separator() {
  return <Menu.Separator className="mx-2 my-1.5 h-px bg-ink/10" />;
}

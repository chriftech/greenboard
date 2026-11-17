import type { AuthUser } from "@/lib/auth";

/** The signed-in user's photo (e.g. from Google), or their initial. */
export function UserAvatar({ user, className = "size-10 text-sm" }: { user: AuthUser; className?: string }) {
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  return user.photoURL ? (
    // eslint-disable-next-line @next/next/no-img-element -- a remote avatar from the sign-in provider; next/image would need every host allow-listed
    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className={`${className} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-full bg-peach font-bold text-on-accent`}>
      {initial}
    </span>
  );
}

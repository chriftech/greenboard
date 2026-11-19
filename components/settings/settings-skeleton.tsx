import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

const card =
  "mt-3 divide-y divide-ink/10 overflow-hidden rounded-[24px] border border-ink/10 bg-surface shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)]";

/** A settings row: icon, title and a line or two of text. */
function RowSkeleton({ field = false }: { field?: boolean }) {
  return (
    <div className="flex items-start gap-4 p-5">
      <Skeleton className="size-9 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-64 max-w-full" />
        {field && <Skeleton className="mt-3 h-10 w-full max-w-md rounded-xl" />}
      </div>
    </div>
  );
}

/** The profile card while we find out who's signed in: avatar, then name, email and password rows. */
export function ProfileSkeleton() {
  return (
    <SkeletonRegion label="Loading your profile…" className={card}>
      <div className="flex items-center gap-4 p-5">
        <Skeleton className="size-14 shrink-0" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
      </div>
      <RowSkeleton field />
      <RowSkeleton />
      <RowSkeleton />
    </SkeletonRegion>
  );
}

/** An on/off switch whose saved value isn't known yet. */
export function SwitchSkeleton() {
  return <Skeleton className="mt-1 h-7 w-12 shrink-0" />;
}

/** The whole settings page body (below the header), shown while the page opens. */
export function SettingsPageSkeleton() {
  return (
    <>
      <section>
        <Skeleton className="ml-1 h-3 w-16" />
        <ProfileSkeleton />
      </section>
      <section>
        <Skeleton className="ml-1 h-3 w-12" />
        <div className={card}>
          <div className="flex items-start gap-4 p-5">
            <Skeleton className="size-9 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <SwitchSkeleton />
          </div>
        </div>
      </section>
    </>
  );
}

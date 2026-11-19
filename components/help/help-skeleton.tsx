import { Skeleton } from "@/components/ui/skeleton";

const QUESTIONS = ["58%", "70%", "50%", "40%", "62%", "45%"];

/** The Help page body while it opens: questions, shortcuts and the feedback form. */
export function HelpPageSkeleton() {
  return (
    <>
      <section>
        <Skeleton className="h-7 w-36" />
        <div className="mt-4 space-y-3">
          {QUESTIONS.map((w, i) => (
            <div key={i} className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-surface px-5 py-[18px]">
              <Skeleton className="h-4" style={{ width: w }} />
              <Skeleton className="size-4 shrink-0" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <Skeleton className="h-7 w-56" />
        <div className="mt-4 divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

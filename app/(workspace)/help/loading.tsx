import { PageSkeleton } from "@/components/ui/page-skeleton";
import { HelpPageSkeleton } from "@/components/help/help-skeleton";

/** Shown while the Help page opens. */
export default function HelpLoading() {
  return (
    <PageSkeleton label="Loading help…">
      <HelpPageSkeleton />
    </PageSkeleton>
  );
}

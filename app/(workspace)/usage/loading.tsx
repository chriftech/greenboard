import { PageSkeleton } from "@/components/ui/page-skeleton";
import { UsageSkeleton } from "@/components/usage/usage-dashboard";

/** Shown while the Usage page opens. */
export default function UsageLoading() {
  return (
    <PageSkeleton label="Loading usage…">
      <UsageSkeleton />
    </PageSkeleton>
  );
}

import { PageSkeleton } from "@/components/ui/page-skeleton";
import { SettingsPageSkeleton } from "@/components/settings/settings-skeleton";

/** Shown while the Settings page opens. */
export default function SettingsLoading() {
  return (
    <PageSkeleton label="Loading settings…">
      <SettingsPageSkeleton />
    </PageSkeleton>
  );
}

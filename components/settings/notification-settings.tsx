"use client";

import { useId, useState } from "react";
import { BellRing, Mail } from "lucide-react";
import { PremiumBadge } from "@/components/pricing/premium-badge";
import { usePlan } from "@/lib/plan";
import { useAuth } from "@/lib/auth";
import { REMINDER_LEADS, type ReminderLead } from "@/lib/settings";
import { requestNotificationPermission, showNotification, useNotificationState } from "@/lib/notifications";
import { useHydrated } from "@/lib/hydrated";
import { ToggleRow } from "./settings-form";
import { SaveBar, useSettingsDraft } from "./settings-draft";

const KEYS = ["reminders", "reminderLead", "emailReminders"] as const;

const LEAD_LABELS: Record<ReminderLead, string> = {
  0: "When it starts",
  5: "5 minutes before",
  10: "10 minutes before",
  15: "15 minutes before",
  30: "30 minutes before",
  60: "1 hour before",
};

/** Task reminders: a browser notification before each scheduled task starts. Saved when Save is pressed. */
export function NotificationSettings() {
  const draft = useSettingsDraft(KEYS);
  const { reminders, reminderLead, emailReminders } = draft.value;
  const auth = useAuth();
  const canEmail = auth.status === "signed-in" && Boolean(auth.user.email);
  const [asking, setAsking] = useState(false);
  const plan = usePlan();
  const permission = useNotificationState();
  const hydrated = useHydrated();
  const leadId = useId();
  const [testNote, setTestNote] = useState<string | null>(null);
  // Reminders only run when both the setting and the browser's permission allow them.
  const on = reminders && permission === "granted";

  async function toggle(next: boolean) {
    setTestNote(null);
    if (!next) return draft.set("reminders", false);
    // Ask for the browser's permission now, while the click counts as the user's choice.
    setAsking(true);
    const result = permission === "granted" ? "granted" : await requestNotificationPermission();
    setAsking(false);
    draft.set("reminders", result === "granted");
  }

  function sendTest() {
    const shown = showNotification("Reminders are on", {
      body: "This is how a task reminder will look.",
      tag: "greenboard-reminder-test",
    });
    setTestNote(shown ? "Sent. If nothing appeared, check your system's notification settings." : "This browser can't show it here.");
  }

  return (
    <section aria-labelledby="notification-settings" className="gb-rise" style={{ animationDelay: "160ms" }}>
      <h2 id="notification-settings" className="px-1 text-xs font-semibold uppercase tracking-widest text-ink/50">
        Notifications
      </h2>
      <div className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-[24px] border border-ink/10 bg-surface shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)]">
        <ToggleRow
          icon={<BellRing className="size-4" />}
          title="Task reminders"
          description="Get a browser notification before a task with a timeline starts, while Greenboard is open in a tab."
          checked={on}
          onChange={toggle}
        />

        {hydrated && permission === "unsupported" && (
          <p className="px-5 py-4 text-sm text-ink/60">This browser doesn&apos;t support notifications.</p>
        )}
        {hydrated && permission === "denied" && (
          <p role="status" className="px-5 py-4 text-sm text-coral">
            Notifications are blocked for this site. Allow them in your browser&apos;s site settings (the icon left of
            the address), then turn reminders on again.
          </p>
        )}

        {hydrated && on && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
            <label htmlFor={leadId} className="text-sm font-semibold">
              Remind me
            </label>
            <select
              id={leadId}
              value={reminderLead}
              onChange={(e) => draft.set("reminderLead", Number(e.target.value) as ReminderLead)}
              className="rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-ink/30 focus:border-iris"
            >
              {REMINDER_LEADS.map((m) => (
                <option key={m} value={m}>
                  {LEAD_LABELS[m]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={sendTest}
              className="ml-auto rounded-xl border border-ink/15 px-3 py-2 text-sm font-semibold transition-colors hover:bg-mist"
            >
              Send a test
            </button>
            {testNote && (
              <p role="status" className="w-full text-xs text-ink/55">
                {testNote}
              </p>
            )}
          </div>
        )}

        {/* Sent to the account's email address, so it needs an account. */}
        <ToggleRow
          icon={<Mail className="size-4" />}
          title="Email reminders"
          badge={plan === "free" ? <PremiumBadge /> : undefined}
          description={
            auth.status === "signed-in" && auth.user.email
              ? `Get an email at ${auth.user.email} before a task with a timeline starts, even with every tab closed.`
              : "Get an email before a task with a timeline starts, even with every tab closed. Log in to turn this on."
          }
          checked={emailReminders && canEmail}
          disabled={!canEmail}
          onChange={(next) => draft.set("emailReminders", next)}
        />

        <SaveBar
          dirty={draft.dirty}
          justSaved={draft.justSaved}
          busy={asking}
          onSave={draft.save}
          onDiscard={() => {
            setTestNote(null);
            draft.discard();
          }}
        />
      </div>
      <p className="mt-3 px-1 text-sm text-ink/50">
        Give a task a start and end time to get its reminder. Browser reminders don&apos;t arrive while every Greenboard tab is closed.
      </p>
    </section>
  );
}

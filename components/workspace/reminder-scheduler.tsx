"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  dueReminders,
  getSentReminders,
  markRemindersSent,
  nextReminderAt,
  reminderBody,
  showNotification,
  useNotificationState,
} from "@/lib/notifications";
import { getServerTasks, getTasks, isTicked, subscribeTasks } from "@/lib/tasks";
import { useSettings } from "@/lib/settings";
import { useTickColumn } from "@/lib/columns";
import { requestBoard } from "@/lib/workspace";

/** Checks at least this often, in case the clock jumps (sleep, time zone) or a timer is throttled. */
const MAX_WAIT_MS = 30_000;

/**
 * Shows task reminders while a workspace page is open. Renders nothing.
 *
 * It wakes when the next reminder is due (or every 30 seconds at most), and again whenever
 * tasks or settings change. Clicking a reminder opens the board with that task's details.
 */
export function ReminderScheduler() {
  const router = useRouter();
  const { reminders, reminderLead } = useSettings();
  const permission = useNotificationState();
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  const tickColumn = useTickColumn();
  const active = reminders && permission === "granted" && tasks !== null;

  useEffect(() => {
    if (!active || !tasks) return;
    let timer: number | undefined;

    const check = () => {
      const now = Date.now();
      const due = dueReminders(tasks, {
        now,
        leadMinutes: reminderLead,
        sent: getSentReminders(),
        ticked: (t) => isTicked(t, tickColumn),
      });
      if (due.length) {
        // Marked first, so another open tab checking at the same time skips them.
        markRemindersSent(due.map((d) => d.key), now);
        for (const { task, key } of due) {
          showNotification(task.title, {
            body: reminderBody(task, now),
            tag: `greenboard-reminder-${key}`,
            onClick: () => {
              requestBoard({ type: "openTask", id: task.id });
              router.push("/board");
            },
          });
        }
      }
      const next = nextReminderAt(tasks, { now, leadMinutes: reminderLead });
      const wait = next === null ? MAX_WAIT_MS : Math.min(Math.max(next - now, 250), MAX_WAIT_MS);
      timer = window.setTimeout(check, wait);
    };

    check();
    return () => window.clearTimeout(timer);
  }, [active, tasks, reminderLead, tickColumn, router]);

  return null;
}

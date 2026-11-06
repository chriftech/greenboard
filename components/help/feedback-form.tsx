"use client";

import { useState, type FormEvent } from "react";
import { Bug, ExternalLink, HelpCircle, Lightbulb } from "lucide-react";

/** Where feedback ends up: a pre-filled issue on the project's GitHub repo. */
const NEW_ISSUE_URL = "https://github.com/chriftech/greenboard/issues/new";

const KINDS = [
  { id: "idea", label: "Idea", prefix: "Idea", Icon: Lightbulb },
  { id: "bug", label: "Bug", prefix: "Bug", Icon: Bug },
  { id: "question", label: "Question", prefix: "Question", Icon: HelpCircle },
] as const;

type Kind = (typeof KINDS)[number]["id"];

/**
 * Greenboard has no server to receive messages, so sending opens a new GitHub
 * issue in a new tab with the title and details filled in. Nothing is sent
 * until the person submits it on GitHub.
 */
export function FeedbackForm() {
  const [kind, setKind] = useState<Kind>("idea");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");

  const ready = subject.trim().length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const k = KINDS.find((x) => x.id === kind)!;
    const body = [
      details.trim() || "_No details given._",
      "",
      "---",
      `Sent from the Greenboard Help & feedback page · ${k.label}`,
    ].join("\n");
    const params = new URLSearchParams({ title: `[${k.prefix}] ${subject.trim()}`, body });
    window.open(`${NEW_ISSUE_URL}?${params}`, "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div role="radiogroup" aria-label="Type of feedback" className="flex flex-wrap gap-2">
        {KINDS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={kind === id}
            onClick={() => setKind(id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              kind === id ? "border-deep bg-deep text-peach" : "border-ink/10 bg-paper text-ink/65 hover:border-ink/25 hover:text-ink"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink/50">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          required
          placeholder={
            kind === "bug" ? "e.g. Tasks don't save after a reload" : kind === "question" ? "e.g. Can I sync between devices?" : "e.g. Let me set reminders"
          }
          className="mt-2 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2.5 text-sm font-medium placeholder:text-ink/35 focus:border-iris focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink/50">Details</span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={
            kind === "bug"
              ? "What did you do, what did you expect, and what happened instead?"
              : "Tell us a bit more (optional)"
          }
          className="mt-2 w-full resize-y rounded-xl border border-ink/10 bg-paper px-3 py-2.5 text-sm leading-relaxed placeholder:text-ink/35 focus:border-iris focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink/50">
          Opens GitHub in a new tab with this filled in. You&apos;ll need a GitHub account to post it.
        </p>
        <button
          type="submit"
          disabled={!ready}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-deep px-5 py-2.5 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
        >
          Continue on GitHub
          <ExternalLink className="size-4" />
        </button>
      </div>
    </form>
  );
}

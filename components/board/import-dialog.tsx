"use client";

import { useRef, useState, type DragEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, CheckCircle2, FileDown, FileUp, Info, Loader2, X } from "lucide-react";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  applyImport,
  previewImport,
  previewRows,
  type ImportIssue,
  type ImportPreview,
} from "@/lib/import";

const isExcel = (file: File) =>
  /\.xlsx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const isCsv = (file: File) => /\.(csv|txt)$/i.test(file.name) || /csv|text\/plain/.test(file.type);

/** Excel support (ExcelJS) is loaded only when it's used. */
const excel = () => import("@/lib/xlsx");

type Step =
  | { kind: "choose"; error?: string }
  | { kind: "preview"; fileName: string; preview: ImportPreview }
  | { kind: "done"; count: number };

/** Import tasks from a CSV file: download the template, pick a file, check, import. */
export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"template" | "reading" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function reset() {
    setStep({ kind: "choose" });
    if (input.current) input.current.value = "";
  }

  async function read(file: File | undefined) {
    if (!file) return;
    if (/\.xls$/i.test(file.name)) {
      return setStep({ kind: "choose", error: "That’s an old Excel file (.xls). Save it as .xlsx or CSV, then try again." });
    }
    if (!isExcel(file) && !isCsv(file)) {
      return setStep({ kind: "choose", error: "Choose an Excel (.xlsx) or CSV file, like the template." });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return setStep({ kind: "choose", error: "That file is over 1 MB. Split it into smaller files and import them one at a time." });
    }
    setBusy("reading");
    try {
      const preview = isExcel(file)
        ? previewRows(await (await excel()).xlsxToRows(await file.arrayBuffer()))
        : previewImport(await file.text());
      if (preview.error) return setStep({ kind: "choose", error: preview.error });
      setStep({ kind: "preview", fileName: file.name, preview });
    } catch {
      setStep({ kind: "choose", error: "Couldn’t read that file. Open it in your spreadsheet app, save it again, and retry." });
    } finally {
      setBusy(null);
    }
  }

  async function downloadTemplate() {
    setBusy("template");
    try {
      await (await excel()).downloadImportTemplateXlsx();
    } catch {
      setStep({ kind: "choose", error: "Couldn’t create the template. Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    read(e.dataTransfer.files[0]);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        // Start fresh next time, once the closing animation is done.
        if (!next) window.setTimeout(reset, 200);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-ink/10 bg-surface text-ink shadow-[0_30px_80px_-20px_rgb(46_51_73/0.5)] outline-none transition-all duration-200 ease-[cubic-bezier(0.2,0.9,0.3,1.2)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0">
          <div className="flex items-start gap-4 p-6 pb-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-iris/10 text-iris">
              <FileUp className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-xl font-bold">Import tasks</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink/60">
                Add tasks from a spreadsheet: our Excel template, or a CSV exported from greenboard.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="-mr-2 -mt-2 grid size-9 place-items-center rounded-xl text-ink/50 transition-colors hover:bg-mist hover:text-ink">
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {step.kind === "choose" && (
              <>
                <div className="rounded-2xl bg-mist/60 p-4">
                  <p className="text-sm font-semibold">1. Start from the template</p>
                  <p className="mt-1 text-sm text-ink/60">
                    One task per row. Only <b>Title</b> is required. Status, Tag, Priority and Assignee have dropdowns
                    (with your own tags and people); Start, End and Description are optional. Opens in Excel or
                    Google Sheets.
                  </p>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    disabled={busy !== null}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-surface px-3.5 py-2 text-sm font-semibold transition-colors hover:border-ink/30 disabled:opacity-60"
                  >
                    {busy === "template" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                    Download template (.xlsx)
                  </button>
                </div>

                <p className="mt-5 text-sm font-semibold">2. Choose your file</p>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`mt-2 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-iris ${
                    dragging ? "border-iris bg-iris/5" : "border-ink/15 hover:border-ink/30"
                  }`}
                >
                  {busy === "reading" ? (
                    <Loader2 className="size-7 animate-spin text-iris" />
                  ) : (
                    <FileUp className="size-7 text-ink/40" />
                  )}
                  <span className="mt-2 text-sm font-semibold">{busy === "reading" ? "Reading…" : "Choose a file"}</span>
                  <span className="mt-0.5 text-xs text-ink/50">Excel (.xlsx) or CSV · or drag it here · up to {MAX_IMPORT_ROWS} tasks</span>
                  <input
                    ref={input}
                    type="file"
                    disabled={busy !== null}
                    accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    className="sr-only"
                    onChange={(e) => read(e.target.files?.[0])}
                  />
                </label>
                {step.error && (
                  <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-coral/10 px-3 py-2.5 text-sm text-coral">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {step.error}
                  </p>
                )}
              </>
            )}

            {step.kind === "preview" && <PreviewSummary fileName={step.fileName} preview={step.preview} />}

            {step.kind === "done" && (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 className="size-12 text-success" />
                <p className="mt-3 font-display text-lg font-bold">
                  Imported {step.count} {step.count === 1 ? "task" : "tasks"}
                </p>
                <p className="mt-1 text-sm text-ink/60">They&rsquo;re at the top of your board.</p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-ink/10 px-6 py-4 sm:flex-row sm:justify-end">
            {step.kind === "preview" ? (
              <>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-paper"
                >
                  Choose another file
                </button>
                <button
                  type="button"
                  disabled={step.preview.tasks.length === 0}
                  onClick={() => setStep({ kind: "done", count: applyImport(step.preview) })}
                  className="rounded-xl bg-deep px-4 py-2.5 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                >
                  Import {step.preview.tasks.length} {step.preview.tasks.length === 1 ? "task" : "tasks"}
                </button>
              </>
            ) : (
              <Dialog.Close className="rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-paper">
                {step.kind === "done" ? "Done" : "Cancel"}
              </Dialog.Close>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreviewSummary({ fileName, preview }: { fileName: string; preview: ImportPreview }) {
  const total = preview.tasks.length;
  const completed = preview.tasks.filter((t) => t.done).length;
  const inProgress = preview.tasks.filter((t) => !t.done && t.inProgress).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-mist/60 p-4">
        <p className="truncate text-xs font-semibold uppercase tracking-widest text-ink/45" title={fileName}>
          {fileName}
        </p>
        <p className="mt-1 font-display text-lg font-bold">
          {total === 0 ? "No tasks to import" : `${total} ${total === 1 ? "task" : "tasks"} ready to import`}
        </p>
        {total > 0 && (
          <p className="text-sm text-ink/60">
            {total - completed - inProgress} todo, {inProgress} pending, {completed} completed. They&rsquo;ll go at the
            top of your board.
          </p>
        )}
      </div>

      {(preview.newTags.length > 0 || preview.newPeople.length > 0) && (
        <div className="flex items-start gap-2 text-sm text-ink/70">
          <Info className="mt-0.5 size-4 shrink-0 text-iris" />
          <p>
            {preview.newTags.length > 0 && (
              <>
                New {preview.newTags.length === 1 ? "tag" : "tags"}: <b>{preview.newTags.join(", ")}</b>.{" "}
              </>
            )}
            {preview.newPeople.length > 0 && (
              <>
                New {preview.newPeople.length === 1 ? "person" : "people"}: <b>{preview.newPeople.join(", ")}</b>.
              </>
            )}
          </p>
        </div>
      )}

      <IssueList title="Rows that won’t be imported" tone="coral" issues={preview.skipped} />
      <IssueList title="Imported with changes" tone="sunny" issues={preview.warnings} />

      {preview.ignoredColumns.length > 0 && (
        <p className="text-xs text-ink/50">
          Ignored {preview.ignoredColumns.length === 1 ? "column" : "columns"}: {preview.ignoredColumns.join(", ")}.
        </p>
      )}
    </div>
  );
}

const SHOWN = 5;

function IssueList({ title, tone, issues }: { title: string; tone: "coral" | "sunny"; issues: ImportIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone === "coral" ? "border-coral/30 bg-coral/5" : "border-sunny/40 bg-sunny/10"}`}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className={`size-4 ${tone === "coral" ? "text-coral" : "text-[#b7791f] dark:text-sunny"}`} />
        {title} ({issues.length})
      </p>
      <ul className="mt-1.5 space-y-1 text-sm text-ink/70">
        {issues.slice(0, SHOWN).map((issue, i) => (
          <li key={i}>
            <span className="font-semibold tabular-nums">Row {issue.row}:</span> {issue.message}
          </li>
        ))}
        {issues.length > SHOWN && <li className="text-ink/50">…and {issues.length - SHOWN} more.</li>}
      </ul>
    </div>
  );
}

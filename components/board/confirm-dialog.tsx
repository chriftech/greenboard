"use client";

import type { ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Trash2 } from "lucide-react";

/** Branded confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        {/* Sits above the task details drawer (z-50). */}
        <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-forest/30 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[61] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-forest/10 bg-white p-6 text-forest shadow-[0_30px_80px_-20px_rgb(7_53_42/0.5)] outline-none transition-all duration-200 ease-[cubic-bezier(0.2,0.9,0.3,1.2)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0">
          <div className="grid size-12 place-items-center rounded-2xl bg-coral/10 text-coral">
            <Trash2 className="size-6" />
          </div>
          <AlertDialog.Title className="mt-4 font-display text-xl font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-[15px] leading-relaxed text-forest/65">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close className="rounded-xl border border-forest/15 bg-white px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-cream">
              Cancel
            </AlertDialog.Close>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className="rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgb(255_111_89/0.8)] transition-transform hover:-translate-y-0.5"
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

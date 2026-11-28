"use client";

import dynamic from "next/dynamic";

/**
 * The description editor (Tiptap and ProseMirror) is the biggest part of the board's code, so it
 * loads on its own. The board fetches it in the background once it's idle (preloadTaskEditor), so
 * it's usually ready before a task is opened or created. A box the editor's size holds its place meanwhile.
 */
const loadEditor = () => import("./rich-text-editor");
export const preloadTaskEditor = () => void loadEditor();
export const RichTextEditor = dynamic(() => loadEditor().then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[9.5rem] rounded-2xl border border-ink/10 bg-surface" />,
});

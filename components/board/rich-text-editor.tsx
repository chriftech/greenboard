"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Italic, List, Underline } from "lucide-react";

export type RichTextValue = { html: string; text: string };

/**
 * Minimal rich-text editor: bold, italic, underline and bullet lists.
 * Anything else (pasted headings, links, images…) is stripped by the
 * editor's schema, so stored HTML only ever contains these marks.
 */
export function RichTextEditor({
  initialHtml,
  onChange,
  placeholder = "Add more details…",
}: {
  initialHtml?: string;
  onChange: (value: RichTextValue) => void;
  placeholder?: string;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        orderedList: false,
        strike: false,
        link: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml || "",
    editorProps: {
      attributes: {
        class: "gb-prose min-h-40 px-4 py-3 text-[15px] leading-relaxed text-ink focus:outline-none",
        "aria-label": "Task description",
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText({ blockSeparator: "\n" }).trim();
      onChangeRef.current({ html: text ? editor.getHTML() : "", text });
    },
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-surface transition-colors focus-within:border-iris focus-within:shadow-[0_0_0_4px_rgb(79_107_237/0.12)]">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      underline: editor?.isActive("underline") ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
    }),
  });

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl+";

  const buttons = [
    { key: "bold", label: "Bold", shortcut: `${mod}B`, Icon: Bold, run: (e: Editor) => e.chain().focus().toggleBold().run() },
    { key: "italic", label: "Italic", shortcut: `${mod}I`, Icon: Italic, run: (e: Editor) => e.chain().focus().toggleItalic().run() },
    { key: "underline", label: "Underline", shortcut: `${mod}U`, Icon: Underline, run: (e: Editor) => e.chain().focus().toggleUnderline().run() },
    { key: "bulletList", label: "Bullet list", shortcut: `${mod}${isMac ? "⇧" : "Shift+"}8`, Icon: List, run: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  ] as const;

  return (
    <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-1 border-b border-ink/10 bg-paper px-2 py-1.5">
      {buttons.map(({ key, label, shortcut, Icon, run }, i) => {
        const active = state?.[key] ?? false;
        return (
          <span key={key} className="flex items-center">
            {i === 3 && <span aria-hidden className="mx-1 h-5 w-px bg-ink/10" />}
            <button
              type="button"
              disabled={!editor}
              // Keep the editor's selection when clicking a toolbar button.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor && run(editor)}
              aria-label={label}
              aria-pressed={active}
              title={`${label} (${shortcut})`}
              className={`grid size-8 place-items-center rounded-lg transition-colors ${
                active ? "bg-deep text-peach" : "text-ink/60 hover:bg-mist hover:text-ink"
              }`}
            >
              <Icon className="size-4" strokeWidth={2.5} />
            </button>
          </span>
        );
      })}
    </div>
  );
}

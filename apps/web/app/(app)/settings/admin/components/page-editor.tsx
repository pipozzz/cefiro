"use client";

import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

const btn = "rounded px-2 py-1 text-sm transition hover:bg-content3";
const btnActive = "bg-content3 text-foreground";

/**
 * A small WYSIWYG editor for page bodies. Edits rich text but reads/writes
 * Markdown (via tiptap-markdown), so the stored format stays Markdown and the
 * public page keeps rendering with react-markdown (no HTML sanitizer needed).
 * Uncontrolled — initialised once from `value`; the parent keys it per page so
 * switching pages remounts it with fresh content.
 */
export function PageEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  const editor = useEditor({
    // Required in Next/SSR to avoid a hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "nofollow noopener noreferrer", target: "_blank" },
      }),
      Markdown.configure({ html: false, linkify: true, transformPastedText: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "page-editor-content min-h-[280px] px-3 py-2 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  });

  if (!editor) {
    return <div className="border-border h-[320px] rounded-lg border" />;
  }

  const promptLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();

      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="border-border bg-content2 flex flex-wrap items-center gap-1 border-b p-1">
        <button
          className={`${btn} ${editor.isActive("bold") ? btnActive : ""}`}
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <b>B</b>
        </button>
        <button
          className={`${btn} ${editor.isActive("italic") ? btnActive : ""}`}
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <i>I</i>
        </button>
        <button
          className={`${btn} ${editor.isActive("heading", { level: 2 }) ? btnActive : ""}`}
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          className={`${btn} ${editor.isActive("heading", { level: 3 }) ? btnActive : ""}`}
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>
        <button
          className={`${btn} ${editor.isActive("bulletList") ? btnActive : ""}`}
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </button>
        <button
          className={`${btn} ${editor.isActive("orderedList") ? btnActive : ""}`}
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>
        <button
          className={`${btn} ${editor.isActive("link") ? btnActive : ""}`}
          type="button"
          onClick={promptLink}
        >
          Link
        </button>
        <button
          className={btn}
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          &ldquo; Quote
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

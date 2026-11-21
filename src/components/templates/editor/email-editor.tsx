"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { EditorToolbar } from "@/components/templates/editor/editor-toolbar";
import { EmailButton, EmailImage, SmallText } from "@/components/templates/editor/extensions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type EmailEditorProps = {
  initialContent: string;
  onChange: (html: string) => void;
  className?: string;
  canDeleteImages?: boolean;
  // Passed through by <FormControl> so the label and error message are
  // associated with the editable area.
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function EmailEditor({
  initialContent,
  onChange,
  className,
  canDeleteImages = false,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: EmailEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Keep the schema (and toolbar) limited to what email HTML should
        // actually contain — no code blocks, strikethrough, or blockquotes.
        codeBlock: false,
        code: false,
        blockquote: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { target: null, rel: "noopener noreferrer" },
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      EmailImage,
      EmailButton,
      SmallText,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Email content",
        class: "email-canvas min-h-80 px-6 py-8 focus:outline-none sm:px-10",
      },
      handleDOMEvents: {
        // Links inside the (non-editable) CTA button would otherwise
        // navigate away from the editor when clicked.
        click: (_view, event) => {
          if (event.target instanceof HTMLElement && event.target.closest("a")) {
            event.preventDefault();
          }
          return false;
        },
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    if (ariaDescribedBy) dom.setAttribute("aria-describedby", ariaDescribedBy);
    dom.setAttribute("aria-invalid", String(Boolean(ariaInvalid)));
  }, [editor, ariaDescribedBy, ariaInvalid]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        ariaInvalid && "border-destructive",
        className
      )}
    >
      {editor ? <EditorToolbar editor={editor} canDeleteImages={canDeleteImages} /> : <Skeleton className="h-11 rounded-none" />}
      {/* The canvas mimics the inbox: a centered, email-width white card. */}
      <div className="max-h-[70vh] overflow-y-auto bg-[#f4f4f5] p-3 sm:p-6">
        <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/5">
          {editor ? <EditorContent editor={editor} /> : <Skeleton className="h-80 rounded-none" />}
        </div>
      </div>
    </div>
  );
}

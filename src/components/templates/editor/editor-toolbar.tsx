"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Undo2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolbarButton } from "@/components/templates/editor/toolbar-button";
import {
  ButtonPopover,
  ImagePopover,
  LinkPopover,
} from "@/components/templates/editor/editor-popovers";
import { EMAIL_BUTTON_NODE, SMALL_TEXT_SIZE } from "@/components/templates/editor/extensions";
import { PersonalizeMenu } from "@/components/templates/personalize-menu";
import type { EmailButtonAlign } from "@/lib/email-button";

const BLOCK_TYPES = [
  { value: "paragraph", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: SMALL_TEXT_SIZE, label: "Small text" },
] as const;

type BlockType = (typeof BLOCK_TYPES)[number]["value"];

const ALIGNMENTS: { value: EmailButtonAlign; label: string; icon: typeof AlignLeft }[] = [
  { value: "left", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
];

const HEADING_LEVELS = { h1: 1, h2: 2, h3: 3 } as const;

function getBlockType(editor: Editor): BlockType {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("paragraph", { textSize: SMALL_TEXT_SIZE })) return SMALL_TEXT_SIZE;
  return "paragraph";
}

function getAlignment(editor: Editor): EmailButtonAlign {
  if (editor.isActive(EMAIL_BUTTON_NODE)) {
    return editor.getAttributes(EMAIL_BUTTON_NODE).align ?? "center";
  }
  if (editor.isActive({ textAlign: "center" })) return "center";
  if (editor.isActive({ textAlign: "right" })) return "right";
  return "left";
}

function ToolbarDivider() {
  return <Separator orientation="vertical" className="mx-1 h-6!" />;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      blockType: getBlockType(e),
      alignment: getAlignment(e),
      isBold: e.isActive("bold"),
      isItalic: e.isActive("italic"),
      isLink: e.isActive("link"),
      isImage: e.isActive("image"),
      isButton: e.isActive(EMAIL_BUTTON_NODE),
      isBulletList: e.isActive("bulletList"),
      isOrderedList: e.isActive("orderedList"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  function setBlockType(value: BlockType) {
    const chain = editor.chain().focus();
    if (value === "paragraph" || value === SMALL_TEXT_SIZE) {
      chain
        .setParagraph()
        .updateAttributes("paragraph", { textSize: value === SMALL_TEXT_SIZE ? SMALL_TEXT_SIZE : null })
        .run();
    } else {
      chain.setHeading({ level: HEADING_LEVELS[value] }).run();
    }
  }

  function setAlignment(value: EmailButtonAlign) {
    if (state.isButton) {
      editor.chain().focus().updateAttributes(EMAIL_BUTTON_NODE, { align: value }).run();
    } else {
      editor.chain().focus().setTextAlign(value).run();
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5"
    >
      <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 />
      </ToolbarButton>

      <ToolbarDivider />

      <Select value={state.blockType} onValueChange={(value) => setBlockType(value as BlockType)}>
        <SelectTrigger size="sm" className="w-32" aria-label="Text style">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BLOCK_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToolbarDivider />

      <ToolbarButton
        label="Bold"
        active={state.isBold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.isItalic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <LinkPopover editor={editor} active={state.isLink} />

      <ToolbarDivider />

      <ToolbarButton
        label="Bullet list"
        active={state.isBulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.isOrderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>

      <ToolbarDivider />

      {ALIGNMENTS.map(({ value, label, icon: Icon }) => (
        <ToolbarButton
          key={value}
          label={label}
          active={state.alignment === value}
          onClick={() => setAlignment(value)}
        >
          <Icon />
        </ToolbarButton>
      ))}

      <ToolbarDivider />

      <ImagePopover editor={editor} active={state.isImage} />
      <ButtonPopover editor={editor} active={state.isButton} />
      <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus />
      </ToolbarButton>

      <div className="ml-auto">
        <PersonalizeMenu onInsert={(token) => editor.chain().focus().insertContent(token).run()} />
      </div>
    </div>
  );
}

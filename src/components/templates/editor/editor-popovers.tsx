"use client";

import { useId, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Image as ImageIcon, Link2, Link2Off, MousePointerClick, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PopoverForm, ToolbarButton } from "@/components/templates/editor/toolbar-button";
import { EMAIL_BUTTON_NODE, IMAGE_NODE } from "@/components/templates/editor/extensions";
import { TEMPLATE_IMAGE_STYLE } from "@/lib/template-images";
import { EMAIL_BUTTON_DEFAULTS, type EmailButtonAttrs } from "@/lib/email-button";
import { normalizeUrl } from "@/lib/email-html";

const INVALID_URL_MESSAGE = "Enter a valid web address, like example.com";

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function LinkPopover({ editor, active }: { editor: Editor; active: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [needsText, setNeedsText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setUrl(editor.getAttributes("link").href ?? "");
    setText("");
    setError(null);
    // With nothing selected there is no text to turn into a link, so ask for it.
    setNeedsText(editor.state.selection.empty && !editor.isActive("link"));
  }

  function apply() {
    const href = normalizeUrl(url);
    if (!href) {
      setError(INVALID_URL_MESSAGE);
      return;
    }
    const chain = editor.chain().focus();
    if (needsText) {
      chain
        .insertContent({ type: "text", text: text.trim() || url.trim(), marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      chain.extendMarkRange("link").setLink({ href }).run();
    }
    setOpen(false);
  }

  function remove() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Link" active={active}>
          <Link2 />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverForm onSubmit={apply}>
          {needsText && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-text`}>Text to display</Label>
              <Input
                id={`${id}-text`}
                placeholder="e.g. Read more"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-url`}>Link address</Label>
            <Input
              id={`${id}-url`}
              placeholder="example.com"
              value={url}
              aria-invalid={Boolean(error)}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
            />
            <FieldError message={error} />
          </div>
          <div className="flex justify-between gap-2">
            {active && (
              <Button type="button" variant="outline" size="sm" onClick={remove}>
                <Link2Off />
                Remove link
              </Button>
            )}
            <Button type="submit" size="sm" className="ml-auto" disabled={!url.trim()}>
              {active ? "Update" : "Add link"}
            </Button>
          </div>
        </PopoverForm>
      </PopoverContent>
    </Popover>
  );
}

type ImagePopoverProps = {
  editor: Editor;
  active: boolean;
  // Controlled so the toolbar can open it right after an upload, to edit alt text.
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImagePopover({ editor, active, open, onOpenChange }: ImagePopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Image or logo from a link" active={active}>
          <ImageIcon />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        {/* Mounted on open, so fields start from the selected image's settings. */}
        <ImageForm editor={editor} active={active} onDone={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  );
}

function ImageForm({ editor, active, onDone }: { editor: Editor; active: boolean; onDone: () => void }) {
  const id = useId();
  const [initial] = useState(() => (active ? editor.getAttributes(IMAGE_NODE) : {}));
  const [url, setUrl] = useState<string>(initial.src ?? "");
  const [alt, setAlt] = useState<string>(initial.alt ?? "");
  const [width, setWidth] = useState(initial.width ? String(initial.width) : "");
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const src = normalizeUrl(url);
    if (!src || src.startsWith("mailto:")) {
      setError("Enter a valid image address, like https://example.com/logo.png");
      return;
    }
    const parsedWidth = Number.parseInt(width, 10);
    const attrs = {
      src,
      alt: alt.trim(),
      width: Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : undefined,
    };
    if (active) {
      editor.chain().focus().updateAttributes(IMAGE_NODE, { ...attrs, width: attrs.width ?? null }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({ type: IMAGE_NODE, attrs: { ...attrs, style: TEMPLATE_IMAGE_STYLE } })
        .run();
    }
    onDone();
  }

  return (
    <PopoverForm onSubmit={apply}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-url`}>Image address</Label>
        <Input
          id={`${id}-url`}
          placeholder="https://example.com/logo.png"
          value={url}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
        />
        <FieldError message={error} />
        <p className="text-xs text-muted-foreground">
          Use a publicly accessible image link, or upload one with the Insert image button.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-alt`}>Description (alt text)</Label>
        <Input
          id={`${id}-alt`}
          placeholder="e.g. Company logo"
          value={alt}
          autoFocus={active}
          onChange={(e) => setAlt(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Shown when images are blocked and read aloud by screen readers.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-width`}>Width in pixels (optional)</Label>
        <Input
          id={`${id}-width`}
          type="number"
          inputMode="numeric"
          min={16}
          max={600}
          placeholder="e.g. 160 for a logo"
          value={width}
          onChange={(e) => setWidth(e.target.value)}
        />
      </div>
      <Button type="submit" size="sm" className="self-end" disabled={!url.trim()}>
        {active ? "Update image" : "Insert image"}
      </Button>
    </PopoverForm>
  );
}

export function ButtonPopover({ editor, active }: { editor: Editor; active: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(EMAIL_BUTTON_DEFAULTS.text);
  const [url, setUrl] = useState("");
  const [color, setColor] = useState(EMAIL_BUTTON_DEFAULTS.color);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    const attrs = (active ? editor.getAttributes(EMAIL_BUTTON_NODE) : {}) as Partial<EmailButtonAttrs>;
    setText(attrs.text ?? EMAIL_BUTTON_DEFAULTS.text);
    setUrl(attrs.href ?? "");
    setColor(attrs.color ?? EMAIL_BUTTON_DEFAULTS.color);
    setError(null);
  }

  function apply() {
    const href = normalizeUrl(url);
    if (!href) {
      setError(INVALID_URL_MESSAGE);
      return;
    }
    const attrs = { text: text.trim() || EMAIL_BUTTON_DEFAULTS.text, href, color };
    if (active) {
      editor.chain().focus().updateAttributes(EMAIL_BUTTON_NODE, attrs).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({ type: EMAIL_BUTTON_NODE, attrs: { ...attrs, align: EMAIL_BUTTON_DEFAULTS.align } })
        .run();
    }
    setOpen(false);
  }

  function remove() {
    editor.chain().focus().deleteSelection().run();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Button (call to action)" active={active}>
          <MousePointerClick />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverForm onSubmit={apply}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-text`}>Button text</Label>
            <Input
              id={`${id}-text`}
              maxLength={60}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-url`}>Button link</Label>
            <Input
              id={`${id}-url`}
              placeholder="example.com/offer"
              value={url}
              aria-invalid={Boolean(error)}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
            />
            <FieldError message={error} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${id}-color`}>Button color</Label>
            <input
              id={`${id}-color`}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-14 cursor-pointer rounded-md border bg-transparent p-0.5"
            />
          </div>
          <div className="flex justify-between gap-2">
            {active && (
              <Button type="button" variant="outline" size="sm" onClick={remove}>
                <Trash2 />
                Remove
              </Button>
            )}
            <Button type="submit" size="sm" className="ml-auto" disabled={!url.trim()}>
              {active ? "Update button" : "Insert button"}
            </Button>
          </div>
        </PopoverForm>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { ImagePlus, Images, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { deleteTemplateImageAction, listTemplateImagesAction } from "@/app/(app)/templates/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ToolbarButton } from "@/components/templates/editor/toolbar-button";
import { insertImageAtCursor } from "@/components/templates/editor/extensions";
import {
  MAX_TEMPLATE_IMAGE_BYTES,
  TEMPLATE_IMAGE_ACCEPT,
  TEMPLATE_IMAGE_SIZE_ERROR,
  TEMPLATE_IMAGE_STYLE,
  TEMPLATE_IMAGE_TYPE_ERROR,
  TEMPLATE_IMAGE_TYPES,
  formatFileSize,
} from "@/lib/template-images";
import type { ActionResult } from "@/types/action";

const UPLOAD_ENDPOINT = "/api/templates/images";
const UPLOAD_FAILED = "The image couldn't be uploaded. Please try again.";

type UploadedImage = { id: string; url: string; size: number };

// Quick client-side checks for a friendly message; the server re-checks the
// actual file contents.
function clientValidationError(file: File): string | null {
  if (!(file.type in TEMPLATE_IMAGE_TYPES)) return TEMPLATE_IMAGE_TYPE_ERROR;
  if (file.size > MAX_TEMPLATE_IMAGE_BYTES) return TEMPLATE_IMAGE_SIZE_ERROR;
  return null;
}

async function uploadImage(file: File): Promise<ActionResult<UploadedImage>> {
  const body = new FormData();
  body.append("file", file);
  try {
    const response = await fetch(UPLOAD_ENDPOINT, { method: "POST", body });
    const result = (await response.json()) as ActionResult<UploadedImage>;
    return result;
  } catch {
    return { success: false, error: UPLOAD_FAILED };
  }
}

function insertUploadedImage(editor: Editor, image: UploadedImage) {
  insertImageAtCursor(editor, { src: image.url, alt: "", style: TEMPLATE_IMAGE_STYLE });
}

// Hidden file input + upload state, shared by the toolbar button and the panel.
function useImageUpload(onUploaded: (image: UploadedImage) => void) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const invalid = clientValidationError(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setIsUploading(true);
    const result = await uploadImage(file);
    setIsUploading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onUploaded(result.data);
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={TEMPLATE_IMAGE_ACCEPT}
      className="hidden"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => {
        const file = event.target.files?.[0];
        // Reset so choosing the same file again still triggers a change.
        event.target.value = "";
        void handleFile(file);
      }}
    />
  );

  return { input, isUploading, openPicker: () => inputRef.current?.click() };
}

type InsertImageButtonProps = {
  editor: Editor;
  // Called once the image is in the editor (and selected), e.g. to edit alt text.
  onInserted: () => void;
};

export function InsertImageButton({ editor, onInserted }: InsertImageButtonProps) {
  const { input, isUploading, openPicker } = useImageUpload((image) => {
    insertUploadedImage(editor, image);
    onInserted();
  });

  return (
    <>
      {input}
      <ToolbarButton
        label={isUploading ? "Uploading image..." : "Insert image (JPG, PNG, GIF, WebP up to 2 MB)"}
        disabled={isUploading}
        onClick={openPicker}
      >
        {isUploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
      </ToolbarButton>
    </>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; images: UploadedImage[] };

type ImagesPanelProps = InsertImageButtonProps & {
  canDelete: boolean;
};

export function ImagesPanel({ editor, onInserted, canDelete }: ImagesPanelProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [toDelete, setToDelete] = useState<UploadedImage | null>(null);
  const [, startTransition] = useTransition();
  // Inserted once the sheet has closed, so returning focus doesn't fight the
  // editor selection or the alt-text popover.
  const pendingInsert = useRef<UploadedImage | null>(null);

  function load() {
    setState({ status: "loading" });
    startTransition(async () => {
      const result = await listTemplateImagesAction();
      setState(
        result.success ? { status: "ready", images: result.data } : { status: "error", message: result.error }
      );
    });
  }

  const { input, isUploading, openPicker } = useImageUpload((image) => {
    setState((current) =>
      current.status === "ready" ? { status: "ready", images: [image, ...current.images] } : current
    );
    toast.success("Image uploaded");
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  function insert(image: UploadedImage) {
    pendingInsert.current = image;
    setOpen(false);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const result = await deleteTemplateImageAction(toDelete.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const deletedId = toDelete.id;
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", images: current.images.filter((image) => image.id !== deletedId) }
        : current
    );
    setToDelete(null);
    toast.success("Image deleted");
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <ToolbarButton label="Your images">
          <Images />
        </ToolbarButton>
      </SheetTrigger>
      <SheetContent
        className="w-full sm:max-w-md"
        onCloseAutoFocus={(event) => {
          const image = pendingInsert.current;
          if (!image) return;
          pendingInsert.current = null;
          event.preventDefault();
          insertUploadedImage(editor, image);
          onInserted();
        }}
      >
        <SheetHeader>
          <SheetTitle>Your images</SheetTitle>
          <SheetDescription>
            Images uploaded by your team. Click one to insert it at the cursor.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          {input}
          <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={openPicker}>
            {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {isUploading ? "Uploading..." : "Upload image"}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG, GIF, or WebP, up to 2 MB.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {state.status === "loading" && <LoadingState message="Loading images..." />}
          {state.status === "error" && (
            <ErrorState title="Couldn't load images" description={state.message} onRetry={load} />
          )}
          {state.status === "ready" && state.images.length === 0 && (
            <EmptyState
              icon={Images}
              title="No images yet"
              description="Upload an image to use it in your templates."
            />
          )}
          {state.status === "ready" && state.images.length > 0 && (
            <ul className="grid grid-cols-2 gap-3">
              {state.images.map((image) => (
                <li key={image.id} className="overflow-hidden rounded-md border bg-card">
                  <button
                    type="button"
                    onClick={() => insert(image)}
                    className="group relative block aspect-[4/3] w-full bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Insert image (${formatFileSize(image.size)})`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- user uploads served by the web server, not next/image */}
                    <img src={image.url} alt="" loading="lazy" className="size-full object-contain" />
                    <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Plus className="size-3.5" />
                      Insert
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-2">
                    <span className="text-xs text-muted-foreground">{formatFileSize(image.size)}</span>
                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete image"
                        title="Delete image"
                        onClick={() => setToDelete(image)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(next) => !next && setToDelete(null)}
        title="Delete this image?"
        description="It will be removed from your images. Templates and emails that already use it, including emails already sent, will show a broken image."
        onConfirm={confirmDelete}
      />
    </Sheet>
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_TEMPLATE_IMAGE_BYTES, TEMPLATE_IMAGE_SIZE_ERROR } from "@/lib/template-images";
import {
  TemplateImageValidationError,
  uploadTemplateImage,
  type TemplateImageSummary,
} from "@/services/template-image-service";
import type { ActionResult } from "@/types/action";

// An API route rather than a Server Action: Server Actions cap request bodies
// at 1 MB by default, and raising that would apply to every action.

const UPLOAD_RATE_LIMIT = { maxAttempts: 60, windowMs: 15 * 60 * 1000 };
// Allowance for multipart boundaries/headers on top of the file itself.
const MAX_REQUEST_BYTES = MAX_TEMPLATE_IMAGE_BYTES + 64 * 1024;

function reply(result: ActionResult<TemplateImageSummary>, status: number) {
  return NextResponse.json(result, { status });
}

function fail(error: string, status: number) {
  return reply({ success: false, error }, status);
}

// Session cookies are SameSite=Lax, which already blocks cross-site POSTs;
// this is defense in depth against CSRF from another origin.
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return fail("This request isn't allowed.", 403);
  }

  const user = await getCurrentUser();
  if (!user) {
    return fail("Your session has expired. Please sign in again.", 401);
  }

  const { allowed } = checkRateLimit(`template-image-upload:${user.id}`, UPLOAD_RATE_LIMIT);
  if (!allowed) {
    return fail("You've uploaded a lot of images recently. Please wait a few minutes and try again.", 429);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return fail(TEMPLATE_IMAGE_SIZE_ERROR, 413);
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail("The upload couldn't be read. Please try again.", 400);
  }
  if (!(file instanceof File) || file.size === 0) {
    return fail("Please choose an image to upload.", 400);
  }
  if (file.size > MAX_TEMPLATE_IMAGE_BYTES) {
    return fail(TEMPLATE_IMAGE_SIZE_ERROR, 413);
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = await uploadTemplateImage(user.organizationId, bytes);
    return reply({ success: true, data: image }, 201);
  } catch (error) {
    if (error instanceof TemplateImageValidationError) {
      return fail(error.message, 400);
    }
    console.error("Failed to upload template image:", error);
    return fail("The image couldn't be uploaded. Please try again.", 500);
  }
}

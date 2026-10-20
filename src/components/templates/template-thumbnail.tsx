import { renderPersonalizedEmail } from "@/lib/email-render";

// Renders the real email at double size and scales it down by half, so the
// thumbnail shows the actual desktop layout rather than a squashed reflow.
export function TemplateThumbnail({ subject, html }: { subject: string; html: string }) {
  const rendered = renderPersonalizedEmail({ subject, htmlContent: html });

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden border-b bg-[#f4f4f5]">
      <iframe
        title=""
        aria-hidden="true"
        srcDoc={rendered.html}
        sandbox=""
        tabIndex={-1}
        loading="lazy"
        className="pointer-events-none absolute top-0 left-0 h-[200%] w-[200%] origin-top-left scale-50 border-0"
      />
    </div>
  );
}

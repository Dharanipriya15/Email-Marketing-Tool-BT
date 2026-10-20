import type { Metadata } from "next";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { isUnsubscribed } from "@/services/unsubscribe-service";
import { UnsubscribeConfirm } from "@/components/unsubscribe/unsubscribe-confirm";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

type UnsubscribePageProps = {
  params: Promise<{ token: string }>;
};

// Shows a hint of the address without fully exposing it to anyone holding the link.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 text-center shadow-sm">{children}</div>
    </main>
  );
}

// Opening this page (GET) never unsubscribes by itself; link scanners and
// previews would otherwise unsubscribe people. The user must confirm.
export default async function UnsubscribePage({ params }: UnsubscribePageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const payload = verifyUnsubscribeToken(token);

  if (!payload) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Invalid unsubscribe link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This unsubscribe link is invalid or incomplete. Please use the link from the most recent email you received.
        </p>
      </Card>
    );
  }

  let alreadyUnsubscribed = false;
  try {
    alreadyUnsubscribed = await isUnsubscribed(payload.organizationId, payload.email);
  } catch {
    alreadyUnsubscribed = false;
  }

  return (
    <Card>
      <UnsubscribeConfirm token={token} maskedEmail={maskEmail(payload.email)} alreadyUnsubscribed={alreadyUnsubscribed} />
    </Card>
  );
}
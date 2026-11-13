import { notFound } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { Mail, Activity } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContactStatusBadge } from "@/components/shared/status-badge";
import { ContactDetailActions } from "@/components/contacts/contact-detail-actions";
import {
  ContactListBadges,
  ContactListsAddButton,
} from "@/components/contacts/contact-lists-card-actions";
import { listContactListOptions } from "@/services/contact-list-service";
import {
  getContactDetail,
  getContactRecentEvents,
} from "@/services/contact-service";

type ContactDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatEventType(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function formatRecipientStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const contact = await getContactDetail(user.organizationId, id);
  if (!contact) {
    notFound();
  }

  const [events, allLists] = await Promise.all([
    getContactRecentEvents(user.organizationId, id),
    listContactListOptions(user.organizationId),
  ]);
  const memberships = contact.listMemberships.map((m) => m.contactList);
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={name}
        description={contact.email}
        actions={
          <ContactDetailActions
            contactId={contact.id}
            contactName={name}
            defaultValues={{
              firstName: contact.firstName ?? "",
              lastName: contact.lastName ?? "",
              email: contact.email,
              company: contact.company ?? "",
              phone: contact.phone ?? "",
              industry: contact.industry ?? "",
              location: contact.location ?? "",
              status: contact.status,
            }}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <DetailRow label="Email" value={contact.email} />
            <DetailRow label="Phone" value={contact.phone || "—"} />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <ContactStatusBadge status={contact.status} />
            </div>
            <DetailRow
              label="Added"
              value={format(contact.createdAt, "MMM d, yyyy")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <DetailRow label="Company" value={contact.company || "—"} />
            <DetailRow label="Industry" value={contact.industry || "—"} />
            <DetailRow label="Location" value={contact.location || "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lists</CardTitle>
            <CardAction>
              <ContactListsAddButton
                contactId={contact.id}
                memberships={memberships}
                allLists={allLists}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ContactListBadges contactId={contact.id} memberships={memberships} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Campaign Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.campaignRecipients.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No campaign activity yet"
              description="Campaigns sent to this contact will appear here."
              className="border-0 py-10"
            />
          ) : (
            <ul className="flex flex-col divide-y">
              {contact.campaignRecipients.map((recipient) => (
                <li
                  key={recipient.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span className="font-medium">{recipient.campaign.name}</span>
                  <span className="text-muted-foreground">
                    {formatRecipientStatus(recipient.status)} ·{" "}
                    {formatDistanceToNow(recipient.createdAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No events yet"
              description="Opens, clicks, and other events will appear here."
              className="border-0 py-10"
            />
          ) : (
            <ul className="flex flex-col divide-y">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span>
                    {formatEventType(event.type)} — {event.campaign.name}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(event.occurredAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

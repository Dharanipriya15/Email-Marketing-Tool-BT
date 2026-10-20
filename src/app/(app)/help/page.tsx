import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FAQS = [
  {
    question: "How do I import contacts?",
    answer: "Go to Contacts and click Import CSV to upload and map your contact list.",
  },
  {
    question: "How do I send a campaign?",
    answer: "Go to Campaigns, click Create Campaign, and follow the guided steps to select recipients, choose a template, preview, and send or schedule.",
  },
  {
    question: "How do contacts unsubscribe?",
    answer: "Every campaign email includes an unsubscribe link. Unsubscribed contacts are automatically excluded from future campaigns.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Help"
        description="Answers to common questions about using this platform"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {FAQS.map((faq) => (
          <Card key={faq.question}>
            <CardHeader>
              <CardTitle className="text-sm">{faq.question}</CardTitle>
              <CardDescription>{faq.answer}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

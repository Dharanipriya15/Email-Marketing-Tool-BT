import { buildButtonHtml } from "@/lib/email-button";
import { SMALL_TEXT_STYLE } from "@/lib/email-styles";

// Default (starter) templates seeded for BoilerTech Energy. Content uses only
// markup the Tiptap editor schema and sanitizer allow (headings, paragraphs,
// bold, lists, links, image, hr and the table-based CTA button), so templates
// round-trip through editing and saving unchanged. Personalization tokens use
// the {{token}} syntax from lib/personalization.ts.

export type DefaultTemplate = {
  name: string;
  subject: string;
  previewText: string;
  htmlContent: string;
};

const COMPANY = "BoilerTech Energy";
const SITE_URL = "https://boilertechenergy.com";
const LOGO_URL = "https://boilertechenergy.com/assets/btlogo.png";
const BUTTON_COLOR = "#1e6fd9";
const NAVY = "#16324f";
const ORANGE = "#e8621a";

const header = [
  `<p style="text-align: center"><img src="${LOGO_URL}" alt="${COMPANY}" width="180" style="width: 180px; height: auto"></p>`,
  `<hr>`,
].join("");

const signOff = `<p>Best regards,<br>The ${COMPANY} Team</p>`;

const footer = [
  `<hr>`,
  `<p style="text-align: center; ${SMALL_TEXT_STYLE}">${COMPANY}<br>Boiler installation, servicing and energy efficiency solutions.<br>You are receiving this email because you are a valued contact of ${COMPANY}.</p>`,
].join("");

const button = (text: string, href: string) => buildButtonHtml({ text, href, color: BUTTON_COLOR });

const wrap = (...body: string[]) => [header, ...body, signOff, footer].join("");

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "Welcome Email",
    subject: "Welcome to BoilerTech Energy, {{first_name}}!",
    previewText: "Thanks for connecting with us - here is what you can expect.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">Welcome aboard, {{first_name}}!</h1>`,
      `<p>Thank you for connecting with ${COMPANY}. We help businesses like {{company}} keep their heating and energy systems running safely, efficiently and reliably.</p>`,
      `<h2 style="color: ${NAVY}">What you can expect from us</h2>`,
      `<ul><li><p><strong>Expert installation</strong> of high-efficiency boilers</p></li><li><p><strong>Planned maintenance</strong> that prevents costly breakdowns</p></li><li><p><strong>Energy audits</strong> to reduce fuel costs and emissions</p></li></ul>`,
      `<p>Have a question about your current system? Our engineers are always happy to help.</p>`,
      button("Explore Our Services", SITE_URL)
    ),
  },
  {
    name: "Monthly Newsletter",
    subject: "{{first_name}}, your BoilerTech Energy update",
    previewText: "Efficiency tips, service news and what is new at BoilerTech Energy.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">This month at ${COMPANY}</h1>`,
      `<p>Hi {{first_name}},</p>`,
      `<p>Here is a quick roundup of news, tips and updates for teams in {{industry}}.</p>`,
      `<h2 style="color: ${NAVY}">Efficiency tip of the month</h2>`,
      `<p>Regular burner tuning and water treatment can cut boiler fuel use by up to <strong>10%</strong>. A short annual check pays for itself quickly.</p>`,
      `<h2 style="color: ${NAVY}">Service news</h2>`,
      `<p>Our engineering teams now cover more sites near {{location}}, with faster response times for maintenance and emergency call-outs.</p>`,
      `<h2 style="color: ${NAVY}">From our blog</h2>`,
      `<p>Read our latest guides on boiler upgrades, heat recovery and lowering your energy bills on <a href="${SITE_URL}">our website</a>.</p>`,
      button("Read More", SITE_URL)
    ),
  },
  {
    name: "Promotional Offer",
    subject: "Limited offer: save on your next boiler service, {{first_name}}",
    previewText: "Book a boiler service or efficiency audit this month and save.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">A special offer for {{company}}</h1>`,
      `<p>Hi {{first_name}},</p>`,
      `<p>For a limited time, get <strong style="color: ${ORANGE}">15% off</strong> your next boiler service or energy efficiency audit with ${COMPANY}.</p>`,
      `<ul><li><p><strong>Full safety and performance inspection</strong></p></li><li><p><strong>Efficiency report</strong> with practical recommendations</p></li><li><p><strong>Priority scheduling</strong> at a time that suits you</p></li></ul>`,
      `<p>Offer valid for bookings made before the end of this month. Terms apply.</p>`,
      button("Claim Your Offer", SITE_URL)
    ),
  },
  {
    name: "Event / Webinar Invite",
    subject: "You're invited: cutting energy costs with modern boiler systems",
    previewText: "Join our free webinar with BoilerTech Energy engineers.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">Join our free webinar, {{first_name}}</h1>`,
      `<p>We would love for you and the team at {{company}} to join our upcoming live session: <strong>Cutting Energy Costs with Modern Boiler Systems</strong>.</p>`,
      `<h2 style="color: ${NAVY}">What you will learn</h2>`,
      `<ul><li><p>How to spot inefficiencies in your current heating system</p></li><li><p>When upgrading pays off, and how to fund it</p></li><li><p>Maintenance practices that extend equipment life</p></li></ul>`,
      `<p><strong>Date:</strong> [Event date]<br><strong>Time:</strong> [Event time]<br><strong>Where:</strong> Online (link sent after registration)</p>`,
      `<p>Seats are limited, so reserve your spot today.</p>`,
      button("Register Now", SITE_URL)
    ),
  },
{
    name: "Service Reminder",
    subject: "{{first_name}}, your annual boiler service is due",
    previewText: "Book your annual boiler service to keep your system safe and efficient.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">Your annual boiler service is due</h1>`,
      `<p>Hi {{first_name}},</p>`,
      `<p>Our records show that the boiler system at {{company}} is due for its annual service. Regular servicing helps keep your equipment safe, efficient and compliant.</p>`,
      `<h2 style="color: ${NAVY}">What the service includes</h2>`,
      `<ul><li><p><strong>Safety checks</strong> on burners, controls and pressure</p></li><li><p><strong>Cleaning and tuning</strong> for efficient operation</p></li><li><p><strong>A written report</strong> with any recommended actions</p></li></ul>`,
      `<p><strong>Service due:</strong> [Service due date]</p>`,
      `<p>Choose a time that suits your team and our engineers will take care of the rest.</p>`,
      button("Book Your Service", SITE_URL)
    ),
  },
  {
    name: "Seasonal Maintenance Tips",
    subject: "Seasonal energy tips for {{company}}",
    previewText: "Simple maintenance tips to prepare your system for monsoon and winter.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">Get your system season-ready</h1>`,
      `<p>Hi {{first_name}},</p>`,
      `<p>Changing seasons put extra demand on heating and energy systems. A few simple checks now can help avoid unexpected downtime later.</p>`,
      `<h2 style="color: ${NAVY}">Before the monsoon</h2>`,
      `<ul><li><p>Check flues, vents and enclosures for leaks or water entry</p></li><li><p>Inspect electrical panels and connections for moisture</p></li><li><p>Keep drainage around plant rooms clear</p></li></ul>`,
      `<h2 style="color: ${NAVY}">Before winter</h2>`,
      `<ul><li><p>Schedule a service before peak demand begins</p></li><li><p>Check insulation on pipes and storage tanks</p></li><li><p>Review controls and timers to avoid wasted energy</p></li></ul>`,
      `<p>Need a hand? Our engineers can carry out a full seasonal check for you.</p>`,
      button("Schedule a Seasonal Check", SITE_URL)
    ),
  },
  {
    name: "Festival Greeting",
    subject: "Warm [Festival name] wishes from BoilerTech Energy",
    previewText: "Season's greetings to you and your team from all of us at BoilerTech Energy.",
    htmlContent: wrap(
      `<h1 style="text-align: center; color: ${NAVY}">Season's Greetings, {{first_name}}!</h1>`,
      `<p>On the occasion of <strong>[Festival name]</strong>, all of us at ${COMPANY} wish you, your family and the team at {{company}} joy, good health and prosperity.</p>`,
      `<p>Thank you for your trust and partnership throughout the year. We look forward to continuing to support you.</p>`,
      `<p>[Optional: holiday office hours or festive message]</p>`
    ),
  },
  {
    name: "Customer Feedback Request",
    subject: "{{first_name}}, how did we do?",
    previewText: "Tell us about your recent experience with BoilerTech Energy.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">We would love your feedback</h1>`,
      `<p>Hi {{first_name}},</p>`,
      `<p>Thank you for choosing ${COMPANY}. We are always looking to improve, and your opinion about our recent work at {{company}} really matters to us.</p>`,
      `<p>It only takes a minute to rate our service and share any comments.</p>`,
      button("Rate Our Service", SITE_URL),
      `<p>If anything did not meet your expectations, simply reply to this email and our team will get in touch.</p>`
    ),
  },
  {
    name: "We Miss You",
    subject: "It's been a while, {{first_name}}",
    previewText: "Here is what is new at BoilerTech Energy since we last spoke.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">We miss you, {{first_name}}!</h1>`,
      `<p>It has been a while since we last worked with {{company}}, and we wanted to check in.</p>`,
      `<h2 style="color: ${NAVY}">What is new at ${COMPANY}</h2>`,
      `<ul><li><p>[New service or update]</p></li><li><p>[Improvement or coverage news]</p></li><li><p>[Offer details]</p></li></ul>`,
      `<p>Whether you need a routine service, an upgrade or just some advice, we are here to help.</p>`,
      button("Reconnect With Us", SITE_URL)
    ),
  },
  {
    name: "Thank You",
    subject: "Thank you for choosing BoilerTech Energy, {{first_name}}",
    previewText: "We appreciate your business - here is what happens next.",
    htmlContent: wrap(
      `<h1 style="color: ${NAVY}">Thank you, {{first_name}}!</h1>`,
      `<p>Thank you for choosing ${COMPANY}. We truly appreciate the opportunity to support {{company}}.</p>`,
      `<h2 style="color: ${NAVY}">What happens next</h2>`,
      `<ul><li><p>[Next step, e.g. service report or warranty details]</p></li><li><p>Our team is available for any follow-up questions</p></li><li><p>We will remind you when your next service is due</p></li></ul>`,
      `<p>If you have any questions, simply reply to this email.</p>`,
      button("Visit Our Website", SITE_URL)
    ),
  },
];
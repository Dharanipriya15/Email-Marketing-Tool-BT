# BoilerTech Email Marketing Platform

## Project Overview

We are building a professional email marketing platform initially for BoilerTech Energy.

This is Phase 1 of a larger product.

Phase 1 is an internal MVP for BoilerTech.

The application should be designed cleanly enough that it can later evolve into a multi-tenant SaaS platform.

Do not build unnecessary Phase 2 or Phase 3 functionality during Phase 1.

---

# Core Product Goal

The system should allow BoilerTech team members to:

1. Manage contacts
2. Import contacts using CSV
3. Create contact lists
4. Create and manage email templates
5. Create bulk email campaigns
6. Select recipients
7. Preview emails
8. Send test emails
9. Send campaigns
10. Schedule campaigns
11. Track basic email events
12. View campaign reports
13. Manage unsubscribes and suppressed contacts

The product must be easy for a non-technical user to operate.

---

# Technology Stack

Use:

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui
* PostgreSQL
* Prisma ORM
* React Hook Form
* Zod

Use modern stable versions compatible with the project.

Do not introduce unnecessary libraries.

Before installing a new dependency, determine whether the existing stack can solve the problem.

---

# UI / UX PRINCIPLES

UI quality is a major priority.

The product should look like a professional modern SaaS application.

Design goals:

* Clean
* Simple
* Premium
* Professional
* Fast
* Easy to understand
* Easy to operate
* Consistent

Avoid:

* Excessive gradients
* Excessive animations
* Too many colors
* Cluttered dashboards
* Huge unnecessary cards
* Complicated navigation
* Decorative UI that does not improve usability

Use whitespace effectively.

Use consistent typography.

Use clear visual hierarchy.

Use accessible contrast.

Use meaningful icons.

Animations should be subtle and purposeful.

---

# DESIGN SYSTEM

Use shadcn/ui components wherever appropriate.

Create reusable components rather than duplicating UI.

Examples:

* Button
* Input
* Select
* Dialog
* Dropdown
* Table
* Badge
* Card
* Tabs
* Toast
* Tooltip
* Form
* Alert
* EmptyState
* LoadingState
* ErrorState

Maintain consistent:

* Border radius
* Spacing
* Typography
* Button sizes
* Form fields
* Table styles
* Status badges

Do not create different styles for the same UI pattern.

---

# APPLICATION NAVIGATION

Main sidebar:

Dashboard
Contacts
Lists
Templates
Campaigns
Reports

Bottom:

Settings
Help

The sidebar should be:

* Clean
* Collapsible where useful
* Responsive
* Easy to understand

---

# APPLICATION ROUTES

Use a clean route structure.

Expected routes:

/dashboard

/contacts

/contacts/import

/contacts/[id]

/lists

/templates

/templates/create

/templates/[id]

/campaigns

/campaigns/create

/campaigns/[id]

/reports

/settings

---

# DASHBOARD

Dashboard should show:

* Total Contacts
* Total Campaigns
* Emails Sent
* Average Open Rate

Also show:

* Recent campaigns
* Campaign performance
* Recent activity

Do not overload the dashboard.

The most important information should be visible immediately.

---

# CONTACT MANAGEMENT

Contacts should support:

* Add contact
* Edit contact
* Delete contact
* Search
* Filter
* Pagination
* Bulk selection
* Bulk delete
* Add contacts to lists

Contact fields may include:

* First Name
* Last Name
* Email
* Company
* Phone
* Industry
* Location
* Status
* Created At

Email address must be unique within the organization.

Validate email addresses.

Detect duplicate contacts during import.

---

# CSV IMPORT

CSV import must be a guided multi-step process.

Step 1:
Upload CSV

Step 2:
Preview data

Step 3:
Map CSV columns to system fields

Step 4:
Validate records

Step 5:
Import

Show:

* Valid contacts
* Invalid emails
* Duplicate contacts
* Missing required fields

Do not silently fail.

Always explain import results to the user.

---

# EMAIL TEMPLATES

Templates should support:

* Template name
* Subject
* Email content
* HTML
* Text formatting
* Links
* Images
* CTA button
* Logo

Actions:

* Create
* Edit
* Duplicate
* Delete
* Preview
* Send test
* Use template

Support personalization variables such as:

{{first_name}}

{{last_name}}

{{company}}

{{industry}}

Do not hard-code BoilerTech-specific values into reusable template components.

---

# CAMPAIGNS

Campaign creation should be a guided flow.

Recommended steps:

1. Campaign details
2. Select recipients
3. Select template
4. Preview
5. Send test
6. Send now or schedule
7. Confirmation

Campaign fields:

* Campaign name
* Subject
* Template
* Recipient list
* Scheduled time
* Status

Statuses:

* Draft
* Scheduled
* Sending
* Completed
* Paused
* Failed

---

# BULK EMAIL ARCHITECTURE

Never send a large campaign through one synchronous request.

Use a queue/batch architecture.

Concept:

Campaign
→ Queue
→ Batch
→ Email Provider
→ Recipient

The system must support:

* Batch sending
* Retry
* Failed email handling
* Rate limiting
* Provider errors
* Delivery tracking

Design the email provider integration behind an abstraction/interface so the provider can be replaced later.

For example:

EmailProvider

Methods may include:

* sendEmail()
* sendBatch()
* getDeliveryStatus()

Do not tightly couple the application to one email provider.

---

# EMAIL TRACKING

Track basic events:

* Sent
* Delivered
* Opened
* Clicked
* Bounced
* Failed
* Unsubscribed

Campaign reports should calculate:

* Sent
* Delivered
* Open rate
* Click rate
* Bounce rate

Do not implement advanced analytics in Phase 1.

---

# UNSUBSCRIBE / SUPPRESSION

Marketing emails must support unsubscribe.

Maintain suppression information.

Do not send campaigns to unsubscribed/suppressed contacts.

Always check suppression status before sending.

---

# DATABASE DESIGN

Use PostgreSQL with Prisma.

Expected entities:

* User
* Organization
* Contact
* ContactList
* ContactListMember
* EmailTemplate
* Campaign
* CampaignRecipient
* EmailEvent
* Unsubscribe
* Suppression
* Settings

Even though Phase 1 uses one organization, include organizationId where appropriate.

Do not redesign the database unnecessarily for Phase 2.

---

# MULTI-TENANCY PREPARATION

Phase 1 is NOT a full multi-tenant SaaS.

However, the database and service architecture should not prevent future multi-tenancy.

Use:

organizationId

where appropriate.

Never assume a global contact/campaign/template belongs to one organization in backend queries.

Always scope organization-owned data correctly.

---

# SECURITY

Security is important.

Follow:

* Server-side validation
* Zod validation
* Authentication
* Authorization
* Secure API routes
* Environment variables
* No secrets in frontend
* No API keys committed to Git
* Safe CSV processing
* File type validation
* Input sanitization
* Proper error handling

Never expose provider API keys to the browser.

---

# ENVIRONMENT VARIABLES

Sensitive values must use environment variables.

Example:

DATABASE_URL=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=

Never hard-code secrets.

Never commit `.env` files containing secrets.

Maintain `.env.example`.

---

# ERROR HANDLING

Every major operation should have:

* Loading state
* Success state
* Error state
* Empty state

Errors must be understandable to normal users.

Avoid exposing internal stack traces to users.

Log technical details on the server.

---

# FORMS

Use:

React Hook Form
+
Zod

Validate forms on the client for UX.

Always validate again on the server.

Show useful field-level error messages.

---

# TABLES

Tables should support where appropriate:

* Search
* Sorting
* Filtering
* Pagination
* Row actions
* Bulk selection

Do not make tables unnecessarily complicated.

---

# RESPONSIVENESS

Desktop is the primary experience.

The UI must still work on:

* Tablet
* Mobile

Do not allow important content to overflow horizontally without a good reason.

---

# ACCESSIBILITY

Follow basic accessibility practices:

* Proper labels
* Keyboard navigation
* Focus states
* Semantic HTML
* Accessible dialogs
* Accessible buttons
* Meaningful aria labels when required

Do not rely only on color to communicate status.

---

# CODE QUALITY

Use:

* TypeScript strict mode
* Strong typing
* Reusable components
* Small focused functions
* Clear naming
* Clean folder structure
* Separation of concerns

Avoid:

* Huge components
* Duplicate code
* Magic strings
* Hard-coded values
* Unnecessary abstractions
* Dead code

---

# ARCHITECTURE

Keep responsibilities separated.

Suggested structure:

app/
components/
lib/
services/
db/
types/
schemas/
hooks/

Use server-side logic for sensitive operations.

Keep reusable business logic outside page components where appropriate.

---

# DEVELOPMENT WORKFLOW

IMPORTANT:

Do not implement the entire application in one step.

Work feature-by-feature.

Recommended order:

1. Project setup
2. Database
3. Authentication
4. Design system
5. Application layout
6. Dashboard
7. Contacts
8. CSV import
9. Lists
10. Templates
11. Campaign creation
12. Email provider
13. Queue/batch sending
14. Scheduling
15. Tracking
16. Reports
17. Unsubscribe/suppression
18. Settings
19. Security review
20. Production deployment preparation

After each major feature:

1. Run type checking
2. Run lint
3. Run tests where applicable
4. Fix errors
5. Verify the UI
6. Verify API behavior
7. Only then continue

---

# CLAUDE CODE BEHAVIOR

Before changing architecture:

Explain briefly what you are planning to change and why.

Prefer the simplest production-ready solution.

Do not over-engineer.

Do not create unnecessary files.

Do not install unnecessary dependencies.

Do not modify unrelated parts of the project.

If an existing implementation is already correct, reuse it.

Before deleting or replacing an important file, explain why.

Never silently change the database schema without explaining the migration.

---

# PHASE CONTROL

Current phase:

PHASE 1 — BOILERTECH MVP

Do NOT implement these yet unless explicitly requested:

* Multi-tenant billing
* Subscription plans
* Stripe
* Advanced AI features
* Lead scoring
* CRM integrations
* WhatsApp automation
* Complex marketing journeys
* Advanced automation builder
* White-labeling
* Public API
* Marketplace

These belong to later phases.

---

# PRODUCT PRINCIPLE

The product should feel simple.

A user should be able to:

Import contacts
→ Choose template
→ Create campaign
→ Preview
→ Send test
→ Send/Schedule
→ View report

without needing technical knowledge.

Every design and architecture decision should support this principle.

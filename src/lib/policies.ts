// Default policy texts. Each can be overridden from Admin → Website content → Policies.
// Format: blank-line-separated paragraphs, "## " headings, "- " bullet lines.
// These are sensible starting points for a small Indian education business —
// please have them reviewed before going live. They are not legal advice.

export const POLICY_SLUGS = ["privacy", "terms", "refunds", "notes", "booking"] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

export const POLICY_TITLES: Record<PolicySlug, string> = {
  privacy: "Privacy policy",
  terms: "Terms & conditions",
  refunds: "Refund & cancellation policy",
  notes: "Notes purchase policy",
  booking: "Booking policy",
};

export const DEFAULT_POLICIES: Record<PolicySlug, string> = {
  privacy: `ScoreWithScience ("we") runs this website to sell digital study notes and to offer online Chemistry tuition and doubt-solving sessions. Many of our users are school students, so we collect as little as possible and protect it carefully.

## What we collect
- Account details: student name, email address, class and board.
- Phone number — optional, only if you choose to give it, so we can reach you about a class.
- A confirmation that a parent or guardian has agreed to the account if the student is under 18.
- Order and booking records: what you bought or booked, amounts, dates and payment status.
- Messages you send us through the contact form.

## What we do not collect
- We never see or store your card, UPI or bank details. Payments are handled by Razorpay, a licensed payment gateway, under its own privacy policy.
- We do not ask for date of birth, address, school name, photos or ID documents.

## Why we use it
- To create your account and let you log in.
- To deliver the notes you buy and show your order history.
- To schedule, confirm and conduct the classes you book.
- To answer your questions and send service messages (receipts, booking confirmations, password resets).
- To meet legal, tax and accounting obligations.

We do not sell your data, and we do not use it for third-party advertising. We do not track students' behaviour for profiling.

## Children
Students under 18 should use this website with the knowledge and consent of a parent or guardian, who confirms this when the account is created. Parents may contact us at any time to review, correct or delete their child's information.

## Where data is stored
Data is stored with Supabase (database, login and file storage) and payment records with Razorpay. Your downloaded notes carry your order number so that they can be traced if shared without permission.

## How long we keep it
Account data is kept while the account is active. Order and payment records are kept as long as the law requires for accounts and tax. Contact-form messages are deleted when no longer needed.

## Your rights
You can ask us to access, correct or delete your personal data, or withdraw consent, using the contact page. We will respond within a reasonable time. Deleting an account removes access to purchased notes.

## Contact
Questions about privacy? Use the contact page and we will get back to you.`,

  terms: `By using this website you agree to these terms.

## Accounts
- You must give accurate information and keep your password safe.
- Students under 18 must have permission from a parent or guardian.
- One account is for one student.

## Prices and payment
- All prices are in Indian Rupees (₹) and are shown before you pay.
- Payments are processed securely by Razorpay. An order or booking is complete only after the payment is verified by our server.

## Digital notes
Notes are for the buyer's personal study only. You may not copy, resell, upload or share them. Each copy is marked with your order details.

## Classes
Classes are conducted online. Please join on time and behave respectfully. We may end a session in case of misconduct.

## Content
All notes, videos and website content belong to ScoreWithScience. Results depend on each student's effort — we do not guarantee specific marks.

## Changes
We may update prices, services and these terms. The version on this page applies to new purchases.`,

  refunds: `## Notes (digital products)
- Because notes are delivered instantly, purchases are generally non-refundable once the PDF is available in your account.
- If you were charged twice, a file is damaged or won't open, or you received the wrong chapter, contact us within 7 days — we will fix it or refund you.

## Tuition and doubt sessions
- Cancel at least 24 hours before the session for a full refund or a free reschedule.
- Cancellations less than 24 hours before, or missed sessions, are not refundable; a reschedule may be offered at our discretion.
- If we cancel a session, you get a full refund or a free reschedule — your choice.
- If your payment completes after the slot was taken or closed, we will contact you and refund in full or reschedule.

## How refunds are paid
Approved refunds go back to the original payment method through Razorpay. Banks usually take 5–7 working days to show the money.`,

  notes: `- Each chapter is sold separately. You can buy several chapters in one payment.
- After payment is verified, the notes appear in "My account" and can be downloaded any time — you never pay twice for the same chapter.
- Downloads are personalised with your order number. Sharing or reselling notes is not allowed and may lead to the account being closed.
- Sample pages are shown so you can check the style before buying.
- If a chapter is marked "Coming soon", it can't be bought yet.
- Problems with a file? Contact us and we'll help quickly.`,

  booking: `- Only time slots the teacher has opened can be booked. All times are Indian Standard Time (IST).
- When you choose a slot, it is held for you for a few minutes while you pay. If payment isn't completed in time, the slot is released for others.
- A booking is confirmed only after your payment is verified. You will see it under "Upcoming classes" in your account.
- Tuition is ₹100 per hour (unless shown otherwise). Doubt sessions are ₹50 for 30 minutes or ₹100 for 60 minutes.
- The class link appears in your account before the session. Please join on time; late joining does not extend the session.
- If a slot becomes unavailable while you are paying, your booking will be reviewed and you'll be offered a reschedule or a full refund.
- For cancellations and refunds, see the refund & cancellation policy.`,
};

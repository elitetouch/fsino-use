import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, Defs, DocTitle, Important, Section } from '@/components/legal/doc';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What Farm Support Innovation collects, why, who it is shared with, and the rights you have over it.',
};

/**
 * Privacy Policy.
 *
 * WRITTEN FROM THE CODEBASE, NOT FROM A TEMPLATE. Every claim below
 * corresponds to something the platform actually does — the payment
 * processors are the two that are integrated, the push services are the
 * three transports that exist, the data-rights section describes export
 * and anonymise endpoints that are built rather than promised, and the
 * disease-check section describes how those photographs are genuinely
 * handled, including that an in-house vet reviews them.
 *
 * That accuracy is the point. A boilerplate policy describing practices
 * a company does not have is worse than none: it is a published,
 * dated statement that is untrue, and under the NDPA it is the thing a
 * regulator reads first.
 *
 * NOT A SUBSTITUTE FOR LEGAL REVIEW. It is accurate as a description of
 * the system; whether it is sufficient as a notice under the Nigeria
 * Data Protection Act 2023 is a question for a qualified practitioner,
 * and the retention periods in particular are engineering defaults
 * rather than a considered retention policy.
 */
export default function PrivacyPage() {
  return (
    <article>
      <DocTitle
        title="Privacy Policy"
        updated="2026-09-23"
        summary="We collect what we need to run your farm records and nothing we cannot explain. We do not sell your data, and we do not share your farm's figures with other farmers, buyers or lenders unless you put them in a report yourself."
      />

      <Section n={1} title="Who we are">
        <p>
          Farm Support Innovation (&ldquo;FS Innovation&rdquo;, &ldquo;we&rdquo;) is a company
          registered in Nigeria. We operate the Farm Support web app, the Android app, and the
          PENKEEP pen sensors.
        </p>
        <p>
          For the purposes of the Nigeria Data Protection Act 2023, we are the data controller for
          the personal data described here. You can reach us at{' '}
          <a
            href="mailto:privacy@fsinnovation.net"
            className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2"
          >
            privacy@fsinnovation.net
          </a>
          .
        </p>
      </Section>

      <Section n={2} title="What we collect">
        <Defs
          rows={[
            [
              'Your account',
              'Name, email address, phone number, and a profile photo if you add one. Your password is stored only as a cryptographic hash — we cannot read it, and neither can our staff.',
            ],
            [
              'Your farm records',
              'Farms, pens, flocks, daily records (mortality, feed, water, weight, eggs), vaccinations, treatments, expenses and sales. This is the substance of the service.',
            ],
            [
              'Payments',
              'What you bought, when, and how much. Card and bank details are entered on the payment provider’s own page and never reach our servers — we receive only a reference and a result.',
            ],
            [
              'Devices',
              'If you install PENKEEP sensors: temperature, humidity, ammonia and related readings from your pens, with the device identifier.',
            ],
            [
              'Notifications',
              'A push token for each phone or browser you allow notifications on, so we can send alerts to that device.',
            ],
            [
              'Disease check photos',
              'Photographs of droppings you submit, with the result. See clause 5 — these are handled differently from everything else here.',
            ],
            [
              'Support messages',
              'What you write to us, so we can answer and so the next person handling it can see what was already said.',
            ],
            [
              'Technical logs',
              'IP address, device type and error traces, kept to diagnose faults and to detect abuse.',
            ],
          ]}
        />
        <p>
          We do not collect your location, your contacts, or anything from your phone beyond the
          photographs you deliberately submit.
        </p>
      </Section>

      <Section n={3} title="Why we use it">
        <Bullets
          items={[
            'To run the service: keep your records, calculate your figures, produce your reports.',
            'To warn you about things on your farm — a mortality spike, an overdue vaccination, a cycle about to end.',
            'To take payment and to tell you when a subscription is expiring.',
            'To answer your questions when you contact support.',
            'To keep the platform working and secure — fixing faults, blocking abuse.',
            'To improve the disease checker, which is explained separately in clause 5.',
          ]}
        />
        <p>
          We do not use your farm data to train general-purpose AI models, and we do not build
          advertising profiles.
        </p>
      </Section>

      <Section n={4} title="Who else sees it">
        <p>
          We do not sell personal data, and we never have. We share it only with the companies that
          make the service work:
        </p>
        <Defs
          rows={[
            ['Paystack, Flutterwave', 'To take payments. They receive your name, email and the amount.'],
            ['Our email provider', 'To deliver the emails you receive from us.'],
            [
              'Google (FCM), Expo, and your browser vendor',
              'To deliver push notifications to your device. They receive the message and the device token, not your farm records.',
            ],
            ['Our hosting provider', 'Runs the servers your data sits on.'],
          ]}
        />
        <p>
          We will also disclose data where the law requires it, and we will tell you when we are
          permitted to.
        </p>
        <p>
          <strong>Other people on your farm.</strong> If you invite someone to your farm, they see
          the farm&rsquo;s records according to the permissions you give them. That is the point of
          inviting them, and you can remove their access at any time from{' '}
          <span className="font-medium">Users</span>.
        </p>
      </Section>

      <Section n={5} title="Disease check photographs">
        <p>
          The disease checker is different enough from the rest of the service to deserve its own
          clause.
        </p>
        <Bullets
          items={[
            <>
              <strong>We keep the photographs.</strong> They are stored privately and are not
              reachable by anyone without authorisation.
            </>,
            <>
              <strong>Our in-house veterinarian may review them.</strong> Confirming what a photo
              actually shows is how the tool is corrected, and if you ask for a consultation a vet
              will read your cycle&rsquo;s records — bird age, mortality, vaccinations, medication
              — alongside the photo.
            </>,
            <>
              <strong>We use them to improve the model.</strong> The tool is in beta and is
              measurably unreliable on real farm photographs. Real photographs with confirmed
              labels are the only thing that fixes that.
            </>,
            <>
              <strong>They are not published, sold, or shared with other farmers</strong>, and they
              are not used to identify you or your farm to anyone outside FS Innovation.
            </>,
          ]}
        />
        <p>
          If you would rather your photographs were not kept for improving the model, write to{' '}
          <a
            href="mailto:privacy@fsinnovation.net"
            className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2"
          >
            privacy@fsinnovation.net
          </a>{' '}
          and we will remove them. The results stay in your own history.
        </p>
      </Section>

      <Section n={6} title="How long we keep it">
        <Bullets
          items={[
            'Farm records: for as long as your account is open, because a cycle report covers months and a farm history covers years.',
            'Payment references: seven years, which is the period Nigerian tax law expects records to be retained.',
            'Disease check photographs: kept while the model is being improved, and removed on request.',
            'Technical logs: a short rolling window, long enough to investigate a fault.',
          ]}
        />
        <p>
          When you close your account we delete or anonymise your personal data, keeping only what
          we are legally required to keep.
        </p>
      </Section>

      <Section n={7} title="Your rights">
        <p>Under the Nigeria Data Protection Act 2023 you can:</p>
        <Bullets
          items={[
            'Ask for a copy of the personal data we hold about you.',
            'Ask us to correct anything that is wrong — most of it you can edit yourself in Profile and Settings.',
            'Ask us to delete your account and your data.',
            'Object to a particular use, including the use of your photographs described in clause 5.',
            'Complain to the Nigeria Data Protection Commission if you think we have got this wrong.',
          ]}
        />
        <p>
          Write to{' '}
          <a
            href="mailto:privacy@fsinnovation.net"
            className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2"
          >
            privacy@fsinnovation.net
          </a>
          . We answer within 30 days. There is no charge.
        </p>
      </Section>

      <Section n={8} title="Keeping it safe">
        <Bullets
          items={[
            'Everything travels over an encrypted connection.',
            'Passwords are hashed, never stored in a form anyone can read.',
            'Farm data is scoped per farm — a request for another farm’s records is refused by the server, not merely hidden by the app.',
            'Staff access is limited by role and is logged.',
          ]}
        />
        <Important>
          <p>
            <strong>No system is perfectly secure.</strong> If a breach affects your personal data
            we will tell you and the Nigeria Data Protection Commission, as the law requires, rather
            than waiting to be found out.
          </p>
        </Important>
      </Section>

      <Section n={9} title="Changes to this policy">
        <p>
          If we change how we handle your data we will update this page and change the date at the
          top. Where a change matters to you, we will tell you in the app or by email rather than
          relying on you to re-read it.
        </p>
        <p className="text-[var(--color-brand-muted)]">
          See also our{' '}
          <Link
            href="/legal/terms"
            className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2"
          >
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </article>
  );
}

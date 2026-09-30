import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, Defs, DocTitle, Important, Section } from '@/components/legal/doc';

export const metadata: Metadata = {
  title: 'Delete your account',
  description:
    'How to ask Farm Support Innovation to delete your FSI Farm Manager account, or only your disease-check photographs — what gets deleted, and what we are required to keep.',
};

/**
 * Account deletion request page.
 *
 * REQUIRED BY GOOGLE PLAY, not optional. Play's Data deletion policy
 * says an app that lets people create an account must give them a way
 * to ask for it to be deleted, and must publish a URL — reachable
 * without installing the app — that names the app, sets out the steps,
 * and states what is deleted, what is kept, and for how long.
 *
 * That URL goes in Play Console under Data safety. This page is it.
 *
 * WRITTEN TO MATCH THE PRIVACY POLICY, deliberately. The retention
 * periods here are the same ones in clause 6 there, because two
 * published pages giving different answers about how long you keep
 * somebody's data is worse than either page alone.
 *
 * TODO — the app has no in-app deletion route. Play expects people to
 * be able to start this from inside the app as well as from here, and
 * the bundle currently has no such screen. Until it does, the email
 * route below is the only one, and it must actually be monitored.
 *
 * WHY A GMAIL ADDRESS AND NOT privacy@fsinnovation.net — the domain has
 * no MX record, and the A-record fallback host refuses port 25, so
 * anything sent to privacy@ or support@ there bounces. A published
 * contact that bounces is worse than an unglamorous one that works:
 * under the NDPA a data subject must be able to reach the controller,
 * and Play may test the instructions on this page.
 *
 * Once MX is configured, move back to role addresses — privacy@ for
 * data requests, support@ for everything else — so the contact survives
 * whoever currently holds the inbox. Change it in every file at once;
 * before this commit three different addresses were published across
 * six files and none of them could receive mail.
 */
export default function DeleteAccountPage() {
  return (
    <article>
      <DocTitle
        title="Delete your account"
        updated="2026-09-30"
        summary="You can ask us to delete your FSI Farm Manager account at any time — or, if you would rather keep the account, just your disease-check photographs. Either way it is free: write from the email address on the account and we will confirm within 7 days and finish within 30. Deleting the account takes your farm records with it, so export anything you still need first."
      />

      <Section n={1} title="Which app this is about">
        <p>
          This page covers <strong>FSI Farm Manager</strong>, the Android app published by{' '}
          <strong>Farm Support Innovation</strong> (formerly Farmspeak Technology), and the
          account you use to sign into it. The same account works on our web app, so deleting it
          removes access to both.
        </p>
      </Section>

      {/* Heading names both routes on purpose: this one page is the URL
          in Play Console for account deletion AND for data deletion, so
          a reviewer arriving for either must find their answer without
          reading the whole page. */}
      <Section n={2} title="How to ask us to delete your account, or just your photographs">
        <Bullets
          items={[
            <>
              <strong>Email{' '}
              <a
                href="mailto:fsinnovationafrica@gmail.com"
                className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2"
              >
                fsinnovationafrica@gmail.com
              </a>{' '}
              from the address your account uses</strong>, with the subject{' '}
              <span className="font-medium">Delete my account</span>. Sending from that address is
              how we know it is you — we will not act on a request to delete someone else&rsquo;s
              farm.
            </>,
            <>
              Tell us whether you want <strong>the whole account</strong> deleted, or only your{' '}
              <strong>disease-check photographs</strong> removed from the set we use to improve
              the tool. Those are separate requests and you can make either one.
            </>,
            <>
              We reply within <strong>7 days</strong> to confirm we have it, and complete the
              deletion within <strong>30 days</strong>.
            </>,
          ]}
        />
        <p>There is no charge, and you do not have to give a reason.</p>
      </Section>

      <Section n={3} title="Export anything you want to keep first">
        <Important>
          <p>
            <strong>Deletion cannot be undone.</strong> Your cycle history, daily records,
            vaccinations, treatments, expenses and sales go with the account.
          </p>
          <p>
            Before you write to us, open <span className="font-medium">Reports</span> and export
            the cycles that matter as PDF or CSV. A finished cycle report is often the document a
            bank or cooperative asks for months later, and we cannot get it back for you
            afterwards.
          </p>
        </Important>
      </Section>

      <Section n={4} title="What we delete">
        <Defs
          rows={[
            ['Your account', 'Name, email address, phone number, password hash and profile photo.'],
            [
              'Your farm records',
              'Farms, pens, flocks, cycles, daily records, vaccinations, treatments, expenses and sales.',
            ],
            [
              'Disease check photographs',
              'The images you submitted and the results attached to them.',
            ],
            ['Device tokens', 'The push notification tokens for your phones and browsers.'],
            ['Support messages', 'What you wrote to us, once any open request is closed.'],
          ]}
        />
      </Section>

      <Section n={5} title="What we keep, and for how long">
        <p>
          A small amount of data outlives the account, because the law requires it or because it
          no longer identifies you.
        </p>
        <Defs
          rows={[
            [
              'Payment references',
              'Seven years. Nigerian tax law expects records of a transaction to be retained, and we cannot delete them on request. These are references and amounts — your card and bank details never reached our servers in the first place.',
            ],
            [
              'Technical logs',
              'A short rolling window, long enough to investigate a fault. They age out on their own.',
            ],
            [
              'Anonymised figures',
              'Aggregate numbers that can no longer be traced to you or your farm — for example how many cycles a region ran — may be kept. Nothing in them identifies you.',
            ],
          ]}
        />
      </Section>

      <Section n={6} title="If other people work on your farm">
        <p>
          Deleting your own account removes <strong>you</strong>. If you are the owner of a farm
          that other people were invited to, tell us in the same email whether you want the farm
          and its records deleted as well, or handed to another member.
        </p>
        <p>
          If you do not say, we will ask before touching a farm that someone else is still
          recording against — deleting one person&rsquo;s login should not quietly destroy a
          manager&rsquo;s or an attendant&rsquo;s work.
        </p>
      </Section>

      <Section n={7} title="Your other rights">
        <p>
          Deletion is one of several rights you have under the Nigeria Data Protection Act 2023.
          You can also ask for a copy of your data, correct what is wrong, or object to a
          particular use. Those are set out in{' '}
          <Link
            href="/legal/privacy"
            className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2"
          >
            our Privacy Policy
          </Link>
          , along with how to complain to the Nigeria Data Protection Commission if you think we
          have handled this badly.
        </p>
      </Section>
    </article>
  );
}

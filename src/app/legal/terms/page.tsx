import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, DocTitle, Important, Section } from '@/components/legal/doc';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The agreement between you and Farm Support Innovation — subscriptions, your data, the disease checker, and the limits of what we promise.',
};

/**
 * Terms of Service.
 *
 * WRITTEN FROM THE SYSTEM'S ACTUAL BEHAVIOUR. The subscription clause
 * describes the real write-window: a cycle stops accepting new records
 * when its period ends, there is a three-day grace, and everything
 * already recorded stays readable. The disease-check clause describes a
 * tool that genuinely refuses valid photographs and has genuinely
 * produced confident wrong answers.
 *
 * That last one is the reason this document is not boilerplate. A farmer
 * can medicate a flock on a wrong diagnosis, and a terms page that
 * quietly disclaims "AI features" in a liability paragraph has not
 * warned anybody. It says so plainly, in the clause, in bold.
 *
 * DRAFTED TO PROTECT THE COMPANY, AND THAT SHAPES THE STYLE.
 * Maximum protection is not maximum aggression. An unreasonably broad
 * exclusion is routinely read down or struck out, and a clause that is
 * struck out protects nobody — so the risk allocation here is specific
 * and proportionate rather than sweeping. The conspicuous disease-check
 * warning in clause 5 is itself a protection: a risk disclosed in bold,
 * before the user acts, is one a court can see was disclosed. Buried in
 * a liability paragraph it would protect far less.
 *
 * NOT A SUBSTITUTE FOR LEGAL REVIEW. Clauses 9 to 11 allocate risk, and
 * whether each is enforceable is a question of Nigerian law — including
 * the Federal Competition and Consumer Protection Act, which limits how
 * far a supplier may exclude liability to a consumer. A Nigerian
 * practitioner should review these before launch; that review is part
 * of the protection, not a formality delaying it.
 */
export default function TermsPage() {
  return (
    <article>
      <DocTitle
        title="Terms of Service"
        updated="2026-09-23"
        summary="Your farm records are yours. Pay for the cycles you track, and we keep them, show you what they mean, and never hand them to anyone else. The disease checker is an early tool and is sometimes wrong — never treat a flock on its word alone."
      />

      <Section n={1} title="The agreement">
        <p>
          These terms are between you and Farm Support Innovation, a company registered in Nigeria.
          By creating an account you accept them.
        </p>
        <p>
          If you are accepting on behalf of a business, you confirm you are allowed to commit that
          business to them.
        </p>
      </Section>

      <Section n={2} title="Your account">
        <Bullets
          items={[
            'You must be 18 or older.',
            'Give us details that are true, and keep your email current — it is how we send billing notices and password resets.',
            'Your password is yours to protect. Anything done with your account is treated as done by you.',
            'Tell us at once if you think someone else has your password. Resetting it ends every other signed-in session.',
          ]}
        />
        <p>
          You may invite other people to your farm and choose what each of them can see and do. You
          remain responsible for what they do with that access.
        </p>
      </Section>

      <Section n={3} title="Subscriptions and cycles">
        <p>
          Tracking is bought per cycle. When you place a flock you pay for a period covering that
          cycle, and what happens at the end of it is worth stating plainly, because it is the part
          people are most often surprised by:
        </p>
        <Bullets
          items={[
            <>
              <strong>Before the period ends</strong> we warn you — in the app and by email — so it
              does not arrive without notice.
            </>,
            <>
              <strong>For three days after it ends</strong> you can still add records. This grace is
              deliberate, so a cycle does not stop mid-week over a payment you meant to make.
            </>,
            <>
              <strong>After that the cycle stops accepting new records.</strong> Renew and it
              resumes.
            </>,
            <>
              <strong>Everything you already recorded stays readable, always.</strong> Your history,
              your figures and your reports do not disappear because a period lapsed. We do not hold
              your records hostage.
            </>,
          ]}
        />
        <p>
          Prices can change. We will tell you before a change affects what you pay. Payments already
          made for a running cycle are not affected.
        </p>
      </Section>

      <Section n={4} title="Your data is yours">
        <p>
          You own your farm records. We store and process them to provide the service, and for no
          other purpose.
        </p>
        <Bullets
          items={[
            'We do not sell your data.',
            'We do not show your farm’s figures to other farmers, buyers or lenders. If a report reaches them, it is because you sent it.',
            'You can export your data, and you can ask us to delete it.',
          ]}
        />
        <p>
          How we handle personal data is set out in the{' '}
          <Link
            href="/legal/privacy"
            className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section n={5} title="The disease checker">
        <Important>
          <p>
            <strong>
              This tool is in beta and it is sometimes wrong. Do not treat a flock on its result
              alone.
            </strong>
          </p>
          <p>
            It refuses photographs of perfectly good droppings, and it has produced confident
            answers that were incorrect. Treat every result as a second opinion, never as a
            diagnosis, and confirm with a veterinarian before medicating birds.
          </p>
        </Important>
        <p>
          Treatment and dosage information shown with a result is general guidance, not a
          prescription. Dosages depend on the age and weight of your birds and on what they have
          already been given — a vet needs to confirm them.
        </p>
        <p>
          Newcastle disease and other notifiable conditions must be reported to your local
          veterinary authority. The app telling you something does not discharge that duty.
        </p>
      </Section>

      <Section n={6} title="Vet consultations">
        <p>
          When you ask for a vet to review a check, a veterinarian working with us reads your photo
          alongside that cycle&rsquo;s records and replies in the app.
        </p>
        <Bullets
          items={[
            'This is an opinion formed from a photograph and your records — not an examination of your birds, and not a substitute for one.',
            'We do not promise a reply within a fixed time. It depends on the vet being available.',
            'In an emergency, or where birds are dying quickly, contact a veterinarian in person. Do not wait for a reply here.',
          ]}
        />
      </Section>

      <Section n={7} title="Using the service properly">
        <p>Do not:</p>
        <Bullets
          items={[
            'Try to reach another farm’s data, or to get around the permission system.',
            'Upload anything unlawful, or anything that is not yours to upload.',
            'Automate the service in a way that degrades it for other farms.',
            'Resell access to the service without our agreement.',
          ]}
        />
        <p>
          We may suspend an account that does these things. Where we can, we will tell you why
          first.
        </p>
      </Section>

      <Section n={8} title="You decide what happens to your birds">
        <Important>
          <p>
            <strong>
              FS Innovation is a record-keeping and information service. It is not a veterinary
              practice, and nothing in it is a veterinary diagnosis, prescription or clinical
              instruction.
            </strong>
          </p>
        </Important>
        <p>
          Every decision about medicating, culling, isolating or selling your birds is yours. You
          make it as the person who can see the flock, and you are responsible for it. Where the
          health of your birds is at stake, take advice from a veterinarian who can examine them.
        </p>
        <p>
          Poultry farming carries risks that no software removes — disease, feed quality, weather,
          power, water, market prices and theft among them. By using the service you accept that
          those risks remain yours, and that the figures, alerts, projections and disease-check
          results we show are inputs to your judgement rather than a replacement for it.
        </p>
      </Section>

      <Section n={9} title="What we do not promise">
        <p>
          We work hard to keep the service running and its figures correct. Even so, and to the
          fullest extent the law allows, the service is provided <strong>as it is</strong> and{' '}
          <strong>as available</strong>, without warranties of any kind, whether express or
          implied.
        </p>
        <p>In particular we do not warrant that:</p>
        <Bullets
          items={[
            'The service will be uninterrupted, timely, or free of faults.',
            'A network connection will be available when you need one.',
            'Every calculation, projection, benchmark or alert is accurate or complete.',
            'The disease checker will identify a disease correctly, or at all.',
            'Sensor readings are accurate, or that a device is working.',
            'The service will meet any particular expectation you have of it.',
          ]}
        />
        <p>
          Some of what the service does depends on companies we do not control — payment
          processors, email and notification providers, network operators and hosting. Where one of
          those fails, we will do what we reasonably can, but we are not responsible for their
          failures.
        </p>
      </Section>

      <Section n={10} title="Limits on our liability">
        <p>
          Nothing in this clause limits liability that cannot lawfully be limited — including for
          death or personal injury caused by our negligence, for fraud or fraudulent
          misrepresentation, or any other liability Nigerian law does not permit us to exclude.
        </p>
        <p>Subject to that, and to the fullest extent the law allows:</p>
        <Bullets
          items={[
            <>
              We are <strong>not liable for indirect or consequential loss</strong> — including
              lost profit, lost revenue, lost contracts, lost opportunity, or business interruption.
            </>,
            <>
              We are <strong>not liable for the loss of birds</strong>, or for the cost of treating
              them, where the decision to treat, not treat, cull or sell was yours.
            </>,
            <>
              We are <strong>not liable for loss of data</strong> you did not export, for records
              held on a device that was lost, damaged or reset, or for changes saved offline that a
              device failed to send.
            </>,
            <>
              Our <strong>total liability</strong> for all claims arising in any twelve-month period
              is limited to the amount you actually paid us in that period.
            </>,
          ]}
        />
        <p>
          A claim must be brought within twelve months of the event giving rise to it. After that
          it is out of time.
        </p>
        <p>
          These limits apply however a claim is framed — in contract, in negligence, or otherwise —
          and they reflect the price of the service. We could not offer it at this price bearing
          the risks of every farming decision made with it.
        </p>
      </Section>

      <Section n={11} title="Your responsibility to us">
        <p>
          You agree to cover us for any claim, loss, penalty or reasonable legal cost we incur
          because of:
        </p>
        <Bullets
          items={[
            'Something you uploaded that was not yours to upload, or that was unlawful.',
            'Your use of the service in breach of these terms.',
            'A decision you made about your birds, your farm or your business.',
            'A report you sent to a buyer, a lender or anyone else.',
            'Access you gave to another person on your farm, and what they did with it.',
          ]}
        />
        <p>
          We will tell you promptly about any such claim and will not settle it without talking to
          you first.
        </p>
      </Section>



      <Section n={12} title="PENKEEP devices">
        <p>
          Sensors are sold separately and carry their own warranty. Readings are provided as
          measured; a faulty or badly placed sensor reports faulty numbers, and alerts built on
          those numbers will be wrong.
        </p>
        <p>Check the birds, not only the dashboard.</p>
      </Section>

      <Section n={13} title="Ending the agreement">
        <p>
          You can close your account at any time from Settings, or by writing to us. We may end
          this agreement if you breach these terms.
        </p>
        <p>
          Before you go, export what you want to keep. We will help if you ask — write to{' '}
          <a
            href="mailto:support@fsinnovation.net"
            className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2"
          >
            support@fsinnovation.net
          </a>
          .
        </p>
      </Section>

      <Section n={14} title="Things outside our control">
        <p>
          We are not in breach of these terms, and not liable, where we are prevented from
          providing the service by something beyond our reasonable control — including power
          failure, network or internet outage, the failure of a supplier or hosting provider, fire,
          flood, epidemic or animal disease control measures, civil unrest, industrial action, or
          government action.
        </p>
      </Section>

      <Section n={15} title="The rest of the agreement">
        <Bullets
          items={[
            <>
              <strong>If one clause fails</strong>, the rest stand. A clause a court finds too
              broad is to be read as narrowly as needed to make it valid, rather than removed
              entirely.
            </>,
            <>
              <strong>If we do not enforce something immediately</strong>, we have not given up the
              right to enforce it later.
            </>,
            <>
              <strong>These terms and the Privacy Policy are the whole agreement</strong> between
              us about the service, and replace anything said before.
            </>,
            <>
              <strong>You may not transfer this agreement</strong> to anyone else without our
              written consent. We may transfer it as part of a sale or reorganisation of our
              business, and your rights are unaffected if we do.
            </>,
            <>
              <strong>Nobody else can enforce these terms.</strong> They are between you and us.
            </>,
          ]}
        />
      </Section>

      <Section n={16} title="Changes, notices and governing law">
        <p>
          We may update these terms. The date at the top changes when we do, and we will tell you in
          the app or by email when a change matters. Continuing to use the service after that means
          you accept the new terms.
        </p>
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria, and the Nigerian
          courts have jurisdiction over any dispute.
        </p>
      </Section>
    </article>
  );
}

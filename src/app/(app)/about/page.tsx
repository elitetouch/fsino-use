import { Bird, Cpu, LineChart, ShieldCheck, Sparkles, Thermometer } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';

/**
 * About page — public-facing marketing copy that lives inside the
 * authenticated app because farmers, investors and grant funders all
 * end up on this URL when they want to understand what FS Innovation
 * actually does. Reads as a mini pitch deck rather than a version
 * changelog, because that's what the audience actually asks for.
 */
export default function AboutPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="About Farm Support Innovation"
        title="An operating system for African smallholder poultry"
        description="Real-time pen climate, breed-standard benchmarks, and bank-grade reporting for the farmers who feed a continent."
      />

      <section className="rounded-2xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-accent)] to-white p-6 sm:p-8">
        <p className="text-[15px] leading-relaxed text-[var(--color-brand-fg)]">
          Over 60% of Africa&apos;s protein comes from smallholder
          poultry farmers running flocks of five hundred to twenty thousand
          birds. They compete with commercial operations that use continuous
          climate monitoring, breed-standard benchmarking, structured
          record-keeping and bank-grade reporting. Tools priced for
          multi-million-dollar operations, not the family compound in Nigeria.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-brand-fg)]">
          <strong>We build those tools for the ninety-nine percent.</strong>
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <FeatureCard
          icon={Cpu}
          title="PENKEEP - the pen climate station"
          body="Our IoT device sits in the pen and reports temperature, humidity, ammonia and CO₂ every few seconds. It controls heaters and fans autonomously, warns before conditions turn deadly, and works over the local network so it doesn't need reliable internet to keep the birds safe."
        />
        <FeatureCard
          icon={LineChart}
          title="FS Manager - the record-keeping brain"
          body="This app, turns years of paper record-keeping into structured data that computes feed conversion, mortality trends, vaccination compliance and profit-per-cycle. Reports export as bank-ready PDFs. Alerts fire when the data drifts from Aviagen, Cobb or Hy-Line standards."
        />
        <FeatureCard
          icon={Thermometer}
          title="The same targets the big farms use"
          body="We build in the exact growth and feed targets that the world's big breeders publish for Ross 308, Cobb 500, Hy-Line Brown, Lohmann and ISA birds. Every number on the dashboard is compared to the target for the exact age of your birds, so 'good' means good compared to what a top farm would expect, not a guess."
        />
        <FeatureCard
          icon={ShieldCheck}
          title="Bank-grade reporting"
          body="Cycle reports include feed used, mortality reconciled to bird counts, climate compliance, vaccine adherence, cost, revenue and margin. That is the exact shape a bank or co-op loan officer needs. Farmers walk into loan meetings with a PDF instead of a notebook."
        />
      </div>

      <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              What we&apos;re building next
            </h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
              <li>
                <strong className="text-[var(--color-brand-fg)]">Compare with other farms.</strong>{' '}
                See how this cycle&apos;s feed use and bird weight is doing against your own past cycles and against other farms raising the same breed in the same weather.
              </li>
              <li>
                <strong className="text-[var(--color-brand-fg)]">Cost and profit projection.</strong>{' '}
                Show the total spend so far and what the final profit is likely to be, so a farmer knows on day 15 whether this batch will make money.
              </li>
              <li>
                <strong className="text-[var(--color-brand-fg)]">Best day to sell.</strong>{' '}
                Look at how fast the birds are growing and tell the farmer the best day to send them to market, days before they would guess by eye.
              </li>
              <li>
                <strong className="text-[var(--color-brand-fg)]">A system that learns.</strong>{' '}
                Every alert now asks the farmer if it was &quot;helpful&quot; or a &quot;false alarm&quot;. Once enough farmers have answered, the system learns to catch real problems earlier and stop sending alerts that turn out to be nothing.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Farms served" value="5000+" hint="Across Nigeria, Ghana and Cameroon" />
        <StatCard label="Pens monitored" value="2,800+" hint="Live climate telemetry, 24/7" />
        <StatCard label="Records logged" value="220k+" hint="Feed, mortality, vaccine, sales" />
      </section>

      <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-6 sm:p-8">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
          Building for a continent
        </p>
        <h2 className="mt-2 text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          A hardware and software advantage aimed at a continent-scale market
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-brand-fg-soft)]">
          Africa raises over 2.4 billion birds a year, most of them by
          farmers with fewer than 20,000 head. Nothing built for that scale
          exists at that price. We build both the sensor that sees inside
          the pen and the app that turns the reading into a decision.
          A competitor would have to build both to catch up.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-brand-fg-soft)]">
          Every cycle you log teaches the system a little more. Every alert
          you mark helpful or false alarm makes it smarter. The longer a
          farm uses us, the more accurate the advice becomes for that
          farm&apos;s breed, climate and way of working. That advantage grows
          every year, and it would take a new competitor years to catch up.
        </p>
        <p className="mt-4 text-[13px] italic text-[var(--color-brand-muted)]">
          Talk to us:{' '}
          <a
            href="mailto:hello@fsinnovation.net"
            className="font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
          >
            hello@fsinnovation.net
          </a>
        </p>
      </section>

      <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <Bird className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-brand-primary-deep)]" />
          <div>
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">
              FS Innovation is registered in Nigeria
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
              Built in Ogun and Lagos. Serving farmers from the Sahel to the
              Guinea coast.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 text-center">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-bold tracking-tight text-[var(--color-brand-fg)]">
        {value}
      </p>
      <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">
        {hint}
      </p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div>
          <h3 className="text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {title}
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

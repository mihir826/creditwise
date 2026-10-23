import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, Eyebrow } from "@/components/ui/card";

export const metadata: Metadata = { title: "Methodology" };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-28 p-6 sm:p-8">
      <h2 className="font-serif text-3xl text-fg">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted [&_strong]:font-medium [&_strong]:text-fg">{children}</div>
    </Card>
  );
}

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow>About CreditWise</Eyebrow>
      <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-tight text-fg sm:text-6xl">
        How the numbers <span className="text-mint">are made.</span>
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        CreditWise is a loan-analysis tool. It does not connect to banks, hold money, or make lending decisions. Every
        figure is calculated from inputs you provide.
      </p>

      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2 text-[13px]">
        {[
          ["emi", "EMI formula"],
          ["schedule", "Schedule & rounding"],
          ["costs", "Cost definitions"],
          ["compare", "Comparison"],
          ["ml", "Approval model"],
          ["storage", "Storage & privacy"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-border px-3.5 py-1.5 text-muted hover:border-border-strong hover:text-fg">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-5">
        <Section id="emi" title="EMI formula">
          <p>For a fixed-rate loan repaid in equal monthly instalments:</p>
          <p className="rounded-2xl border border-border bg-bg px-5 py-4 text-center font-serif text-2xl text-fg">
            EMI = P × r × (1 + r)<sup>n</sup> ÷ ((1 + r)<sup>n</sup> − 1)
          </p>
          <p>
            <strong>P</strong> is the principal, <strong>r</strong> the monthly rate (annual rate ÷ 12 ÷ 100), and{" "}
            <strong>n</strong> the number of monthly payments. When the rate is 0%, EMI = P ÷ n.
          </p>
          <p>
            Calculations run in the Python backend using exact decimal arithmetic, not binary floating point, so totals
            add up to the paisa.
          </p>
        </Section>

        <Section id="schedule" title="Schedule & rounding">
          <p>
            Each month, interest = outstanding balance × r, rounded to the nearest paisa. The rest of the EMI repays
            principal. The EMI itself is rounded to the nearest paisa once.
          </p>
          <p>
            Because of that rounding, the <strong>final instalment</strong> may differ from the EMI by a few rupees: it
            repays exactly what is left, so the closing balance is always ₹0.00. Total interest and total repayment are
            exact sums of the schedule rows.
          </p>
        </Section>

        <Section id="costs" title="Cost definitions">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Total repayment</strong> = principal + total interest (the sum of all instalments).
            </li>
            <li>
              <strong>Processing fee</strong> is treated as paid upfront. It is not part of the EMI.
            </li>
            <li>
              <strong>Total borrowing cost</strong> = total interest + processing fee.
            </li>
            <li>
              <strong>Effective monthly cost</strong> = (all instalments + fee) ÷ number of months.
            </li>
            <li>
              <strong>Effective annual rate</strong>: the nominal annual rate at which the instalments are worth exactly
              the amount you actually receive (principal − fee). With no fee, it equals the quoted rate.
            </li>
          </ul>
          <p>Not modelled: GST on fees, insurance, prepayments, floating-rate resets, late fees or broken-period interest.</p>
        </Section>

        <Section id="compare" title="Comparison">
          <p>
            Scenarios are ranked by <strong>total borrowing cost</strong> using only the values you enter. If the loan
            amounts differ, the tool warns that the comparison isn&apos;t like-for-like. Actual lender terms may differ.
          </p>
        </Section>

        <Section id="ml" title="Approval model">
          <p>
            The prediction page uses the project&apos;s original dataset (<code className="text-fg">loan_approval_data.csv</code>)
            and the algorithms from <code className="text-fg">credit_wise.ipynb</code>, retrained without data leakage:
            the split happens first, all preprocessing is fitted on training rows only, and the test set is used once.
          </p>
          <p>
            The dataset&apos;s target is whether a loan was <strong>approved</strong>. It has no repayment or default outcome, so
            the model says nothing about default risk. Its output is a statistical estimate, not a bank decision.
          </p>
          <p>
            Explanations are exact for this model (logistic regression): each feature&apos;s contribution to the log-odds is
            its coefficient × its standardised distance from the average training applicant.
          </p>
        </Section>

        <Section id="storage" title="Storage & privacy">
          <p>
            Saved calculations are stored in a <strong>SQLite database file on the machine running the CreditWise
            backend</strong> (by default <code className="text-fg">backend/data/creditwise.db</code>).
          </p>
          <p>
            This release is <strong>single-user with no authentication</strong>. Anyone who can reach the backend can
            read, rename or delete every saved calculation. Don&apos;t deploy it publicly with real personal data without
            adding authentication.
          </p>
          <p>Nothing is sent to third parties. PDF and CSV files are generated by the backend and downloaded directly.</p>
        </Section>
      </div>
    </div>
  );
}

"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/pricing-1-utils/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FancyButton } from "@/components/ui/fancy-button";
import { CheckIcon, MinusIcon, PlusIcon } from "lucide-react";

type FaqItem = {
  value: string;
  question: string;
  answer: string;
};

type PricingPlan = {
  label: string;
  description: string;
  price: number;
  period: string;
  features: string[];
};

const plan: PricingPlan = {
  label: "Business plan",
  description:
    "Complete toolkit for growing businesses managing payments, invoicing, and financial operations.",
  price: 149,
  period: "One-time payment",
  features: [
    "Unlimited team members",
    "Advanced payment processing",
    "Automated invoice generation",
    "Real-time financial analytics",
    "Custom workflow automation",
    "Dedicated account support",
  ],
};

export function Pricing() {
  const faqs: FaqItem[] = [
    {
      value: "item-1",
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit cards, debit cards, bank transfers, and digital wallets including Apple Pay and Google Pay. For enterprise plans, we also offer invoice-based billing.",
    },
    {
      value: "item-2",
      question: "Can I cancel my subscription anytime?",
      answer:
        "Yes, you can cancel your subscription at any time with no penalties. You'll continue to have access until the end of your billing period, and we'll provide an export of all your data.",
    },
    {
      value: "item-3",
      question: "Do you offer volume discounts?",
      answer:
        "Yes, we offer custom pricing for teams with more than 50 users. Contact our sales team to discuss volume discounts and enterprise pricing options tailored to your needs.",
    },
    {
      value: "item-4",
      question: "How does billing work for additional users?",
      answer:
        "Additional users are billed on a pro-rata basis. When you add a new team member, you'll only pay for the remaining portion of the billing cycle.",
    },
    {
      value: "item-5",
      question: "Is there a setup fee?",
      answer:
        "No setup fees or hidden costs. The price you see is what you pay. We believe in transparent, straightforward pricing with no surprises.",
    },
    {
      value: "item-6",
      question: "What happens to my data if I downgrade?",
      answer:
        "Your data remains secure and accessible. Some advanced features may be disabled on lower-tier plans, but all your core data stays intact and can be exported anytime.",
    },
    {
      value: "item-7",
      question: "Do you provide implementation support?",
      answer:
        "Yes, all Business plan customers receive dedicated onboarding support, including setup assistance, team training sessions, and ongoing technical support.",
    },
  ];

  return (
    <section aria-label="Pricing" className="mx-auto w-full max-w-5xl">
      <div className="flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge variant="outline">Pricing & Faq</Badge>
          <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Transparent and simple
          </h2>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Choose the right plan for your team. Fair pricing, zero surprises.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <PricingCard plan={plan} />

          <FaqSection faqs={faqs} />
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan }: { plan: PricingPlan }) {
  return (
    <div className="mx-auto flex h-fit w-full max-w-md flex-col gap-6 rounded-4xl bg-card p-8 shadow-elevated-lg">
      <div className="flex flex-col gap-2">
        <h3 className="text-2xl font-medium text-foreground">{plan.label}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {plan.description}
        </p>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-6xl font-semibold tracking-tight text-foreground">
          ${plan.price}
        </span>
        <span className="text-xl text-muted-foreground">{plan.period}</span>
      </div>

      <Separator className="bg-border/50" />

      <ul className="flex flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <FancyButton size="lg" className="w-full">
        Contact us
      </FancyButton>
    </div>
  );
}

function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  return (
    <div className="flex max-w-md flex-col gap-6">
      <h3 className="text-sm text-muted-foreground">
        Frequently asked questions
      </h3>

      <Accordion defaultValue={["item-1"]} className="flex flex-col gap-2">
        {faqs.map((item) => (
          <AccordionItem
            value={item.value}
            key={item.value}
            className="rounded-xl border-none bg-muted px-4"
          >
            <AccordionTrigger className="group py-4 text-muted-foreground hover:text-foreground hover:no-underline aria-expanded:text-foreground *:data-[slot=accordion-trigger-icon]:hidden">
              <div className="flex w-full items-center justify-between gap-4">
                <span className="text-left text-sm">{item.question}</span>
                <div className="relative shrink-0 *:size-4 *:text-muted-foreground *:transition-opacity *:duration-300 *:group-hover:text-foreground">
                  <PlusIcon className="group-aria-expanded/accordion-trigger:opacity-0" />
                  <MinusIcon className="absolute inset-0 opacity-0 group-aria-expanded/accordion-trigger:opacity-100" />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 text-sm text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
export default Pricing;

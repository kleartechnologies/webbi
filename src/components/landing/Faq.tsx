"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export const FAQ_ITEMS: Array<[question: string, answer: string]> = [
  [
    "Do I need to buy a domain?",
    "No. Your website is live at webbi.my/w/your-business as soon as you publish. Custom domains are on the roadmap.",
  ],
  [
    "What if I don't have nice photos?",
    "Webbi builds a clean website from your text alone, and you can add photos from your phone anytime. Even 3 daylight photos make a big difference.",
  ],
  [
    "Can I change things after publishing?",
    "Yes, unlimited edits. Change prices, add a promotion, swap photos. Republishing is instant and free.",
  ],
  [
    "Is RM149.90 really the only payment?",
    "Yes. One payment per website, lifetime access, hosting included. No monthly fee, no renewal. A second website is another RM149.90.",
  ],
  [
    "Bahasa Malaysia or English?",
    "Either, or both. Describe your business in the language you use with customers and Webbi writes the website to match.",
  ],
  [
    "How do customers contact me?",
    "Through the big button on your site: WhatsApp, call, book, order, get a quote. You choose which one, Webbi suggests the best for your business.",
  ],
  [
    "Which businesses does Webbi support?",
    "Any legitimate small business or independent professional: F&B, automotive, property, beauty, home services, professional services, creative, education, retail, fitness and more.",
  ],
];

export function Faq() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section id="faq" className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 px-5 py-16 sm:px-6">
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">FAQ</span>
          <h2 className="text-[clamp(30px,4vw,42px)] leading-[1.08] tracking-[-0.03em]">Questions people ask</h2>
        </div>
        <div className="flex flex-col border-t border-line">
          {FAQ_ITEMS.map(([question, answer], i) => {
            const isOpen = open === i;
            return (
              <div key={question} className="border-b border-line">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 py-[18px] text-left text-[17px] font-bold text-ink"
                >
                  {question}
                  <Icon name={isOpen ? "expand_less" : "expand_more"} size={24} className="text-muted" />
                </button>
                {isOpen ? (
                  <p id={`faq-${i}`} className="pr-10 pb-[18px] text-[15px] leading-[1.6] text-muted">
                    {answer}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

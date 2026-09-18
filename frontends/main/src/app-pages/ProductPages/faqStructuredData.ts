import type { FAQItem } from "@mitodl/mitxonline-api-axios/v2"

export function buildFaqStructuredData(
  faqs: FAQItem[],
): Record<string, unknown> | null {
  if (!faqs.length) return null

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }
}

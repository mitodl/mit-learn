import { factories } from "api/mitxonline-test-utils"
import { buildFaqStructuredData } from "./faqStructuredData"

const makeFaq = factories.pages.faqItem

test("returns null when there are no FAQs", () => {
  expect(buildFaqStructuredData([])).toBeNull()
})

test("builds a schema.org FAQPage payload from the FAQs", () => {
  const faqs = [makeFaq(), makeFaq()]

  expect(buildFaqStructuredData(faqs)).toEqual({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  })
})

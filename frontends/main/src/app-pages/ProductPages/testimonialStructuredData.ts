import type { TestimonialItem } from "@mitodl/mitxonline-api-axios/v2"
import { stripHtmlToPlainText } from "@/common/stripHtmlToPlainText"

export function buildTestimonialStructuredData(
  testimonials: TestimonialItem[],
  itemReviewedName: string,
  itemReviewedDescription?: string,
): Record<string, unknown> | null {
  if (!itemReviewedName) return null

  // Google drops a Review with no author, and only allows reviewRating to be
  // omitted when datePublished is present.
  const reviews = testimonials
    .filter(
      (testimonial) => testimonial.name.trim() && testimonial.date_published,
    )
    .map((testimonial) => ({
      "@type": "Review",
      author: { "@type": "Person", name: testimonial.name.trim() },
      datePublished: testimonial.date_published,
      reviewBody: testimonial.quote,
    }))

  if (!reviews.length) return null

  const description = itemReviewedDescription
    ? stripHtmlToPlainText(itemReviewedDescription)
    : ""

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: itemReviewedName,
    // Course requires description, but an empty value is worse than none
    ...(description ? { description } : {}),
    review: reviews,
  }
}

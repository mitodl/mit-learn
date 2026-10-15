import type { TestimonialItem } from "@mitodl/mitxonline-api-axios/v2"
import { stripHtmlToPlainText } from "@/common/stripHtmlToPlainText"

export function buildTestimonialStructuredData(
  testimonials: TestimonialItem[],
  itemReviewedName: string,
  itemReviewedDescription?: string,
): Record<string, unknown> | null {
  const name = itemReviewedName.trim()
  if (!name) return null

  // Google requires name and description on Course, so a node without a
  // description cannot earn a review snippet - emit nothing instead.
  const description = itemReviewedDescription
    ? stripHtmlToPlainText(itemReviewedDescription)
    : ""
  if (!description) return null

  // Google drops a Review with no author, and only allows reviewRating to be
  // omitted when datePublished is present.
  const reviews = testimonials
    .map((testimonial) => ({
      "@type": "Review",
      author: { "@type": "Person", name: testimonial.name.trim() },
      datePublished: testimonial.date_published,
      reviewBody: testimonial.quote,
    }))
    .filter((review) => review.author.name && review.datePublished)

  if (!reviews.length) return null

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    description,
    review: reviews,
  }
}

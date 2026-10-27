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

  // Google demands an aggregate rating once a page carries more than one
  // review, and testimonials carry no rating to aggregate, so only the first is
  // marked up. It is also the one the carousel renders on first paint.
  const [testimonial] = testimonials
  if (!testimonial) return null

  // Google drops a Review with no author, and only allows reviewRating to be
  // omitted when datePublished is present.
  const authorName = testimonial.name.trim()
  if (!authorName || !testimonial.date_published) return null

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    description,
    review: [
      {
        "@type": "Review",
        author: { "@type": "Person", name: authorName },
        datePublished: testimonial.date_published,
        reviewBody: testimonial.quote,
      },
    ],
  }
}

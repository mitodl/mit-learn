import type { TestimonialItem } from "@mitodl/mitxonline-api-axios/v2"

export function buildTestimonialStructuredData(
  testimonials: TestimonialItem[],
  itemReviewedName: string,
): Record<string, unknown> | null {
  if (!itemReviewedName) return null

  // Google drops a Review with no author, and only allows reviewRating to be
  // omitted when datePublished is present.
  const reviews = testimonials
    .filter((testimonial) => testimonial.name && testimonial.date_published)
    .map((testimonial) => ({
      "@type": "Review",
      author: { "@type": "Person", name: testimonial.name },
      datePublished: testimonial.date_published,
      reviewBody: testimonial.quote,
    }))

  if (!reviews.length) return null

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: itemReviewedName,
    review: reviews,
  }
}

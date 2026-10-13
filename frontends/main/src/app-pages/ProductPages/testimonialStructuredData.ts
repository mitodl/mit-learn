import type { TestimonialItem } from "@mitodl/mitxonline-api-axios/v2"

export function buildTestimonialStructuredData(
  testimonials: TestimonialItem[],
  itemReviewedName: string,
): Record<string, unknown> | null {
  if (!itemReviewedName) return null

  // Google drops a Review snippet that has no author, so skip unattributed quotes.
  const reviews = testimonials
    .filter((testimonial) => testimonial.name)
    .map((testimonial) => ({
      "@type": "Review",
      itemReviewed: { "@type": "Course", name: itemReviewedName },
      author: { "@type": "Person", name: testimonial.name },
      datePublished: testimonial.date_published,
      reviewBody: testimonial.quote,
    }))

  if (!reviews.length) return null

  return {
    "@context": "https://schema.org",
    "@graph": reviews,
  }
}

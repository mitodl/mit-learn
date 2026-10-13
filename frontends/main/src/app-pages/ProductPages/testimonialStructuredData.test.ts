import { factories } from "api/mitxonline-test-utils"
import { buildTestimonialStructuredData } from "./testimonialStructuredData"

const makeTestimonial = factories.pages.testimonialItem

test("returns null when there are no testimonials", () => {
  expect(buildTestimonialStructuredData([], "Intro to Rocketry")).toBeNull()
})

test("returns null without a reviewed item name", () => {
  expect(buildTestimonialStructuredData([makeTestimonial()], "")).toBeNull()
})

test("builds a schema.org Review graph from the testimonials", () => {
  const testimonials = [makeTestimonial(), makeTestimonial()]

  expect(
    buildTestimonialStructuredData(testimonials, "Intro to Rocketry"),
  ).toEqual({
    "@context": "https://schema.org",
    "@graph": testimonials.map((testimonial) => ({
      "@type": "Review",
      itemReviewed: { "@type": "Course", name: "Intro to Rocketry" },
      author: { "@type": "Person", name: testimonial.name },
      datePublished: testimonial.date_published,
      reviewBody: testimonial.quote,
    })),
  })
})

test("omits testimonials without an author name", () => {
  const anonymous = makeTestimonial({ name: "" })
  const attributed = makeTestimonial()

  const result = buildTestimonialStructuredData(
    [anonymous, attributed],
    "Intro to Rocketry",
  )

  expect(result?.["@graph"]).toEqual([
    {
      "@type": "Review",
      itemReviewed: { "@type": "Course", name: "Intro to Rocketry" },
      author: { "@type": "Person", name: attributed.name },
      datePublished: attributed.date_published,
      reviewBody: attributed.quote,
    },
  ])
})

test("returns null when no testimonial has an author name", () => {
  expect(
    buildTestimonialStructuredData(
      [makeTestimonial({ name: "" })],
      "Intro to Rocketry",
    ),
  ).toBeNull()
})

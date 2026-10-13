import { factories } from "api/mitxonline-test-utils"
import { buildTestimonialStructuredData } from "./testimonialStructuredData"

const makeTestimonial = factories.pages.testimonialItem

test("returns null when there are no testimonials", () => {
  expect(buildTestimonialStructuredData([], "Intro to Rocketry")).toBeNull()
})

test("returns null without a reviewed item name", () => {
  expect(buildTestimonialStructuredData([makeTestimonial()], "")).toBeNull()
})

test("nests every review under a single Course node", () => {
  const testimonials = [makeTestimonial(), makeTestimonial()]

  expect(
    buildTestimonialStructuredData(testimonials, "Intro to Rocketry"),
  ).toEqual({
    "@context": "https://schema.org",
    "@type": "Course",
    name: "Intro to Rocketry",
    review: testimonials.map((testimonial) => ({
      "@type": "Review",
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

  expect(result?.review).toEqual([
    {
      "@type": "Review",
      author: { "@type": "Person", name: attributed.name },
      datePublished: attributed.date_published,
      reviewBody: attributed.quote,
    },
  ])
})

test("omits testimonials without a publication date", () => {
  const undated = makeTestimonial({ date_published: "" })
  const dated = makeTestimonial()

  const result = buildTestimonialStructuredData(
    [undated, dated],
    "Intro to Rocketry",
  )

  expect(result?.review).toEqual([
    {
      "@type": "Review",
      author: { "@type": "Person", name: dated.name },
      datePublished: dated.date_published,
      reviewBody: dated.quote,
    },
  ])
})

test("returns null when no testimonial can be attributed and dated", () => {
  expect(
    buildTestimonialStructuredData(
      [makeTestimonial({ name: "" }), makeTestimonial({ date_published: "" })],
      "Intro to Rocketry",
    ),
  ).toBeNull()
})

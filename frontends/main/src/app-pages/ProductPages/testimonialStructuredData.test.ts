import { factories } from "api/mitxonline-test-utils"
import { buildTestimonialStructuredData } from "./testimonialStructuredData"

const makeTestimonial = factories.pages.testimonialItem

const DESCRIPTION = "Build a rocket."

test("returns null when there are no testimonials", () => {
  expect(
    buildTestimonialStructuredData([], "Intro to Rocketry", DESCRIPTION),
  ).toBeNull()
})

test("returns null without a reviewed item name", () => {
  expect(
    buildTestimonialStructuredData([makeTestimonial()], "", DESCRIPTION),
  ).toBeNull()
})

test("marks up only the first testimonial", () => {
  const testimonials = [makeTestimonial(), makeTestimonial()]
  const [first] = testimonials

  expect(
    buildTestimonialStructuredData(
      testimonials,
      "Intro to Rocketry",
      DESCRIPTION,
    ),
  ).toEqual({
    "@context": "https://schema.org",
    "@type": "Course",
    name: "Intro to Rocketry",
    description: DESCRIPTION,
    review: [
      {
        "@type": "Review",
        author: { "@type": "Person", name: first.name },
        datePublished: first.date_published,
        reviewBody: first.quote,
      },
    ],
  })
})

test("carries the reviewed item's description as plain text", () => {
  const result = buildTestimonialStructuredData(
    [makeTestimonial()],
    "Intro to Rocketry",
    "<p>Build a rocket &amp; launch it.</p><p>Twice.</p>",
  )

  expect(result?.description).toBe("Build a rocket & launch it. Twice.")
})

test("returns null when the reviewed item has no description", () => {
  expect(
    buildTestimonialStructuredData([makeTestimonial()], "Intro to Rocketry"),
  ).toBeNull()
})

test("returns null when the description markup strips to nothing", () => {
  expect(
    buildTestimonialStructuredData(
      [makeTestimonial()],
      "Intro to Rocketry",
      "<p>&nbsp;</p>",
    ),
  ).toBeNull()
})

test("returns null when the reviewed item name is only whitespace", () => {
  expect(
    buildTestimonialStructuredData([makeTestimonial()], "   ", DESCRIPTION),
  ).toBeNull()
})

test("trims padding off the author name it emits", () => {
  const padded = makeTestimonial({ name: "  Ada Lovelace  " })

  const result = buildTestimonialStructuredData(
    [padded],
    "Intro to Rocketry",
    DESCRIPTION,
  )

  expect(result?.review).toEqual([
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Ada Lovelace" },
      datePublished: padded.date_published,
      reviewBody: padded.quote,
    },
  ])
})

test("returns null when the first testimonial's name is only whitespace", () => {
  expect(
    buildTestimonialStructuredData(
      [makeTestimonial({ name: "   " }), makeTestimonial()],
      "Intro to Rocketry",
      DESCRIPTION,
    ),
  ).toBeNull()
})

test("returns null when the first testimonial has no author name", () => {
  expect(
    buildTestimonialStructuredData(
      [makeTestimonial({ name: "" }), makeTestimonial()],
      "Intro to Rocketry",
      DESCRIPTION,
    ),
  ).toBeNull()
})

test("returns null when the first testimonial has no publication date", () => {
  expect(
    buildTestimonialStructuredData(
      [makeTestimonial({ date_published: "" }), makeTestimonial()],
      "Intro to Rocketry",
      DESCRIPTION,
    ),
  ).toBeNull()
})

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

test("nests every review under a single Course node", () => {
  const testimonials = [makeTestimonial(), makeTestimonial()]

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
    review: testimonials.map((testimonial) => ({
      "@type": "Review",
      author: { "@type": "Person", name: testimonial.name },
      datePublished: testimonial.date_published,
      reviewBody: testimonial.quote,
    })),
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

test("omits testimonials whose author name is only whitespace", () => {
  const blank = makeTestimonial({ name: "   " })
  const attributed = makeTestimonial()

  const result = buildTestimonialStructuredData(
    [blank, attributed],
    "Intro to Rocketry",
    DESCRIPTION,
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

test("omits testimonials without an author name", () => {
  const anonymous = makeTestimonial({ name: "" })
  const attributed = makeTestimonial()

  const result = buildTestimonialStructuredData(
    [anonymous, attributed],
    "Intro to Rocketry",
    DESCRIPTION,
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
    DESCRIPTION,
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
      DESCRIPTION,
    ),
  ).toBeNull()
})

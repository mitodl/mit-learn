import React from "react"
import { factories } from "api/mitxonline-test-utils"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import { getByImageSrc } from "ol-test-utilities"
import TestimonialsSection from "./TestimonialsSection"

const makeTestimonial = factories.pages.testimonialItem

test("Renders a labelled region with the first testimonial's quote, name and title", async () => {
  const testimonials = Array.from({ length: 3 }, (_, i) =>
    makeTestimonial({
      quote: `Quote number ${i}`,
      name: `Learner Name ${i}`,
      title: `Job Title ${i}`,
    }),
  )
  renderWithProviders(
    <TestimonialsSection
      testimonials={testimonials}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  within(section).getByRole("heading", {
    level: 2,
    name: "What learners are saying",
  })

  expect(within(section).getByText(testimonials[0].quote)).toBeVisible()
  expect(within(section).getByText(testimonials[0].name)).toBeVisible()
  expect(within(section).getByText(testimonials[0].title)).toBeVisible()
  expect(within(section).getByText(testimonials[1].quote)).not.toBeVisible()
})

test("Shows navigation arrows only when there is more than one testimonial", () => {
  const { view } = renderWithProviders(
    <TestimonialsSection
      testimonials={[makeTestimonial()]}
      itemReviewedName="Intro to Rocketry"
    />,
  )
  expect(
    screen.queryByRole("button", { name: "Show next testimonial" }),
  ).not.toBeInTheDocument()

  view.rerender(
    <TestimonialsSection
      testimonials={Array.from({ length: 2 }, () => makeTestimonial())}
      itemReviewedName="Intro to Rocketry"
    />,
  )
  expect(
    screen.getByRole("button", { name: "Show previous testimonial" }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole("button", { name: "Show next testimonial" }),
  ).toBeInTheDocument()
})

test("Cycles through testimonials with next and previous, showing one quote at a time", async () => {
  const testimonials = Array.from({ length: 3 }, (_, i) =>
    makeTestimonial({
      quote: `Quote number ${i}`,
      name: `Learner Name ${i}`,
      title: `Job Title ${i}`,
    }),
  )
  renderWithProviders(
    <TestimonialsSection
      testimonials={testimonials}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const prev = screen.getByRole("button", {
    name: "Show previous testimonial",
  })
  const next = screen.getByRole("button", { name: "Show next testimonial" })

  expect(prev).toBeDisabled()
  expect(next).toBeEnabled()
  expect(screen.getByText(testimonials[0].quote)).toBeVisible()

  await user.click(next)
  expect(screen.getByText(testimonials[0].quote)).not.toBeVisible()
  expect(screen.getByText(testimonials[1].quote)).toBeVisible()
  expect(prev).toBeEnabled()

  await user.click(next)
  expect(screen.getByText(testimonials[2].quote)).toBeVisible()
  expect(next).toBeDisabled()

  await user.click(prev)
  expect(screen.getByText(testimonials[1].quote)).toBeVisible()
  expect(next).toBeEnabled()
})

test("Keeps keyboard focus on the enabled arrow when reaching a boundary", async () => {
  const testimonials = Array.from({ length: 2 }, (_, i) =>
    makeTestimonial({ quote: `Quote number ${i}` }),
  )
  renderWithProviders(
    <TestimonialsSection
      testimonials={testimonials}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const prev = screen.getByRole("button", {
    name: "Show previous testimonial",
  })
  const next = screen.getByRole("button", { name: "Show next testimonial" })

  // Reaching the last item disables "next" — focus must move to "previous"
  // rather than falling back to <body>.
  await user.click(next)
  expect(next).toBeDisabled()
  expect(prev).toHaveFocus()

  // Reaching the first item disables "previous" — focus must move to "next".
  await user.click(prev)
  expect(prev).toBeDisabled()
  expect(next).toHaveFocus()
})

test("Renders the avatar image when a testimonial has one", async () => {
  const testimonial = makeTestimonial({ image_src: "https://x.test/face.jpg" })
  renderWithProviders(
    <TestimonialsSection
      testimonials={[testimonial]}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  getByImageSrc(section, "https://x.test/face.jpg")
})

test("Renders no avatar when a testimonial has no image", async () => {
  const testimonial = makeTestimonial({ image_src: null })
  renderWithProviders(
    <TestimonialsSection
      testimonials={[testimonial]}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  expect(section.querySelector("img")).not.toBeInTheDocument()
  expect(section.querySelector("svg")).not.toBeInTheDocument()
  within(section).getByText(testimonial.name)
})

test("Omits the title when a testimonial has none", async () => {
  const testimonial = makeTestimonial({ title: "" })
  renderWithProviders(
    <TestimonialsSection
      testimonials={[testimonial]}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  within(section).getByText(testimonial.name)
  within(section).getByText(testimonial.quote)
})

test("Emits Review structured data for every testimonial", async () => {
  const testimonials = Array.from({ length: 2 }, (_, i) =>
    makeTestimonial({ quote: `Quote number ${i}` }),
  )
  renderWithProviders(
    <TestimonialsSection
      testimonials={testimonials}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  const script = section.querySelector('script[type="application/ld+json"]')

  expect(JSON.parse(script?.textContent ?? "")).toEqual({
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

test("Includes the reviewed item's description in the structured data", async () => {
  renderWithProviders(
    <TestimonialsSection
      testimonials={[makeTestimonial()]}
      itemReviewedName="Intro to Rocketry"
      itemReviewedDescription="<p>Build a rocket.</p>"
    />,
  )

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  const script = section.querySelector('script[type="application/ld+json"]')

  expect(JSON.parse(script?.textContent ?? "")).toMatchObject({
    description: "Build a rocket.",
  })
})

test("Escapes characters that could break out of the JSON-LD script tag", async () => {
  const testimonial = makeTestimonial({
    quote: "</script><script>alert(1)</script>",
  })
  renderWithProviders(
    <TestimonialsSection
      testimonials={[testimonial]}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  const scripts = section.querySelectorAll("script")
  expect(scripts).toHaveLength(1)

  const raw = scripts[0].textContent ?? ""
  expect(raw).not.toContain("</script>")
  expect(JSON.parse(raw)).toMatchObject({
    review: [{ reviewBody: "</script><script>alert(1)</script>" }],
  })
})

// jest-dom's toBeVisible() returns false for the `hidden` attribute alone, so
// it would still pass if the CSS that overrides display:flex were removed.
test("Collapses inactive slides with CSS, not just the hidden attribute", async () => {
  const testimonials = Array.from({ length: 2 }, (_, i) =>
    makeTestimonial({ quote: `Quote number ${i}` }),
  )
  renderWithProviders(
    <TestimonialsSection
      testimonials={testimonials}
      itemReviewedName="Intro to Rocketry"
    />,
  )

  const inactive = screen
    .getByText(testimonials[1].quote)
    .closest("[hidden]") as HTMLElement

  expect(getComputedStyle(inactive).display).toBe("none")
})

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
  renderWithProviders(<TestimonialsSection testimonials={testimonials} />)

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  within(section).getByRole("heading", {
    level: 2,
    name: "What learners are saying",
  })

  within(section).getByText(testimonials[0].quote)
  within(section).getByText(testimonials[0].name)
  within(section).getByText(testimonials[0].title)
  expect(
    within(section).queryByText(testimonials[1].quote),
  ).not.toBeInTheDocument()
})

test("Shows navigation arrows only when there is more than one testimonial", () => {
  const { view } = renderWithProviders(
    <TestimonialsSection testimonials={[makeTestimonial()]} />,
  )
  expect(
    screen.queryByRole("button", { name: "Show next testimonial" }),
  ).not.toBeInTheDocument()

  view.rerender(
    <TestimonialsSection
      testimonials={Array.from({ length: 2 }, () => makeTestimonial())}
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
  renderWithProviders(<TestimonialsSection testimonials={testimonials} />)

  const prev = screen.getByRole("button", {
    name: "Show previous testimonial",
  })
  const next = screen.getByRole("button", { name: "Show next testimonial" })

  expect(prev).toBeDisabled()
  expect(next).toBeEnabled()
  screen.getByText(testimonials[0].quote)

  await user.click(next)
  expect(screen.queryByText(testimonials[0].quote)).not.toBeInTheDocument()
  screen.getByText(testimonials[1].quote)
  expect(prev).toBeEnabled()

  await user.click(next)
  screen.getByText(testimonials[2].quote)
  expect(next).toBeDisabled()

  await user.click(prev)
  screen.getByText(testimonials[1].quote)
  expect(next).toBeEnabled()
})

test("Keeps keyboard focus on the enabled arrow when reaching a boundary", async () => {
  const testimonials = Array.from({ length: 2 }, (_, i) =>
    makeTestimonial({ quote: `Quote number ${i}` }),
  )
  renderWithProviders(<TestimonialsSection testimonials={testimonials} />)

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
  renderWithProviders(<TestimonialsSection testimonials={[testimonial]} />)

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  getByImageSrc(section, "https://x.test/face.jpg")
})

test("Renders no avatar when a testimonial has no image", async () => {
  const testimonial = makeTestimonial({ image_src: null })
  renderWithProviders(<TestimonialsSection testimonials={[testimonial]} />)

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  expect(section.querySelector("img")).not.toBeInTheDocument()
  expect(section.querySelector("svg")).not.toBeInTheDocument()
  within(section).getByText(testimonial.name)
})

test("Omits the title when a testimonial has none", async () => {
  const testimonial = makeTestimonial({ title: "" })
  renderWithProviders(<TestimonialsSection testimonials={[testimonial]} />)

  const section = await screen.findByRole("region", {
    name: "What learners are saying",
  })
  within(section).getByText(testimonial.name)
  within(section).getByText(testimonial.quote)
})

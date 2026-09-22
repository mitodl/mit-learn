import React from "react"
import { factories } from "api/mitxonline-test-utils"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import FaqsSection from "./FaqsSection"

const makeFaq = factories.pages.faqItem

test("Renders a labelled region with every question collapsed", async () => {
  const faqs = Array.from({ length: 3 }, () => makeFaq())
  renderWithProviders(<FaqsSection faqs={faqs} />)

  const section = await screen.findByRole("region", {
    name: "FAQs",
  })

  faqs.forEach((faq) => {
    const button = within(section).getByRole("button", { name: faq.question })
    expect(button).toHaveAttribute("aria-expanded", "false")
    // Each question is also a heading so the page keeps a clean outline.
    within(section).getByRole("heading", { level: 3, name: faq.question })
  })
})

test("Expands an answer on click and leaves the others closed", async () => {
  const faqs = Array.from({ length: 3 }, () => makeFaq())
  renderWithProviders(<FaqsSection faqs={faqs} />)

  const [first, second] = faqs
  await user.click(screen.getByRole("button", { name: first.question }))

  expect(screen.getByRole("button", { name: first.question })).toHaveAttribute(
    "aria-expanded",
    "true",
  )
  expect(screen.getByRole("button", { name: second.question })).toHaveAttribute(
    "aria-expanded",
    "false",
  )
})

test("Renders the answer HTML", async () => {
  const faq = makeFaq({
    answer: '<p>See the <a href="https://x.test">docs</a>.</p>',
  })
  renderWithProviders(<FaqsSection faqs={[faq]} />)

  const raws = (await screen.findAllByTestId("raw")).map((el) => el.innerHTML)
  expect(raws).toContain(faq.answer)
})

test("Emits FAQPage structured data", () => {
  const faqs = [makeFaq(), makeFaq()]
  const { view } = renderWithProviders(<FaqsSection faqs={faqs} />)

  const script = view.container.querySelector(
    'script[type="application/ld+json"]',
  )
  expect(script).not.toBeNull()
  const data = JSON.parse((script?.textContent ?? "").replace(/\\u003c/g, "<"))
  expect(data["@type"]).toBe("FAQPage")
  expect(data.mainEntity).toHaveLength(2)
  expect(data.mainEntity[0].name).toBe(faqs[0].question)
})

test("Escapes HTML metacharacters so structured data can't break out of the script", () => {
  const faq = makeFaq({
    question: "Is 1 < 2 & 2 > 1?",
    answer: '<p>Yes.</p><script>alert("xss")</script>',
  })
  const { view } = renderWithProviders(<FaqsSection faqs={[faq]} />)

  const script = view.container.querySelector(
    'script[type="application/ld+json"]',
  )
  const raw = script?.textContent ?? ""
  // No unescaped angle brackets survive, so an authored </script> can't
  // terminate the element early.
  expect(raw).not.toContain("<")
  expect(raw).not.toContain(">")
  // The escaped payload still round-trips back to the original data.
  const data = JSON.parse(raw)
  expect(data.mainEntity[0].name).toBe(faq.question)
  expect(data.mainEntity[0].acceptedAnswer.text).toBe(faq.answer)
})

test("Toggles the summary icon between add and subtract", async () => {
  const faq = makeFaq()
  renderWithProviders(<FaqsSection faqs={[faq]} />)

  const button = screen.getByRole("button", { name: faq.question })
  const iconPath = () =>
    button
      .querySelector(".MuiAccordionSummary-expandIconWrapper svg path")
      ?.getAttribute("d")

  const collapsed = iconPath()
  await user.click(button)
  const expanded = iconPath()

  expect(collapsed).toBeTruthy()
  expect(expanded).toBeTruthy()
  expect(expanded).not.toBe(collapsed)
})

test("Wires aria-controls and aria-labelledby between each summary and its panel", () => {
  const faqs = Array.from({ length: 2 }, () => makeFaq())
  renderWithProviders(<FaqsSection faqs={faqs} />)

  faqs.forEach((faq) => {
    const button = screen.getByRole("button", { name: faq.question })
    const panelId = button.getAttribute("aria-controls")
    expect(panelId).toBeTruthy()
    const panel = document.getElementById(panelId as string)
    expect(panel).not.toBeNull()
    expect(panel?.getAttribute("aria-labelledby")).toBe(button.id)
  })
})

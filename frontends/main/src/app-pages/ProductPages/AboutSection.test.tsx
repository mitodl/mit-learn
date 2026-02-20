import React from "react"
import { factories } from "api/mitxonline-test-utils"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import invariant from "tiny-invariant"
import AboutSection from "./AboutSection"
import { faker } from "@faker-js/faker/locale/en"

const makePage = factories.pages.coursePageItem

const expectRawContent = (el: HTMLElement, htmlString: string) => {
  const raw = within(el).getByTestId("raw")
  expect(htmlString.length).toBeGreaterThan(0)
  expect(raw.innerHTML).toBe(htmlString)
}

test("About section has expected content", async () => {
  const about = `<p>${faker.lorem.paragraph()}</p>`
  const noun = faker.helpers.arrayElement(["Course", "Program"] as const)
  renderWithProviders(<AboutSection productNoun={noun} aboutHtml={about} />)

  const section = await screen.findByRole("region", {
    name: `About this ${noun}`,
  })
  expectRawContent(section, about)
})

test("About section expands and collapses", async () => {
  const firstParagraph = "This paragraph should be initially shown."
  const secondParagraph = "This should be hidden 1."
  const thirdParagraph = "T his should be hidden 2."
  const aboutContent = [firstParagraph, secondParagraph, thirdParagraph]
    .map((p) => `<p>${p}</p>`)
    .join("\n")
  const noun = faker.helpers.arrayElement(["Course", "Program"] as const)

  const page = makePage({ about: aboutContent })
  invariant(page.about)
  renderWithProviders(
    <AboutSection productNoun={noun} aboutHtml={page.about} />,
  )

  const about = await screen.findByRole("region", {
    name: `About this ${noun}`,
  })

  const p1 = within(about).getByText(firstParagraph)
  const p2 = within(about).queryByText(secondParagraph)
  const p3 = within(about).queryByText(thirdParagraph)

  expect(p1).toBeVisible()
  expect(p2).not.toBeVisible()
  expect(p3).not.toBeVisible()

  const toggle = within(about).getByRole("button", { name: "Show more" })
  await user.click(toggle)

  expect(p1).toBeVisible()
  expect(p2).toBeVisible()
  expect(p3).toBeVisible()

  expect(toggle).toHaveTextContent("Show less")
})

test.each([
  { aboutParagraphs: 1, expectToggler: false },
  { aboutParagraphs: 2, expectToggler: true },
])(
  "Show more/less link is not shown if there is only one paragraph in the About section",
  async ({ aboutParagraphs, expectToggler }) => {
    const aboutContent = Array.from(
      { length: aboutParagraphs },
      (_, i) => `<p>This is paragraph ${i + 1} in the about section.</p>`,
    ).join("\n")
    const noun = faker.helpers.arrayElement(["Course", "Program"] as const)

    renderWithProviders(
      <AboutSection productNoun={noun} aboutHtml={aboutContent} />,
    )

    const about = await screen.findByRole("region", {
      name: `About this ${noun}`,
    })

    const toggler = within(about).getByRole("button", {
      hidden: true,
    })
    // Can't reliably use name matcher because accessible name isn't computed when hidden.
    expect(toggler).toHaveTextContent(/show more|show less/i)

    if (expectToggler) {
      expect(toggler).toBeVisible()
    } else {
      expect(toggler).not.toBeVisible()
    }
  },
)

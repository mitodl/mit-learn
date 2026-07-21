import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { SiblingRunsPanel, SiblingRunsToggle } from "./SiblingRunsAccordion"

const makeEnrollment = (
  runOverrides: Record<string, unknown> = {},
): ReturnType<typeof mitxonline.factories.enrollment.courseEnrollment> =>
  mitxonline.factories.enrollment.courseEnrollment({ run: runOverrides })

/**
 * SiblingRunsToggle and SiblingRunsPanel are rendered in
 * different parts of the card DOM (the toggle in the header, the panel
 * below it) but share a single `expanded` state lifted to their parent.
 * This harness reproduces that pairing for tests.
 */
const SiblingRunsAccordionHarness: React.FC<{
  enrollment: ReturnType<typeof makeEnrollment>
  siblingEnrollments: ReturnType<typeof makeEnrollment>[]
}> = ({ enrollment, siblingEnrollments }) => {
  const [expanded, setExpanded] = React.useState(false)
  return (
    <>
      <SiblingRunsToggle
        runCount={siblingEnrollments.length + 1}
        expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        id="toggle"
        controls="panel"
      />
      <SiblingRunsPanel
        enrollment={enrollment}
        siblingEnrollments={siblingEnrollments}
        expanded={expanded}
        id="panel"
        labelledBy="toggle"
      />
    </>
  )
}

const expandAccordion = async () => {
  await user.click(screen.getByRole("button", { name: /Course runs/ }))
}

describe("SiblingRunsToggle + SiblingRunsPanel", () => {
  test("shows 'Course runs (N)' where N is total runs including current", () => {
    const enrollment = makeEnrollment()
    const siblings = [makeEnrollment(), makeEnrollment()]
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={siblings}
      />,
    )
    // 2 siblings + 1 current = 3
    expect(screen.getByText("Course runs (3)")).toBeInTheDocument()
  })

  test("accordion starts collapsed (aria-expanded false)", () => {
    const enrollment = makeEnrollment()
    const sibling = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    expect(screen.getByRole("button", { name: /Course runs/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
  })

  test("while collapsed, the panel's links are not present in the DOM", () => {
    const enrollment = makeEnrollment()
    const sibling = makeEnrollment({ courseware_url: faker.internet.url() })
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    // Collapsed content must not be mounted at all (not just visually
    // hidden), so keyboard/screen-reader users can't tab into a link that
    // isn't visible.
    expect(
      screen.queryByRole("link", { name: /View content/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  test("once expanded, the panel is exposed as a region labelled by the toggle", async () => {
    const enrollment = makeEnrollment()
    const sibling = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    await expandAccordion()
    const region = await screen.findByRole("region")
    expect(region).toHaveAttribute("aria-labelledby", "toggle")
  })

  test("clicking the toggle expands the panel", async () => {
    const enrollment = makeEnrollment()
    const sibling = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    await expandAccordion()
    expect(screen.getByRole("button", { name: /Course runs/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  test("shows the current run above the sibling list once expanded", async () => {
    const enrollment = makeEnrollment({
      start_date: moment("2026-01-05").toISOString(),
      end_date: moment("2026-08-20").toISOString(),
    })
    const sibling = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    await expandAccordion()
    expect(await screen.findByText("Current run:")).toBeInTheDocument()
    expect(screen.getByText(/Jan 5, 2026/)).toBeInTheDocument()
  })

  test("each sibling with a courseware URL shows a 'View content' link after expanding", async () => {
    const urlA = faker.internet.url()
    const urlB = faker.internet.url()
    const siblings = [
      makeEnrollment({ courseware_url: urlA }),
      makeEnrollment({ courseware_url: urlB }),
    ]
    const enrollment = makeEnrollment({ courseware_url: null })
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={siblings}
      />,
    )
    await expandAccordion()

    const links = await screen.findAllByRole("link", { name: /View content/ })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute("href", urlA)
    expect(links[1]).toHaveAttribute("href", urlB)
  })

  test("each 'View content' link has a distinct aria-label derived from its run label", async () => {
    const urlA = faker.internet.url()
    const urlB = faker.internet.url()
    const siblings = [
      makeEnrollment({
        courseware_url: urlA,
        start_date: moment("2020-01-15").toISOString(),
        end_date: moment("2020-03-15").toISOString(),
      }),
      makeEnrollment({
        courseware_url: urlB,
        start_date: moment("2021-06-10").toISOString(),
        end_date: moment("2021-08-10").toISOString(),
      }),
    ]
    const enrollment = makeEnrollment({ courseware_url: null })
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={siblings}
      />,
    )
    await expandAccordion()

    // The accessible name comes from the aria-label, not the shared
    // "View content" text, so each link is distinguishable by its run dates.
    const linkA = await screen.findByRole("link", {
      name: /View content for Jan 15, 2020/,
    })
    const linkB = await screen.findByRole("link", {
      name: /View content for Jun 10, 2021/,
    })
    expect(linkA).toHaveAttribute("href", urlA)
    expect(linkB).toHaveAttribute("href", urlB)
    expect(linkA.getAttribute("aria-label")).not.toEqual(
      linkB.getAttribute("aria-label"),
    )
  })

  test("siblings without a courseware URL do not get a 'View content' link", async () => {
    const sibling = makeEnrollment({ courseware_url: null })
    const enrollment = makeEnrollment({ courseware_url: null })
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    await expandAccordion()
    expect(
      screen.queryByRole("link", { name: /View content/ }),
    ).not.toBeInTheDocument()
  })

  test("upcoming sibling run label starts with 'Upcoming:'", async () => {
    const sibling = makeEnrollment({
      start_date: moment().add(30, "days").toISOString(),
      end_date: moment().add(90, "days").toISOString(),
      courseware_url: null,
    })
    const enrollment = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    await expandAccordion()
    expect(await screen.findByText(/^Upcoming:/)).toBeInTheDocument()
  })

  test("past sibling run does not use 'Upcoming:' prefix", async () => {
    const sibling = makeEnrollment({
      start_date: moment().subtract(90, "days").toISOString(),
      end_date: moment().subtract(30, "days").toISOString(),
      courseware_url: null,
    })
    const enrollment = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    await expandAccordion()
    // Wait for accordion to open, then assert no "Upcoming:" text
    expect(
      await screen.findByRole("button", { name: /Course runs/ }),
    ).toHaveAttribute("aria-expanded", "true")
    expect(screen.queryByText(/^Upcoming:/)).not.toBeInTheDocument()
  })

  test("renders the correct number of sibling rows", async () => {
    const siblings = Array.from({ length: 4 }, () =>
      makeEnrollment({ courseware_url: faker.internet.url() }),
    )
    const enrollment = makeEnrollment({ courseware_url: null })
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={siblings}
      />,
    )
    expect(screen.getByText("Course runs (5)")).toBeInTheDocument()
    await expandAccordion()
    const links = await screen.findAllByRole("link", { name: /View content/ })
    expect(links).toHaveLength(4)
  })
})

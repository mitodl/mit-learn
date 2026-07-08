import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { SiblingRunsAccordion } from "./SiblingRunsAccordion"

const makeEnrollment = (
  runOverrides: Record<string, unknown> = {},
): ReturnType<typeof mitxonline.factories.enrollment.courseEnrollment> =>
  mitxonline.factories.enrollment.courseEnrollment({ run: runOverrides })

const expandAccordion = async () => {
  await user.click(screen.getByRole("button", { name: /Course runs/ }))
}

describe("SiblingRunsAccordion", () => {
  test("shows 'Course runs (N)' where N is total runs including current", () => {
    const enrollment = makeEnrollment()
    const siblings = [makeEnrollment(), makeEnrollment()]
    renderWithProviders(
      <SiblingRunsAccordion
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
      <SiblingRunsAccordion
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    expect(screen.getByRole("button", { name: /Course runs/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
  })

  test("clicking the summary expands the accordion", async () => {
    const enrollment = makeEnrollment()
    const sibling = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordion
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

  test("each sibling with a courseware URL shows a 'View content' link after expanding", async () => {
    const urlA = faker.internet.url()
    const urlB = faker.internet.url()
    const siblings = [
      makeEnrollment({ courseware_url: urlA }),
      makeEnrollment({ courseware_url: urlB }),
    ]
    const enrollment = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordion
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
    const enrollment = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordion
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
    const enrollment = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordion
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
      <SiblingRunsAccordion
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
      <SiblingRunsAccordion
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
    const enrollment = makeEnrollment()
    renderWithProviders(
      <SiblingRunsAccordion
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

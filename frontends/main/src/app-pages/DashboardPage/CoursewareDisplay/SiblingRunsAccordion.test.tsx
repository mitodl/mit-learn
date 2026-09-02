import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  user,
  within,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { makeRequest } from "api/test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { SiblingRunsPanel, SiblingRunsToggle } from "./SiblingRunsAccordion"
import { setupOrderHistory } from "./test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"

jest.mock("posthog-js/react")

const setPerRunMenus = (enabled: boolean) => {
  jest
    .mocked(useFeatureFlagEnabled)
    .mockImplementation((flag) =>
      flag === FeatureFlags.MultipleRunContextMenus ? enabled : false,
    )
}

beforeEach(() => {
  // Each row resolves its own Receipt item from the order history; default to
  // none, tests override.
  setupOrderHistory()
  setPerRunMenus(true)
})

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

  // The run icons are aria-hidden, so this label is the only status a screen
  // reader gets for the current run. Every time state has to produce words.
  test.each([
    {
      case: "still running",
      startDate: moment().subtract(90, "days").toISOString(),
      endDate: moment().add(30, "days").toISOString(),
      expected: "In Progress",
    },
    {
      case: "already ended",
      startDate: moment().subtract(90, "days").toISOString(),
      endDate: moment().subtract(30, "days").toISOString(),
      expected: "Ended",
    },
    {
      case: "not yet started",
      startDate: moment().add(30, "days").toISOString(),
      endDate: moment().add(90, "days").toISOString(),
      expected: "Upcoming",
    },
  ])(
    "current run $case is labelled '$expected'",
    async ({ startDate, endDate, expected }) => {
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        certificate: null,
        grades: [],
        run: {
          start_date: startDate,
          end_date: endDate,
        },
      })
      renderWithProviders(
        <SiblingRunsAccordionHarness
          enrollment={enrollment}
          siblingEnrollments={[]}
        />,
      )
      await expandAccordion()
      const row = (await screen.findByText("Current run:")).closest("div")
      expect(row).toHaveTextContent(`(${expected})`)
    },
  )

  test("a past sibling run announces that it has ended", async () => {
    const enrollment = makeEnrollment({
      start_date: moment().subtract(30, "days").toISOString(),
      end_date: moment().add(30, "days").toISOString(),
    })
    // Explicitly not completed: the factory sets a certificate by default,
    // which would make this a completed run, and completion outranks the dates.
    const pastSibling = mitxonline.factories.enrollment.courseEnrollment({
      certificate: null,
      grades: [],
      run: {
        start_date: moment().subtract(400, "days").toISOString(),
        end_date: moment().subtract(300, "days").toISOString(),
      },
    })
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={[pastSibling]}
      />,
    )
    await expandAccordion()
    // The row shows only a date range visually; the expired icon is
    // aria-hidden, so the status has to reach screen readers some other way.
    expect(await screen.findByText("Ended")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /View content for .*\(Ended\)/ }),
    ).toBeInTheDocument()
  })

  test("a completed sibling run reads as completed, not ended", async () => {
    // Every completed run has ended, so this is the case where checking the
    // calendar before the enrollment status hid completion entirely.
    const completedSibling = mitxonline.factories.enrollment.courseEnrollment({
      grades: [mitxonline.factories.enrollment.grade({ passed: true })],
      run: {
        start_date: moment("2026-01-05").toISOString(),
        end_date: moment("2026-05-01").toISOString(),
      },
    })
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={makeEnrollment()}
        siblingEnrollments={[completedSibling]}
      />,
    )
    await expandAccordion()

    expect(
      await screen.findByRole("link", {
        name: /View content for Jan 5, 2026 – May 1, 2026 \(Completed\)/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /\(Ended\)/ }),
    ).not.toBeInTheDocument()
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
    // A run that hasn't started cannot be completed, so drop the factory's
    // default certificate; completion outranks the dates.
    const sibling = mitxonline.factories.enrollment.courseEnrollment({
      certificate: null,
      grades: [],
      run: {
        start_date: moment().add(30, "days").toISOString(),
        end_date: moment().add(90, "days").toISOString(),
        courseware_url: null,
      },
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

describe("per-run context menus", () => {
  // Fixed dates so a row can be addressed by its run label. Both are in the
  // past, so the label carries the "(Ended)" suffix.
  const SIBLING_RUN_DATES = {
    start_date: moment("2020-01-15").toISOString(),
    end_date: moment("2020-03-15").toISOString(),
  }
  const SIBLING_MENU = /More options for Jan 15, 2020/
  const CURRENT_MENU = /More options for Current run:/

  const setupTwoRuns = () => {
    const enrollment = makeEnrollment()
    const sibling = makeEnrollment(SIBLING_RUN_DATES)
    const render = () =>
      renderWithProviders(
        <SiblingRunsAccordionHarness
          enrollment={enrollment}
          siblingEnrollments={[sibling]}
        />,
      )
    return { enrollment, sibling, render }
  }

  const openSiblingMenu = async () => {
    await expandAccordion()
    await user.click(await screen.findByRole("button", { name: SIBLING_MENU }))
  }

  test("no row menus when the flag is off", async () => {
    setPerRunMenus(false)
    const { render } = setupTwoRuns()
    render()
    await expandAccordion()
    // The rows themselves still render; only the menus are withheld.
    expect(await screen.findByText("Current run:")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /More options for/ }),
    ).not.toBeInTheDocument()
  })

  test("every row, including the current run, has its own menu", async () => {
    const enrollment = makeEnrollment()
    const siblings = [makeEnrollment(), makeEnrollment()]
    renderWithProviders(
      <SiblingRunsAccordionHarness
        enrollment={enrollment}
        siblingEnrollments={siblings}
      />,
    )
    await expandAccordion()
    const menus = await screen.findAllByRole("button", {
      name: /^More options for/,
    })
    expect(menus).toHaveLength(3)
  })

  test("each row's menu is named for its own run", async () => {
    const { render } = setupTwoRuns()
    render()
    await expandAccordion()
    // The trigger repeats on every row, so the run label is the only thing
    // distinguishing them for a screen reader.
    expect(
      await screen.findByRole("button", { name: CURRENT_MENU }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: SIBLING_MENU })).toBeVisible()
  })

  test("unenrolling from a sibling row destroys that row's enrollment, not the displayed one", async () => {
    const { enrollment, sibling, render } = setupTwoRuns()
    setMockResponse.delete(
      mitxonline.urls.enrollment.courseEnrollment(sibling.id),
      null,
    )
    render()
    await openSiblingMenu()
    await user.click(await screen.findByRole("menuitem", { name: "Unenroll" }))

    const dialog = await screen.findByRole("dialog", {
      name: new RegExp(`Unenroll from ${sibling.run.course.title}`),
    })
    await user.click(within(dialog).getByRole("button", { name: "Unenroll" }))

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "delete",
        url: mitxonline.urls.enrollment.courseEnrollment(sibling.id),
      }),
    )
    // The whole point: the card's displayed run is left alone.
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: "delete",
        url: mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      }),
    )
  })

  /**
   * Verified against Orca, which announces a dialog's accessible name on open
   * and nothing else — not the body copy, and not a container-level
   * `aria-describedby`. So the run has to reach the name to be spoken, while
   * the heading stays short: the body's run line joins the name instead of
   * being pasted into the title.
   */
  test.each(["Unenroll", "Email Settings"])(
    "the %s dialog announces the run without putting it in the heading",
    async (item) => {
      const { render } = setupTwoRuns()
      render()
      await openSiblingMenu()
      await user.click(await screen.findByRole("menuitem", { name: item }))

      const dialog = await screen.findByRole("dialog", {
        name: /Course run: Jan 15, 2020 – Mar 15, 2020/,
      })
      // Visible in the body, where it belongs…
      expect(
        within(dialog).getByText("Jan 15, 2020 – Mar 15, 2020"),
      ).toBeInTheDocument()
      // …and not crammed into the heading.
      expect(within(dialog).getByRole("heading")).not.toHaveTextContent(
        "Jan 15, 2020",
      )
    },
  )

  test("each row's menu trigger announces as a menu button", async () => {
    const { render } = setupTwoRuns()
    render()
    await expandAccordion()
    const trigger = await screen.findByRole("button", { name: SIBLING_MENU })
    expect(trigger).toHaveAttribute("aria-haspopup", "menu")
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    await user.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    // N menus per card, so "menu" alone would not say which run's it is.
    expect(await screen.findByRole("menu")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Jan 15, 2020"),
    )
  })

  test("email settings from a sibling row updates that row's enrollment", async () => {
    const { enrollment, sibling, render } = setupTwoRuns()
    setMockResponse.patch(
      mitxonline.urls.enrollment.courseEnrollment(sibling.id),
      null,
    )
    render()
    await openSiblingMenu()
    await user.click(
      await screen.findByRole("menuitem", { name: "Email Settings" }),
    )

    const dialog = await screen.findByRole("dialog", {
      name: /^Email Settings/,
    })
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Receive course emails" }),
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Save Settings" }),
    )

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "patch",
        url: mitxonline.urls.enrollment.courseEnrollment(sibling.id),
      }),
    )
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: "patch",
        url: mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      }),
    )
  })

  test("Receipt shows only on the row whose run has an order", async () => {
    const { sibling, render } = setupTwoRuns()
    setupOrderHistory({ runId: sibling.run.id })
    render()

    await openSiblingMenu()
    expect(
      await screen.findByRole("menuitem", { name: "Receipt" }),
    ).toBeInTheDocument()

    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: CURRENT_MENU }))
    expect(
      await screen.findByRole("menuitem", { name: "Unenroll" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "Receipt" }),
    ).not.toBeInTheDocument()
  })
})

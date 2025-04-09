import React from "react"
import { renderWithProviders, screen, within } from "@/test-utils"
import { DashboardCard } from "./DashboardCard"
import { dashboardCourse } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { EnrollmentMode, EnrollmentStatus } from "./types"

const pastDashboardCourse: typeof dashboardCourse = (...overrides) => {
  return dashboardCourse(
    {
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.past().toISOString(),
      },
    },
    ...overrides,
  )
}
const currentDashboardCourse: typeof dashboardCourse = (...overrides) => {
  return dashboardCourse(
    {
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.future().toISOString(),
      },
    },
    ...overrides,
  )
}
const futureDashboardCourse: typeof dashboardCourse = (...overrides) => {
  return dashboardCourse(
    {
      run: {
        startDate: faker.date.future().toISOString(),
        endDate: faker.date.future().toISOString(),
      },
    },
    ...overrides,
  )
}

describe("EnrollmentCard", () => {
  test("It shows course title with link to marketing url", () => {
    const course = dashboardCourse()
    renderWithProviders(<DashboardCard dashboardResource={course} />)

    const courseLinks = screen.getAllByRole("link", {
      name: course.title,
    })
    for (const courseLink of courseLinks) {
      expect(courseLink).toHaveAttribute("href", course.marketingUrl)
    }
  })

  test("Accepts a classname", () => {
    const course = dashboardCourse()
    const { view } = renderWithProviders(
      <DashboardCard
        dashboardResource={course}
        className="some-custom classes"
      />,
    )
    expect(view.container.firstChild).toHaveClass("some-custom")
    expect(view.container.firstChild).toHaveClass("classes")
  })

  test.each([
    {
      course: pastDashboardCourse(),
      expected: { enabled: true },
      case: "past",
    },
    {
      course: currentDashboardCourse(),
      expected: { enabled: true },
      case: "current",
    },
    {
      course: futureDashboardCourse(),
      expected: { enabled: false },
      label: "future",
    },
  ])(
    "Courseware CTA and is enabled/disabled (enabled=$expected.enabled) based on date (case: $case)",
    ({ course, expected }) => {
      renderWithProviders(<DashboardCard dashboardResource={course} />)
      const mobileCTA = within(
        screen.getByTestId("enrollment-card-desktop"),
      ).getByTestId("courseware-button")

      const desktopCTA = within(
        screen.getByTestId("enrollment-card-desktop"),
      ).getByTestId("courseware-button")

      if (expected.enabled) {
        expect(mobileCTA).toBeEnabled()
        expect(desktopCTA).toBeEnabled()
      } else {
        expect(mobileCTA).toBeEnabled()
        expect(desktopCTA).toBeEnabled()
      }
    },
  )

  test.each([
    {
      course: pastDashboardCourse(),
      expected: { labelPrefix: "View" },
      case: "past",
    },
    {
      course: currentDashboardCourse(),
      expected: { labelPrefix: "Continue" },
      case: "current",
    },
    {
      course: futureDashboardCourse(),
      expected: { labelPrefix: "Continue" },
      label: "future",
    },
  ])(
    "Courseware CTA shows correct label based on courseNoun prop and dates (case $case)",
    ({ course, expected }) => {
      const { view } = renderWithProviders(
        <DashboardCard dashboardResource={course} />,
      )
      const coursewareCTA = screen.getByTestId("courseware-button")

      expect(coursewareCTA).toHaveTextContent(`${expected.labelPrefix} Course`)

      const courseNoun = faker.word.noun()
      view.rerender(
        <DashboardCard courseNoun={courseNoun} dashboardResource={course} />,
      )

      expect(coursewareCTA).toHaveTextContent(
        `${expected.labelPrefix} ${courseNoun}`,
      )
    },
  )

  test.each([
    {
      overrides: {
        run: {
          canUpgrade: true,
          certificateUpgradeDeadline: faker.date.future().toISOString(),
          certificateUpgradePrice: faker.commerce.price(),
        },
        enrollment: { mode: EnrollmentMode.Audit },
      },
      expectation: { visible: true },
    },
    {
      overrides: {
        run: {
          canUpgrade: true,
          certificateUpgradeDeadline: faker.date.future().toISOString(),
          certificateUpgradePrice: faker.commerce.price(),
        },
        enrollment: { mode: EnrollmentMode.Verified },
      },
      expectation: { visible: false },
    },
    {
      overrides: {
        run: { canUpgrade: false },
      },
      expectation: { visible: false },
    },
  ])(
    "Shows upgrade banner based on run.canUpgrade and not already upgraded (canUpgrade: $overrides.canUpgrade)",
    ({ overrides, expectation }) => {
      const course = dashboardCourse(overrides)
      renderWithProviders(<DashboardCard dashboardResource={course} />)
      const upgradeRootDesktop = within(
        screen.getByTestId("enrollment-card-desktop"),
      ).queryByTestId("upgrade-root")
      const upgradeRootMobile = within(
        screen.getByTestId("enrollment-card-mobile"),
      ).queryByTestId("upgrade-root")
      expect(!!upgradeRootDesktop).toBe(expectation.visible)
      expect(!!upgradeRootMobile).toBe(expectation.visible)
    },
  )

  test.each([
    { offerUpgrade: true, expected: { visible: true } },
    { offerUpgrade: false, expected: { visible: false } },
  ])(
    "Never shows upgrade banner if `offerUpgrade` is false",
    ({ offerUpgrade, expected }) => {
      const course = dashboardCourse({
        run: {
          canUpgrade: true,
          certificateUpgradeDeadline: faker.date.future().toISOString(),
          certificateUpgradePrice: faker.commerce.price(),
        },
        enrollment: { mode: EnrollmentMode.Audit },
      })

      renderWithProviders(
        <DashboardCard
          dashboardResource={course}
          offerUpgrade={offerUpgrade}
        />,
      )

      const upgradeRoot = screen.queryByTestId("upgrade-root")
      expect(!!upgradeRoot).toBe(expected.visible)
    },
  )

  test("Upgrade banner shows correct price and deadline", () => {
    const certificateUpgradePrice = faker.commerce.price()
    const certificateUpgradeDeadline = moment()
      .startOf("day")
      .add(5, "days")
      .add(3, "hours")
      .toISOString()

    const course = dashboardCourse({
      run: {
        canUpgrade: true,
        certificateUpgradeDeadline,
        certificateUpgradePrice,
      },
      enrollment: { mode: EnrollmentMode.Audit },
    })

    renderWithProviders(<DashboardCard dashboardResource={course} />)

    const upgradeRootDesktop = within(
      screen.getByTestId("enrollment-card-desktop"),
    ).queryByTestId("upgrade-root")
    const upgradeRootMobile = within(
      screen.getByTestId("enrollment-card-mobile"),
    ).queryByTestId("upgrade-root")
    for (const upgradeRoot of [upgradeRootDesktop, upgradeRootMobile]) {
      expect(upgradeRoot).toBeVisible()

      expect(upgradeRoot).toHaveTextContent(/5 days remaining/)
      expect(upgradeRoot).toHaveTextContent(
        `Add a certificate for $${certificateUpgradePrice}`,
      )
    }
  })

  test("Shows number of days until course starts", () => {
    const startDate = moment()
      .startOf("day")
      .add(5, "days")
      .add(3, "hours")
      .toISOString()
    const enrollment = dashboardCourse({ run: { startDate } })
    const { view } = renderWithProviders(
      <DashboardCard dashboardResource={enrollment} />,
    )

    expect(view.container).toHaveTextContent(/starts in 5 days/i)
  })

  test.each([{ showNotComplete: true }, { showNotComplete: false }])(
    "Shows incomplete status when showNotComplete is true",
    ({ showNotComplete }) => {
      const enrollment = faker.helpers.arrayElement([
        { status: EnrollmentStatus.NotEnrolled },
        { status: EnrollmentStatus.Enrolled },
        undefined,
      ])
      const course = dashboardCourse({ enrollment })
      if (!enrollment) {
        course.enrollment = undefined
      }
      const { view } = renderWithProviders(
        <DashboardCard
          dashboardResource={course}
          showNotComplete={showNotComplete}
        />,
      )

      const indicator = screen.queryByTestId("enrollment-status")
      expect(!!indicator).toBe(showNotComplete)

      view.rerender(
        <DashboardCard
          dashboardResource={dashboardCourse({
            enrollment: { status: EnrollmentStatus.Completed },
          })}
          showNotComplete={showNotComplete}
        />,
      )
      // Completed should always show the indicator
      screen.getByTestId("enrollment-status")
    },
  )

  test.each([
    {
      status: EnrollmentStatus.Completed,
      expectedLabel: "Completed",
      hiddenImage: true,
    },
    {
      status: EnrollmentStatus.Enrolled,
      expectedLabel: "Enrolled",
      hiddenImage: true,
    },
    { status: EnrollmentStatus.NotEnrolled, expectedLabel: "Not Enrolled" },
  ])(
    "Enrollment indicator shows meaningful text",
    ({ status, expectedLabel, hiddenImage }) => {
      renderWithProviders(
        <DashboardCard
          dashboardResource={dashboardCourse({ enrollment: { status } })}
        />,
      )
      const indicator = screen.getByTestId("enrollment-status")
      expect(indicator).toHaveTextContent(expectedLabel)

      // Double check the image is aria-hidden, since we're using
      // VisuallyHidden text instead of alt
      const img = indicator.querySelector("img")
      if (hiddenImage) {
        expect(img).toHaveAttribute("aria-hidden", "true")
        expect(img).toHaveAttribute("alt", "")
      } else {
        expect(img).toBe(null)
      }
    },
  )
})

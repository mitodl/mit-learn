import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { DashboardCard } from "./DashboardCard"
import { dashboardCourse } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { EnrollmentMode, EnrollmentStatus } from "./types"

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

  test("Courseware button is disabled if course has not started", () => {
    const course = dashboardCourse({
      run: {
        startDate: faker.date.future().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const coursewareButtons = screen.getAllByRole("button", {
      name: "Continue Course",
      hidden: true,
    })
    for (const coursewareButton of coursewareButtons) {
      expect(coursewareButton).toBeDisabled()
    }
  })

  test("Courseware button is enabled if course has started AND NOT ended", () => {
    const course = dashboardCourse({
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.future().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const coursewareLinks = screen.getAllByRole("link", {
      name: "Continue Course",
    })
    for (const coursewareLink of coursewareLinks) {
      expect(coursewareLink).toHaveAttribute("href", course.run.coursewareUrl)
    }
  })

  test("Courseware button says 'View Course' if course has ended", () => {
    const course = dashboardCourse({
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.past().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const coursewareLinks = screen.getAllByRole("link", {
      name: "View Course",
    })
    for (const coursewareLink of coursewareLinks) {
      expect(coursewareLink).toHaveAttribute("href", course.run.coursewareUrl)
    }
  })

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
    "Shows upgrade banner if and only if run.canUpgrade and not already upgraded (canUpgrade: $overrides.canUpgrade)",
    ({ overrides, expectation }) => {
      const course = dashboardCourse(overrides)
      renderWithProviders(<DashboardCard dashboardResource={course} />)
      const upgradeRootDesktop = screen.queryByTestId("upgrade-root-desktop")
      const upgradeRootMobile = screen.queryByTestId("upgrade-root-mobile")
      expect(!!upgradeRootDesktop).toBe(expectation.visible)
      expect(!!upgradeRootMobile).toBe(expectation.visible)
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

    const upgradeRootDesktop = screen.queryByTestId("upgrade-root-desktop")
    const upgradeRootMobile = screen.queryByTestId("upgrade-root-mobile")
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

  test.each([
    {
      enrollmentStatus: EnrollmentStatus.Completed,
      hasCompleted: true,
      showNotComplete: false,
    },
    {
      enrollmentStatus: EnrollmentStatus.Enrolled,
      hasCompleted: false,
      showNotComplete: false,
    },
    {
      enrollmentStatus: EnrollmentStatus.Completed,
      hasCompleted: true,
      showNotComplete: true,
    },
    {
      enrollmentStatus: EnrollmentStatus.Enrolled,
      hasCompleted: false,
      showNotComplete: true,
    },
  ])(
    "Shows completed icon if course is completed",
    ({ enrollmentStatus, hasCompleted, showNotComplete }) => {
      const course = dashboardCourse({
        enrollment: { status: enrollmentStatus },
      })
      renderWithProviders(
        <DashboardCard
          dashboardResource={course}
          showNotComplete={showNotComplete}
        />,
      )

      const completedIcon = screen.queryAllByRole("img", { name: "Completed" })
      for (const icon of completedIcon) {
        expect(!!icon).toBe(hasCompleted)
      }
    },
  )
})

test.each([
  { enrollmentStatus: EnrollmentStatus.NotEnrolled, showNotComplete: true },
  { enrollmentStatus: EnrollmentStatus.NotEnrolled, showNotComplete: false },
])(
  "Shows empty circle icon if not enrolled and showNotComplete is true",
  ({ enrollmentStatus, showNotComplete }) => {
    const course = dashboardCourse({
      enrollment: { status: enrollmentStatus },
    })
    renderWithProviders(
      <DashboardCard
        dashboardResource={course}
        showNotComplete={showNotComplete}
      />,
    )

    const notCompletedIconDesktop = screen.queryByTestId(
      "not-complete-icon-desktop",
    )
    const notCompletedIconMobile = screen.queryByTestId(
      "not-complete-icon-mobile",
    )
    expect(!!notCompletedIconDesktop).toBe(showNotComplete)
    expect(!!notCompletedIconMobile).toBe(showNotComplete)
  },
)

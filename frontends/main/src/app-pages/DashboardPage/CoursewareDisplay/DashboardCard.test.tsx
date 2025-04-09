import React from "react"
import { renderWithProviders, screen, within } from "@/test-utils"
import { DashboardCard } from "./DashboardCard"
import { dashboardCourse } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { EnrollmentMode, EnrollmentStatus } from "./types"

describe.each([
  { display: "desktop", testId: "enrollment-card" },
  { display: "mobile", testId: "enrollment-card-mobile" },
])("EnrollmentCard $display", ({ testId }) => {
  test("It shows course title with link to marketing url", () => {
    const course = dashboardCourse()
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const card = screen.getByTestId(testId)

    const courseLink = within(card).getByRole("link", {
      name: course.title,
    })
    expect(courseLink).toHaveAttribute("href", course.marketingUrl)
  })

  test("Courseware button is disabled if course has not started", () => {
    const course = dashboardCourse({
      run: {
        startDate: faker.date.future().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)

    const card = screen.getByTestId(testId)
    const coursewareButton = within(card).getByRole("button", {
      name: "Continue Course",
      hidden: true,
    })
    expect(coursewareButton).toBeDisabled()
  })

  test("Courseware button is enabled if course has started AND NOT ended", () => {
    const course = dashboardCourse({
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.future().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const card = screen.getByTestId(testId)
    const coursewareLink = within(card).getByRole("link", {
      name: "Continue Course",
    })
    expect(coursewareLink).toHaveAttribute("href", course.run.coursewareUrl)
  })

  test("Courseware button says 'View Course' if course has ended", () => {
    const course = dashboardCourse({
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.past().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const card = screen.getByTestId(testId)

    const coursewareLink = within(card).getByRole("link", {
      name: "View Course",
    })
    expect(coursewareLink).toHaveAttribute("href", course.run.coursewareUrl)
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
      const card = screen.getByTestId(testId)

      const upgradeRoot = within(card).queryByTestId("upgrade-root")
      expect(!!upgradeRoot).toBe(expectation.visible)
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
    const card = screen.getByTestId(testId)

    const upgradeRoot = within(card).getByTestId("upgrade-root")
    expect(upgradeRoot).toBeVisible()

    expect(upgradeRoot).toHaveTextContent(/5 days remaining/)
    expect(upgradeRoot).toHaveTextContent(
      `Add a certificate for $${certificateUpgradePrice}`,
    )
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
    { enrollmentStatus: EnrollmentStatus.Completed, hasCompleted: true },
    { enrollmentStatus: EnrollmentStatus.Enrolled, hasCompleted: false },
  ])(
    "Shows completed icon if course is completed",
    ({ enrollmentStatus, hasCompleted }) => {
      const course = dashboardCourse({
        enrollment: { status: enrollmentStatus },
      })
      renderWithProviders(<DashboardCard dashboardResource={course} />)
      const card = screen.getByTestId(testId)

      const completedIcon = within(card).queryByRole("img", {
        name: "Completed",
      })
      expect(!!completedIcon).toBe(hasCompleted)
    },
  )

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
      const card = screen.getByTestId(testId)

      const notCompletedIcon = within(card).queryByTestId("not-complete-icon")
      expect(!!notCompletedIcon).toBe(showNotComplete)
    },
  )
})

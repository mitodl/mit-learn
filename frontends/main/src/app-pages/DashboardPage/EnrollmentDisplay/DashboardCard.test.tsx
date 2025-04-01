import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { DashboardCard } from "./DashboardCard"
import { dashboardCourse } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { EnrollmentStatus } from "./types"

describe("EnrollmentCard", () => {
  test("It shows course title with link to marketing url", () => {
    const course = dashboardCourse()
    renderWithProviders(<DashboardCard dashboardResource={course} />)

    const courseLink = screen.getByRole("link", {
      name: course.data.title,
    })
    expect(courseLink).toHaveAttribute("href", course.data.marketingUrl)
  })

  test("Courseware button is disabled if course has not started", () => {
    const course = dashboardCourse({
      data: {
        startDate: faker.date.future().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const coursewareButton = screen.getByRole("button", {
      name: "Continue Course",
      hidden: true,
    })
    expect(coursewareButton).toBeDisabled()
  })

  test("Courseware button is enabled if course has started AND NOT ended", () => {
    const course = dashboardCourse({
      data: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.future().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const coursewareLink = screen.getByRole("link", {
      name: "Continue Course",
    })
    expect(coursewareLink).toHaveAttribute("href", course.data.coursewareUrl)
  })

  test("Courseware button says 'View Course' if course has ended", () => {
    const course = dashboardCourse({
      data: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.past().toISOString(),
      },
    })
    renderWithProviders(<DashboardCard dashboardResource={course} />)
    const coursewareLink = screen.getByRole("link", {
      name: "View Course",
    })
    expect(coursewareLink).toHaveAttribute("href", course.data.coursewareUrl)
  })

  test.each([
    {
      overrides: {
        canUpgrade: true,
        certificateUpgradeDeadline: faker.date.future().toISOString(),
        certificateUpgradePrice: faker.commerce.price(),
      },
      expectation: { visible: true },
    },
    {
      overrides: { canUpgrade: false },
      expectation: { visible: false },
    },
  ])(
    "Shows upgrade banner if and only if user can upgrade (canUpgrade: $overrides.canUpgrade)",
    ({ overrides, expectation }) => {
      const course = dashboardCourse({ data: overrides })
      renderWithProviders(<DashboardCard dashboardResource={course} />)
      const upgradeRoot = screen.queryByTestId("upgrade-root")
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
      data: {
        canUpgrade: true,
        certificateUpgradeDeadline,
        certificateUpgradePrice,
      },
    })

    renderWithProviders(<DashboardCard dashboardResource={course} />)

    const upgradeRoot = screen.getByTestId("upgrade-root")
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
    const enrollment = dashboardCourse({ data: { startDate } })
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
        data: { enrollmentStatus },
      })
      renderWithProviders(<DashboardCard dashboardResource={course} />)

      const completedIcon = screen.queryByRole("img", { name: "Completed" })
      expect(!!completedIcon).toBe(hasCompleted)
    },
  )
})

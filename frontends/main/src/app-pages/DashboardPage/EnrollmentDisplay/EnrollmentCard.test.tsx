import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { EnrollmentCard } from "./EnrollmentCard"
import { enrollmentData } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"

describe("EnrollmentCard", () => {
  test("It shows course title with link to marketing url", () => {
    const enrollment = enrollmentData()
    renderWithProviders(<EnrollmentCard enrollment={enrollment} />)

    const courseLink = screen.getByRole("link", {
      name: enrollment.title,
    })
    expect(courseLink).toHaveAttribute("href", enrollment.marketingUrl)
  })

  test("Courseware button is disabled if course has not started", () => {
    const enrollment = enrollmentData({
      startDate: faker.date.future().toISOString(),
    })
    renderWithProviders(<EnrollmentCard enrollment={enrollment} />)
    const coursewareButton = screen.getByRole("button", {
      name: "Continue Course",
      hidden: true,
    })
    expect(coursewareButton).toBeDisabled()
  })

  test("Courseware button is enabled if course has started AND NOT ended", () => {
    const enrollment = enrollmentData({
      startDate: faker.date.past().toISOString(),
      endDate: faker.date.future().toISOString(),
    })
    renderWithProviders(<EnrollmentCard enrollment={enrollment} />)
    const coursewareLink = screen.getByRole("link", {
      name: "Continue Course",
    })
    expect(coursewareLink).toHaveAttribute("href", enrollment.coursewareUrl)
  })

  test("Courseware button says 'View Course' if course has ended", () => {
    const enrollment = enrollmentData({
      startDate: faker.date.past().toISOString(),
      endDate: faker.date.past().toISOString(),
    })
    renderWithProviders(<EnrollmentCard enrollment={enrollment} />)
    const coursewareLink = screen.getByRole("link", {
      name: "View Course",
    })
    expect(coursewareLink).toHaveAttribute("href", enrollment.coursewareUrl)
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
      const enrollment = enrollmentData(overrides)
      renderWithProviders(<EnrollmentCard enrollment={enrollment} />)
      const upgradeRoot = screen.queryByTestId("upgrade-root")
      expect(!!upgradeRoot).toBe(expectation.visible)
    },
  )

  test("Upgrade banner shows correct price and deadline", () => {
    const certificateUpgradePrice = faker.commerce.price()
    const certificateUpgradeDeadline = moment()
      .add(5, "days")
      .add(3, "hours")
      .toISOString()

    const enrollment = enrollmentData({
      canUpgrade: true,
      certificateUpgradeDeadline,
      certificateUpgradePrice,
    })

    renderWithProviders(<EnrollmentCard enrollment={enrollment} />)

    const upgradeRoot = screen.getByTestId("upgrade-root")
    expect(upgradeRoot).toBeVisible()

    expect(upgradeRoot).toHaveTextContent(/5 days remaining/)
    expect(upgradeRoot).toHaveTextContent(
      `Add a certificate for $${certificateUpgradePrice}`,
    )
  })

  test("Shows number of days until course starts", () => {
    const startDate = moment().add(5, "days").add(3, "hours").toISOString()
    const enrollment = enrollmentData({ startDate })
    const { view } = renderWithProviders(
      <EnrollmentCard enrollment={enrollment} />,
    )

    expect(view.container).toHaveTextContent(/starts in 5 days/i)
  })
})

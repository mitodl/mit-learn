import React from "react"
import { renderWithProviders, screen, user, within } from "@/test-utils"
import { DashboardCard, getDefaultContextMenuItems } from "./DashboardCard"
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

describe.each([
  { display: "desktop", testId: "enrollment-card-desktop" },
  { display: "mobile", testId: "enrollment-card-mobile" },
])("EnrollmentCard $display", ({ testId }) => {
  const getCard = () => screen.getByTestId(testId)

  test("It shows course title with link to marketing url", () => {
    const course = dashboardCourse()
    renderWithProviders(<DashboardCard dashboardResource={course} />)

    const card = getCard()

    const courseLink = within(card).getByRole("link", {
      name: course.title,
    })
    expect(courseLink).toHaveAttribute("href", course.marketingUrl)
  })

  test("Accepts a classname", () => {
    const course = dashboardCourse()
    const TheComponent = faker.helpers.arrayElement([
      "li",
      "div",
      "span",
      "article",
    ])
    renderWithProviders(
      <DashboardCard
        Component={TheComponent}
        dashboardResource={course}
        className="some-custom classes"
      />,
    )
    const card = getCard()
    expect(card.tagName).toBe(TheComponent.toUpperCase())
    expect(card).toHaveClass("some-custom")
    expect(card).toHaveClass("classes")
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
      const card = getCard()
      const coursewareCTA = within(card).getByTestId("courseware-button")

      if (expected.enabled) {
        expect(coursewareCTA).toBeEnabled()
      } else {
        expect(coursewareCTA).toBeDisabled()
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
      const card = getCard()
      const coursewareCTA = within(card).getByTestId("courseware-button")

      if (
        course.enrollment?.status === EnrollmentStatus.NotEnrolled ||
        !course.enrollment
      ) {
        expect(coursewareCTA).toHaveTextContent("Enroll")
      } else {
        expect(coursewareCTA).toHaveTextContent(
          `${expected.labelPrefix} Course`,
        )
      }

      const courseNoun = faker.word.noun()
      view.rerender(
        <DashboardCard courseNoun={courseNoun} dashboardResource={course} />,
      )

      if (
        course.enrollment?.status === EnrollmentStatus.NotEnrolled ||
        !course.enrollment
      ) {
        expect(coursewareCTA).toHaveTextContent("Enroll")
      } else {
        expect(coursewareCTA).toHaveTextContent(
          `${expected.labelPrefix} ${courseNoun}`,
        )
      }
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
      const card = getCard()
      const upgradeRoot = within(card).queryByTestId("upgrade-root")

      expect(!!upgradeRoot).toBe(expectation.visible)
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
      const card = getCard()

      const upgradeRoot = within(card).queryByTestId("upgrade-root")
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
    const card = getCard()
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
    renderWithProviders(<DashboardCard dashboardResource={enrollment} />)
    const card = getCard()

    expect(card).toHaveTextContent(/starts in 5 days/i)
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
      const card = getCard()

      const indicator = within(card).queryByTestId("enrollment-status")
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
      within(card).getByTestId("enrollment-status")
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
    {
      status: EnrollmentStatus.NotEnrolled,
      expectedLabel: "Not Enrolled",
      hiddenImage: true,
    },
  ])(
    "Enrollment indicator shows meaningful text",
    ({ status, expectedLabel, hiddenImage }) => {
      renderWithProviders(
        <DashboardCard
          dashboardResource={dashboardCourse({ enrollment: { status } })}
        />,
      )
      const card = getCard()
      const indicator = within(card).getByTestId("enrollment-status")
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

  test.each([
    { contextMenuItems: [] },
    {
      contextMenuItems: [
        {
          key: "test-key",
          label: "Test",
          onClick: () => {},
        },
      ],
    },
  ])(
    "getDefaultContextMenuItems returns correct items",
    async ({ contextMenuItems }) => {
      const course = dashboardCourse()
      course.enrollment = {
        id: faker.number.int(),
        status: EnrollmentStatus.Completed,
        mode: EnrollmentMode.Verified,
      }
      renderWithProviders(
        <DashboardCard
          dashboardResource={course}
          contextMenuItems={contextMenuItems}
        />,
      )
      const card = getCard()
      const contextMenuButton = within(card).getByRole("button", {
        name: "More options",
      })
      await user.click(contextMenuButton)
      const expectedMenuItems = [
        ...contextMenuItems,
        ...getDefaultContextMenuItems("Test Course", course.enrollment),
      ]
      const menuItems = screen.getAllByRole("menuitem")
      for (let i = 0; i < expectedMenuItems.length; i++) {
        const menuItem = expectedMenuItems[i]
        const menuItemElement = menuItems.find((item) => {
          if (item.textContent === menuItem.label) {
            return item
          }
        })
        expect(menuItemElement?.textContent).toBe(menuItem.label)
      }
    },
  )

  test.each([
    { status: EnrollmentStatus.Completed },
    { status: EnrollmentStatus.Enrolled },
    { status: EnrollmentStatus.NotEnrolled },
    { status: undefined },
  ])(
    "Context menu button is not shown when enrollment status is not Completed or Enrolled",
    ({ status }) => {
      renderWithProviders(
        <DashboardCard
          dashboardResource={dashboardCourse({ enrollment: { status } })}
        />,
      )
      const card = getCard()
      const expectedVisible =
        status === EnrollmentStatus.Completed ||
        status === EnrollmentStatus.Enrolled
      const contextMenuButton = within(card).queryByRole("button", {
        name: "More options",
        hidden: !expectedVisible,
      })
      if (expectedVisible) {
        expect(contextMenuButton).toBeVisible()
      }
    },
  )
})

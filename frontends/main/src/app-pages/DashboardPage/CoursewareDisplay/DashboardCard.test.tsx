import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
  within,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { mockAxiosInstance } from "api/test-utils"
import { DashboardCard, getDefaultContextMenuItems } from "./DashboardCard"
import { dashboardCourse, dashboardProgram } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { EnrollmentMode, EnrollmentStatus } from "./types"
import { cartesianProduct } from "ol-test-utilities"

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

const mitxUser = mitxonline.factories.user.user

const setupUserApis = () => {
  const mitxUser = mitxonline.factories.user.user()
  setMockResponse.get(mitxonline.urls.userMe.get(), mitxUser)
}

describe.each([
  { display: "desktop", testId: "enrollment-card-desktop" },
  { display: "mobile", testId: "enrollment-card-mobile" },
])("DashboardCard $display", ({ testId }) => {
  const getCard = () => screen.getByTestId(testId)

  setupLocationMock()

  test("It shows course title and links to marketingUrl if titleAction is marketing and enrolled", async () => {
    setupUserApis()
    const course = dashboardCourse({
      marketingUrl: "?some-marketing-url",
      enrollment: {
        status: EnrollmentStatus.Enrolled,
      },
    })
    renderWithProviders(
      <DashboardCard titleAction="marketing" dashboardResource={course} />,
    )

    const card = getCard()

    const courseLink = within(card).getByRole("link", {
      name: course.title,
    })
    expect(courseLink).toHaveAttribute("href", course.marketingUrl)
  })

  test("It shows course title as clickable text (not link) if titleAction is marketing and not enrolled (non-B2B)", async () => {
    setupUserApis()
    const course = dashboardCourse({
      marketingUrl: "?some-marketing-url",
      enrollment: {
        status: EnrollmentStatus.NotEnrolled,
      },
      run: {
        b2bContractId: null,
      },
    })
    renderWithProviders(
      <DashboardCard titleAction="marketing" dashboardResource={course} />,
    )

    const card = getCard()

    // Should not be a link
    expect(
      within(card).queryByRole("link", { name: course.title }),
    ).not.toBeInTheDocument()
    // Should be clickable text
    const titleText = within(card).getByText(course.title)
    expect(titleText).toBeInTheDocument()
  })

  test("It shows course title and links to courseware if titleAction is courseware and enrolled", async () => {
    setupUserApis()
    const course = dashboardCourse({
      enrollment: {
        status: EnrollmentStatus.Enrolled,
      },
    })
    renderWithProviders(
      <DashboardCard titleAction="courseware" dashboardResource={course} />,
    )

    const card = getCard()

    const courseLink = within(card).getByRole("link", {
      name: course.title,
    })
    expect(courseLink).toHaveAttribute("href", course.run.coursewareUrl)
  })

  test("It shows course title as clickable text (not link) if titleAction is courseware and not enrolled (non-B2B)", async () => {
    setupUserApis()
    const course = dashboardCourse({
      enrollment: {
        status: EnrollmentStatus.NotEnrolled,
      },
      run: {
        b2bContractId: null,
      },
    })
    renderWithProviders(
      <DashboardCard titleAction="courseware" dashboardResource={course} />,
    )

    const card = getCard()

    // Should not be a link
    expect(
      within(card).queryByRole("link", { name: course.title }),
    ).not.toBeInTheDocument()
    // Should be clickable text
    const titleText = within(card).getByText(course.title)
    expect(titleText).toBeInTheDocument()
  })

  test("It shows course title as link if not enrolled but has B2B contract", async () => {
    setupUserApis()
    const b2bContractId = faker.number.int()
    const course = dashboardCourse({
      enrollment: {
        status: EnrollmentStatus.NotEnrolled,
        b2b_contract_id: b2bContractId,
      },
      run: {
        b2bContractId: b2bContractId,
      },
    })
    renderWithProviders(
      <DashboardCard titleAction="courseware" dashboardResource={course} />,
    )

    const card = getCard()

    // Should be a link for B2B courses
    const courseLink = within(card).getByRole("link", {
      name: course.title,
    })
    expect(courseLink).toHaveAttribute("href", course.run.coursewareUrl)
  })

  test("Accepts a classname", () => {
    setupUserApis()
    const course = dashboardCourse()
    const TheComponent = faker.helpers.arrayElement([
      "li",
      "div",
      "span",
      "article",
    ])
    renderWithProviders(
      <DashboardCard
        titleAction="marketing"
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
      course: pastDashboardCourse({
        enrollment: {
          status: EnrollmentStatus.Enrolled,
          mode: EnrollmentMode.Audit,
        },
      }),
      expected: { enabled: true },
      case: "past",
    },
    {
      course: currentDashboardCourse({
        enrollment: {
          status: EnrollmentStatus.Enrolled,
          mode: EnrollmentMode.Audit,
        },
      }),
      expected: { enabled: true },
      case: "current",
    },
    {
      course: futureDashboardCourse({
        enrollment: {
          status: EnrollmentStatus.Enrolled,
          mode: EnrollmentMode.Audit,
        },
      }),
      expected: { enabled: false },
      case: "future",
    },
  ])(
    "Courseware CTA and is enabled/disabled (enabled=$expected.enabled) based on date (case: $case)",
    ({ course, expected }) => {
      setupUserApis()
      renderWithProviders(
        <DashboardCard titleAction="marketing" dashboardResource={course} />,
      )
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
      course: pastDashboardCourse({
        enrollment: { status: EnrollmentStatus.Enrolled },
      }),
      expected: { label: "View", usesCourseNoun: true },
      case: "past",
    },
    {
      course: currentDashboardCourse({
        enrollment: { status: EnrollmentStatus.Enrolled },
      }),
      expected: { label: "Continue", usesCourseNoun: false },
      case: "current",
    },
    {
      course: futureDashboardCourse({
        enrollment: { status: EnrollmentStatus.Enrolled },
      }),
      expected: { label: "Continue", usesCourseNoun: false },
      label: "future",
    },
  ])(
    "Courseware CTA shows correct label based on courseNoun prop and dates (case $case)",
    ({ course, expected }) => {
      setupUserApis()
      const { view } = renderWithProviders(
        <DashboardCard titleAction="marketing" dashboardResource={course} />,
      )
      const card = getCard()
      const coursewareCTA = within(card).getByTestId("courseware-button")

      if (
        course.enrollment?.status === EnrollmentStatus.NotEnrolled ||
        !course.enrollment
      ) {
        expect(coursewareCTA).toHaveTextContent("Start Course")
      } else if (expected.usesCourseNoun) {
        expect(coursewareCTA).toHaveTextContent(`${expected.label} Course`)
      } else {
        expect(coursewareCTA).toHaveTextContent(expected.label)
      }

      const courseNoun = faker.word.noun()
      view.rerender(
        <DashboardCard
          titleAction="marketing"
          noun={courseNoun}
          dashboardResource={course}
        />,
      )

      if (
        course.enrollment?.status === EnrollmentStatus.NotEnrolled ||
        !course.enrollment
      ) {
        expect(coursewareCTA).toHaveTextContent(`Start ${courseNoun}`)
      } else if (expected.usesCourseNoun) {
        expect(coursewareCTA).toHaveTextContent(
          `${expected.label} ${courseNoun}`,
        )
      } else {
        // "Continue" doesn't use noun
        expect(coursewareCTA).toHaveTextContent(expected.label)
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
      setupUserApis()
      const course = dashboardCourse(overrides)
      renderWithProviders(
        <DashboardCard titleAction="marketing" dashboardResource={course} />,
      )
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
      setupUserApis()
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
          titleAction="marketing"
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
    setupUserApis()
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

    renderWithProviders(
      <DashboardCard titleAction="marketing" dashboardResource={course} />,
    )
    const card = getCard()
    const upgradeRoot = within(card).getByTestId("upgrade-root")

    expect(upgradeRoot).toBeVisible()
    expect(upgradeRoot).toHaveTextContent(/5 days remaining/)
    expect(upgradeRoot).toHaveTextContent(
      `Add a certificate for $${certificateUpgradePrice}`,
    )
  })

  test("Shows number of days until course starts", () => {
    setupUserApis()
    const startDate = moment()
      .startOf("day")
      .add(5, "days")
      .add(3, "hours")
      .toISOString()
    const enrollment = dashboardCourse({ run: { startDate } })
    renderWithProviders(
      <DashboardCard titleAction="marketing" dashboardResource={enrollment} />,
    )
    const card = getCard()

    expect(card).toHaveTextContent(/starts in 5 days/i)
  })

  test.each([{ showNotComplete: true }, { showNotComplete: false }])(
    "Shows incomplete status when showNotComplete is true",
    ({ showNotComplete }) => {
      setupUserApis()
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
          titleAction="marketing"
          dashboardResource={course}
          showNotComplete={showNotComplete}
        />,
      )
      const card = getCard()

      const indicator = within(card).queryByTestId("enrollment-status")
      expect(!!indicator).toBe(showNotComplete)

      view.rerender(
        <DashboardCard
          titleAction="marketing"
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
      setupUserApis()
      renderWithProviders(
        <DashboardCard
          titleAction="marketing"
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
      setupUserApis()
      const course = dashboardCourse()
      course.enrollment = {
        id: faker.number.int(),
        status: EnrollmentStatus.Completed,
        mode: EnrollmentMode.Verified,
        grades: [],
        run: mitxonline.factories.courses.courseRun(),
      }
      renderWithProviders(
        <DashboardCard
          titleAction="marketing"
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
        ...getDefaultContextMenuItems("Test Course", course.enrollment!),
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
      setupUserApis()
      renderWithProviders(
        <DashboardCard
          titleAction="marketing"
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

  test.each([
    { status: EnrollmentStatus.Completed, expectedText: "View Course" },
    { status: EnrollmentStatus.Enrolled, expectedText: "Continue" },
    { status: EnrollmentStatus.NotEnrolled, expectedText: "Start Course" },
  ])(
    "CoursewareButton shows correct text based on enrollment status ($status)",
    ({ status, expectedText }) => {
      setupUserApis()
      const course = dashboardCourse()
      course.enrollment = {
        id: faker.number.int(),
        status: status,
        mode: EnrollmentMode.Audit,
        grades: [],
        run: mitxonline.factories.courses.courseRun(),
      }
      renderWithProviders(
        <DashboardCard titleAction="marketing" dashboardResource={course} />,
      )
      const card = getCard()
      const coursewareButton = within(card).getByTestId("courseware-button")

      expect(coursewareButton).toHaveTextContent(expectedText)
    },
  )

  test("CoursewareButton shows 'View Course' when course has ended even if not completed", () => {
    setupUserApis()
    const course = dashboardCourse({
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.past().toISOString(), // Course has ended
      },
      enrollment: {
        status: EnrollmentStatus.Enrolled, // User is enrolled but not completed
        mode: EnrollmentMode.Audit,
      },
    })
    renderWithProviders(
      <DashboardCard titleAction="marketing" dashboardResource={course} />,
    )
    const card = getCard()
    const coursewareButton = within(card).getByTestId("courseware-button")

    expect(coursewareButton).toHaveTextContent("View Course")
  })

  const setupEnrollmentApis = (opts: {
    user: ReturnType<typeof mitxUser>
    course: ReturnType<typeof dashboardCourse>
  }) => {
    setMockResponse.get(mitxonline.urls.userMe.get(), opts.user)

    const enrollmentUrl = mitxonline.urls.b2b.courseEnrollment(
      opts.course.coursewareId ?? undefined,
    )
    setMockResponse.post(enrollmentUrl, {
      result: "b2b-enroll-success",
      order: 1,
    })

    const countries = [
      { code: "US", name: "United States" },
      { code: "CA", name: "Canada" },
    ]
    if (opts.user.legal_address?.country) {
      countries.push({
        code: opts.user.legal_address.country,
        name: "User's Country",
      })
    }
    // Mock countries data needed by JustInTimeDialog
    setMockResponse.get(mitxonline.urls.countries.list(), countries)
    return { enrollmentUrl }
  }

  const ENROLLMENT_TRIGGERS = [
    { trigger: "button" as const },
    { trigger: "title-link" as const },
  ]
  test.each(ENROLLMENT_TRIGGERS)(
    "Enrollment for complete profile bypasses just-in-time dialog",
    async ({ trigger }) => {
      const userData = mitxUser()
      const b2bContractId = faker.number.int()
      const course = dashboardCourse({
        enrollment: {
          status: EnrollmentStatus.NotEnrolled,
          b2b_contract_id: b2bContractId,
        },
        run: {
          b2bContractId: b2bContractId,
        },
      })
      const { enrollmentUrl } = setupEnrollmentApis({ user: userData, course })
      renderWithProviders(
        <DashboardCard titleAction="courseware" dashboardResource={course} />,
      )
      const card = getCard()
      const triggerElement =
        trigger === "button"
          ? within(card).getByTestId("courseware-button")
          : within(card).getByRole("link", { name: course.title })

      await user.click(triggerElement)

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "POST", url: enrollmentUrl }),
      )
    },
  )

  test.each(
    cartesianProduct(ENROLLMENT_TRIGGERS, [
      { userData: mitxUser({ legal_address: { country: "" } }) },
      { userData: mitxUser({ user_profile: { year_of_birth: null } }) },
    ]),
  )(
    "Enrollment for complete profile bypasses just-in-time dialog",
    async ({ trigger, userData }) => {
      const b2bContractId = faker.number.int()
      const course = dashboardCourse({
        enrollment: {
          status: EnrollmentStatus.NotEnrolled,
          b2b_contract_id: b2bContractId,
        },
        run: {
          b2bContractId: b2bContractId,
        },
      })
      setupEnrollmentApis({ user: userData, course })
      renderWithProviders(
        <DashboardCard titleAction="courseware" dashboardResource={course} />,
      )
      const card = getCard()
      const triggerElement =
        trigger === "button"
          ? within(card).getByTestId("courseware-button")
          : within(card).getByRole("link", { name: course.title })

      await user.click(triggerElement)

      await screen.findByRole("dialog", { name: "Just a Few More Details" })
      expect(mockAxiosInstance.request).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "POST" }),
      )
    },
  )

  describe("Stacked Variant", () => {
    test("applies stacked variant styling", () => {
      setupUserApis()
      const course = dashboardCourse()
      renderWithProviders(
        <DashboardCard
          variant="stacked"
          titleAction="marketing"
          dashboardResource={course}
        />,
      )

      const card = getCard()
      expect(card).toBeInTheDocument()
      // Successfully renders a stacked card - the variant prop controls styling via styled-components
    })

    test("renders multiple stacked cards correctly", () => {
      setupUserApis()
      const courses = [
        dashboardCourse({ title: "First Stacked Course" }),
        dashboardCourse({ title: "Second Stacked Course" }),
        dashboardCourse({ title: "Third Stacked Course" }),
      ]

      renderWithProviders(
        <div>
          {courses.map((course) => (
            <DashboardCard
              key={course.key}
              variant="stacked"
              titleAction="marketing"
              dashboardResource={course}
            />
          ))}
        </div>,
      )

      const allCards = screen.getAllByTestId(testId)
      expect(allCards).toHaveLength(3)
      expect(
        within(allCards[0]).getByText("First Stacked Course"),
      ).toBeInTheDocument()
      expect(
        within(allCards[1]).getByText("Second Stacked Course"),
      ).toBeInTheDocument()
      expect(
        within(allCards[2]).getByText("Third Stacked Course"),
      ).toBeInTheDocument()
    })
  })

  describe("Program Cards", () => {
    test("renders program card with title", () => {
      setupUserApis()
      const program = dashboardProgram({
        title: "Test Program Title",
      })

      renderWithProviders(
        <DashboardCard titleAction="marketing" dashboardResource={program} />,
      )

      const card = getCard()
      expect(within(card).getByText("Test Program Title")).toBeInTheDocument()
    })

    test("program card does not show course-specific elements", () => {
      setupUserApis()
      const program = dashboardProgram({
        title: "Test Program",
      })

      renderWithProviders(
        <DashboardCard titleAction="marketing" dashboardResource={program} />,
      )

      const card = getCard()
      // Programs don't show enrollment status or courseware buttons
      expect(
        within(card).queryByTestId("courseware-button"),
      ).not.toBeInTheDocument()
      expect(within(card).queryByTestId("upgrade-root")).not.toBeInTheDocument()
    })
  })
})

import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
  waitFor,
  within,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { mockAxiosInstance } from "api/test-utils"
import {
  DashboardCard,
  DashboardType,
  getContextMenuItems,
} from "./DashboardCard"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { cartesianProduct } from "ol-test-utilities"
import { useFeatureFlagEnabled } from "posthog-js/react"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const EnrollmentMode = {
  Audit: "audit",
  Verified: "verified",
} as const
type EnrollmentMode = (typeof EnrollmentMode)[keyof typeof EnrollmentMode]

const mitxOnlineCourse = mitxonline.factories.courses.course

const pastDashboardCourse: typeof mitxOnlineCourse = (...overrides) => {
  const run = mitxonline.factories.courses.courseRun({
    start_date: moment().subtract(90, "days").toISOString(), // Started 90 days ago
    end_date: moment().subtract(30, "days").toISOString(), // Ended 30 days ago
  })
  return mitxOnlineCourse(
    {
      courseruns: [run],
      next_run_id: run.id, // Ensure getBestRun uses this run
    },
    ...overrides,
  )
}
const currentDashboardCourse: typeof mitxOnlineCourse = (...overrides) => {
  const run = mitxonline.factories.courses.courseRun({
    start_date: moment().subtract(30, "days").toISOString(), // Started 30 days ago
    end_date: moment().add(30, "days").toISOString(), // Ends 30 days from now
  })
  return mitxOnlineCourse(
    {
      courseruns: [run],
      next_run_id: run.id, // Ensure getBestRun uses this run
    },
    ...overrides,
  )
}
const futureDashboardCourse: typeof mitxOnlineCourse = (...overrides) => {
  const run = mitxonline.factories.courses.courseRun({
    start_date: moment().add(30, "days").toISOString(), // Starts 30 days from now
    end_date: moment().add(90, "days").toISOString(), // Ends 90 days from now
  })
  return mitxOnlineCourse(
    {
      courseruns: [run],
      next_run_id: run.id, // Ensure getBestRun uses this run
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

  beforeEach(() => {
    // Default to feature flag disabled unless explicitly set in a test
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
  })

  test("It shows course title and links to courseware when enrolled", async () => {
    setupUserApis()
    const coursewareUrl = faker.internet.url()
    const courseRun = mitxonline.factories.courses.courseRun({
      courseware_url: coursewareUrl,
    })
    const course = mitxOnlineCourse({
      courseruns: [courseRun],
      next_run_id: null, // Ensure getBestRun uses the single run
    })
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      grades: [], // No passing grade = enrolled but not completed
      run: {
        ...courseRun,
        course: course,
      },
    })
    renderWithProviders(
      <DashboardCard
        resource={{ type: DashboardType.CourseRunEnrollment, data: enrollment }}
      />,
    )

    const card = getCard()

    const courseLink = within(card).getByRole("link", {
      name: course.title,
    })
    expect(courseLink).toHaveAttribute("href", coursewareUrl)
  })

  test("It shows course title as clickable text (not link) when not enrolled (non-B2B)", async () => {
    setupUserApis()
    const course = mitxOnlineCourse({
      courseruns: [
        mitxonline.factories.courses.courseRun({
          b2b_contract: null,
        }),
      ],
    })
    // No enrollment = not enrolled
    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
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

  test("It shows course title as clickable text if not enrolled but has B2B contract", async () => {
    setupUserApis()
    const b2bContractId = faker.number.int()
    const coursewareUrl = faker.internet.url()
    const course = mitxOnlineCourse({
      courseruns: [
        mitxonline.factories.courses.courseRun({
          b2b_contract: b2bContractId,
          courseware_url: coursewareUrl,
          is_enrollable: true,
        }),
      ],
      next_run_id: null, // Ensure getBestRun uses the single run
    })
    // No enrollment passed, B2B contract requires enrollment first
    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )

    const card = getCard()

    // Should be clickable text, not a link (enrollment happens on click)
    expect(
      within(card).queryByRole("link", { name: course.title }),
    ).not.toBeInTheDocument()
    const titleText = within(card).getByText(course.title)
    expect(titleText).toBeInTheDocument()
  })

  test("Accepts a classname", () => {
    setupUserApis()
    const course = mitxOnlineCourse()
    const TheComponent = faker.helpers.arrayElement([
      "li",
      "div",
      "span",
      "article",
    ])
    renderWithProviders(
      <DashboardCard
        Component={TheComponent}
        resource={{ type: DashboardType.Course, data: course }}
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
      case: "future",
    },
  ])(
    "Courseware CTA and is enabled/disabled (enabled=$expected.enabled) based on date (case: $case)",
    ({ course, expected }) => {
      setupUserApis()
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        enrollment_mode: EnrollmentMode.Audit,
        grades: [], // Enrolled but not completed
        run: {
          ...course.courseruns[0],
          course: course,
        },
      })
      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.CourseRunEnrollment,
            data: enrollment,
          }}
        />,
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

  test("Courseware CTA is disabled when no enrollable runs exist", () => {
    setupUserApis()
    const course = mitxOnlineCourse({
      courseruns: [
        mitxonline.factories.courses.courseRun({
          is_enrollable: false,
        }),
      ],
    })

    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )

    const card = getCard()
    const coursewareCTA = within(card).getByTestId("courseware-button")

    expect(coursewareCTA).toBeDisabled()
  })

  test.each([
    {
      createCourse: pastDashboardCourse,
      enrollmentData: { grades: [] },
      expected: { label: "View", usesCourseNoun: true },
      case: "past",
    },
    {
      createCourse: currentDashboardCourse,
      enrollmentData: { grades: [] },
      expected: { label: "Continue", usesCourseNoun: false },
      case: "current",
    },
    {
      createCourse: futureDashboardCourse,
      enrollmentData: { grades: [] },
      expected: { label: "Continue", usesCourseNoun: false },
      case: "future",
    },
  ])(
    "Courseware CTA shows correct label based on courseNoun prop and dates (case $case)",
    ({ createCourse, enrollmentData, expected }) => {
      setupUserApis()
      const course = createCourse()
      const run = course.courseruns[0]
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        grades: enrollmentData.grades,
        run: { ...run, course: course }, // Include course in run
        certificate: null, // Explicitly no certificate for enrolled-but-not-completed state
      })
      const { view } = renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.CourseRunEnrollment,
            data: enrollment,
          }}
        />,
      )
      const card = getCard()
      const coursewareCTA = within(card).getByTestId("courseware-button")

      if (expected.usesCourseNoun) {
        expect(coursewareCTA).toHaveTextContent(`${expected.label} Course`)
      } else {
        expect(coursewareCTA).toHaveTextContent(expected.label)
      }

      const courseNoun = faker.word.noun()
      view.rerender(
        <DashboardCard
          noun={courseNoun}
          resource={{
            type: DashboardType.CourseRunEnrollment,
            data: enrollment,
          }}
        />,
      )

      if (expected.usesCourseNoun) {
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
      enrollment: mitxonline.factories.enrollment.courseEnrollment({
        enrollment_mode: EnrollmentMode.Audit,
        run: {
          is_upgradable: true,
          upgrade_deadline: faker.date.future().toISOString(),
          upgrade_product_id: faker.number.int(),
          upgrade_product_price: faker.commerce.price(),
          upgrade_product_is_active: true,
        },
      }),
      expectation: { visible: true },
    },
    {
      enrollment: mitxonline.factories.enrollment.courseEnrollment({
        enrollment_mode: EnrollmentMode.Verified,
        run: {
          is_upgradable: true,
          upgrade_deadline: faker.date.future().toISOString(),
          upgrade_product_id: faker.number.int(),
          upgrade_product_price: faker.commerce.price(),
          upgrade_product_is_active: true,
        },
      }),
      expectation: { visible: false },
    },
    {
      enrollment: mitxonline.factories.enrollment.courseEnrollment({
        enrollment_mode: EnrollmentMode.Audit,
        run: {
          is_upgradable: false,
          upgrade_deadline: faker.date.future().toISOString(),
          upgrade_product_id: faker.number.int(),
          upgrade_product_price: faker.commerce.price(),
          upgrade_product_is_active: true,
        },
      }),
      expectation: { visible: false },
    },
    {
      enrollment: mitxonline.factories.enrollment.courseEnrollment({
        enrollment_mode: EnrollmentMode.Audit,
        run: {
          is_upgradable: true,
          upgrade_deadline: faker.date.future().toISOString(),
          upgrade_product_id: faker.number.int(),
          upgrade_product_price: faker.commerce.price(),
          upgrade_product_is_active: false,
        },
      }),
      expectation: { visible: false },
    },
  ])(
    "Shows upgrade banner based on enrollment run upgradeability and active upgrade product",
    ({ enrollment, expectation }) => {
      setupUserApis()
      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.CourseRunEnrollment,
            data: enrollment,
          }}
        />,
      )
      const card = getCard()
      const upgradeRoot = within(card).queryByTestId("upgrade-root")

      expect(!!upgradeRoot).toBe(expectation.visible)
    },
  )

  test("Does not show upgrade banner when upgrade product active flag is missing", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
    })
    const enrollmentWithMissingActiveFlag = {
      ...enrollment,
      run: {
        ...enrollment.run,
        upgrade_product_is_active: undefined,
      },
    } as unknown as typeof enrollment

    renderWithProviders(
      <DashboardCard
        resource={{
          type: DashboardType.CourseRunEnrollment,
          data: enrollmentWithMissingActiveFlag,
        }}
      />,
    )

    const card = getCard()
    expect(within(card).queryByTestId("upgrade-root")).toBeNull()
  })

  test.each([
    { offerUpgrade: true, expected: { visible: true } },
    { offerUpgrade: false, expected: { visible: false } },
  ])(
    "Never shows upgrade banner if `offerUpgrade` is false",
    ({ offerUpgrade, expected }) => {
      setupUserApis()
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        enrollment_mode: EnrollmentMode.Audit,
        run: {
          is_upgradable: true,
          upgrade_deadline: faker.date.future().toISOString(),
          upgrade_product_id: faker.number.int(),
          upgrade_product_price: faker.commerce.price(),
          upgrade_product_is_active: true,
        },
      })

      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.CourseRunEnrollment,
            data: enrollment,
          }}
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

    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      run: {
        is_upgradable: true,
        upgrade_deadline: certificateUpgradeDeadline,
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: certificateUpgradePrice,
        upgrade_product_is_active: true,
      },
    })

    renderWithProviders(
      <DashboardCard
        resource={{ type: DashboardType.CourseRunEnrollment, data: enrollment }}
      />,
    )
    const card = getCard()
    const upgradeRoot = within(card).getByTestId("upgrade-root")

    expect(upgradeRoot).toBeVisible()
    expect(upgradeRoot).toHaveTextContent(/5 days remaining/)
    expect(upgradeRoot).toHaveTextContent(
      `Add a certificate for $${certificateUpgradePrice}`,
    )
  })

  test("Upgrade banner shows price without deadline when deadline is null", () => {
    setupUserApis()
    const certificateUpgradePrice = faker.commerce.price()

    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      run: {
        is_upgradable: true,
        upgrade_deadline: null,
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: certificateUpgradePrice,
        upgrade_product_is_active: true,
      },
    })

    renderWithProviders(
      <DashboardCard
        resource={{ type: DashboardType.CourseRunEnrollment, data: enrollment }}
      />,
    )
    const card = getCard()
    const upgradeRoot = within(card).getByTestId("upgrade-root")

    expect(upgradeRoot).toBeVisible()
    expect(upgradeRoot).toHaveTextContent(
      `Add a certificate for $${certificateUpgradePrice}`,
    )
    // Should not show deadline countdown
    expect(upgradeRoot).not.toHaveTextContent(/days? remaining/)
  })

  test("Clicking upgrade link adds product to basket and redirects to cart", async () => {
    const assign = jest.mocked(window.location.assign)
    setupUserApis()

    const productId = faker.number.int()
    const certificateUpgradePrice = faker.commerce.price()
    const certificateUpgradeDeadline = faker.date.future().toISOString()

    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      run: {
        is_upgradable: true,
        upgrade_deadline: certificateUpgradeDeadline,
        upgrade_product_id: productId,
        upgrade_product_price: certificateUpgradePrice,
        upgrade_product_is_active: true,
      },
    })

    // Mock basket APIs
    const clearUrl = mitxonline.urls.baskets.clear()
    setMockResponse.delete(clearUrl, undefined)

    const basketUrl = mitxonline.urls.baskets.createFromProduct(productId)
    setMockResponse.post(basketUrl, { id: 1, items: [] })

    renderWithProviders(
      <DashboardCard
        resource={{ type: DashboardType.CourseRunEnrollment, data: enrollment }}
      />,
    )

    const card = getCard()
    const upgradeLink = within(card).getByRole("link", {
      name: /Add a certificate/,
    })
    await user.click(upgradeLink)

    // Verify clear basket API was called first
    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: clearUrl,
      }),
    )

    // Verify create basket API was called
    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: basketUrl,
      }),
    )

    // Verify redirect to cart page
    expect(assign).toHaveBeenCalledWith(mitxonlineLegacyUrl("/cart/"))
  })

  test("Calls error callback when basket API fails", async () => {
    setupUserApis()

    const productId = faker.number.int()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: productId,
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
    })

    // Mock basket APIs - clear succeeds but create fails
    const clearUrl = mitxonline.urls.baskets.clear()
    setMockResponse.delete(clearUrl, undefined)

    const basketUrl = mitxonline.urls.baskets.createFromProduct(productId)
    setMockResponse.post(basketUrl, { error: "Server error" }, { code: 500 })

    const onUpgradeError = jest.fn()

    renderWithProviders(
      <DashboardCard
        resource={{ type: DashboardType.CourseRunEnrollment, data: enrollment }}
        onUpgradeError={onUpgradeError}
      />,
    )

    const card = getCard()
    const upgradeLink = within(card).getByRole("link", {
      name: /Add a certificate/,
    })
    await user.click(upgradeLink)

    // Should call error callback with message
    await waitFor(() => {
      expect(onUpgradeError).toHaveBeenCalledWith(
        "There was a problem adding the certificate to your cart.",
      )
    })
  })

  test("Error callback is called when upgrade fails", async () => {
    setupUserApis()

    const productId = faker.number.int()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: productId,
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
    })

    // Mock basket APIs - clear succeeds but create fails
    const clearUrl = mitxonline.urls.baskets.clear()
    setMockResponse.delete(clearUrl, undefined)

    const basketUrl = mitxonline.urls.baskets.createFromProduct(productId)
    setMockResponse.post(basketUrl, { error: "Server error" }, { code: 500 })

    const onUpgradeError = jest.fn()

    renderWithProviders(
      <DashboardCard
        resource={{ type: DashboardType.CourseRunEnrollment, data: enrollment }}
        onUpgradeError={onUpgradeError}
      />,
    )

    const card = getCard()
    const upgradeLink = within(card).getByRole("link", {
      name: /Add a certificate/,
    })

    // Click upgrade - should call error callback
    await user.click(upgradeLink)

    await waitFor(() => {
      expect(onUpgradeError).toHaveBeenCalledWith(
        "There was a problem adding the certificate to your cart.",
      )
    })

    // Reset the mock
    onUpgradeError.mockClear()

    // Re-setup mocks for second attempt
    setMockResponse.delete(clearUrl, undefined)
    setMockResponse.post(basketUrl, { error: "Server error" }, { code: 500 })

    // Second attempt - error callback should be called again
    await user.click(upgradeLink)

    await waitFor(() => {
      expect(onUpgradeError).toHaveBeenCalledWith(
        "There was a problem adding the certificate to your cart.",
      )
    })
  })

  test("Shows number of days until course starts", () => {
    setupUserApis()
    const startDate = moment()
      .startOf("day")
      .add(5, "days")
      .add(3, "hours")
      .toISOString()
    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
      start_date: startDate,
      live: true,
    })
    const course = mitxOnlineCourse({
      courseruns: [run],
      next_run_id: run.id, // Ensure getBestRun uses this run
    })
    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )
    const card = getCard()

    expect(card).toHaveTextContent(/starts in 5 days/i)
  })

  test.each([{ showNotComplete: true }, { showNotComplete: false }])(
    "Shows incomplete status when showNotComplete is true",
    ({ showNotComplete }) => {
      setupUserApis()
      // Test with no enrollment, and with enrolled (no passing grade)
      const run = mitxonline.factories.courses.courseRun()
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id,
      })
      const enrollmentOrNull = faker.helpers.arrayElement([
        null,
        mitxonline.factories.enrollment.courseEnrollment({
          grades: [],
          run: { ...run, course },
          certificate: null, // Explicitly no certificate for enrolled-but-not-completed state
        }),
      ])
      const { view } = renderWithProviders(
        <DashboardCard
          resource={
            enrollmentOrNull
              ? {
                  type: DashboardType.CourseRunEnrollment,
                  data: enrollmentOrNull,
                }
              : { type: DashboardType.Course, data: course }
          }
          showNotComplete={showNotComplete}
        />,
      )
      const card = getCard()

      const indicator = within(card).queryByTestId("enrollment-status")
      expect(!!indicator).toBe(showNotComplete)

      // Now test with completed enrollment
      const completedEnrollment =
        mitxonline.factories.enrollment.courseEnrollment({
          grades: [mitxonline.factories.enrollment.grade({ passed: true })],
          run: { ...run, course },
        })
      view.rerender(
        <DashboardCard
          resource={{
            type: DashboardType.CourseRunEnrollment,
            data: completedEnrollment,
          }}
          showNotComplete={showNotComplete}
        />,
      )
      // Completed should always show the indicator
      within(card).getByTestId("enrollment-status")
    },
  )

  test.each([
    {
      enrollmentData: null,
      expectedLabel: "Not Enrolled",
      hiddenImage: true,
    },
    {
      enrollmentData: { grades: [] },
      expectedLabel: "Enrolled",
      hiddenImage: true,
    },
    {
      enrollmentData: {
        grades: [mitxonline.factories.enrollment.grade({ passed: true })],
      },
      expectedLabel: "Completed",
      hiddenImage: true,
    },
  ])(
    "Enrollment indicator shows meaningful text",
    ({ enrollmentData, expectedLabel, hiddenImage }) => {
      setupUserApis()
      const run = mitxonline.factories.courses.courseRun()
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id, // Ensure getBestRun uses this run
      })
      const enrollment = enrollmentData
        ? mitxonline.factories.enrollment.courseEnrollment({
            grades: enrollmentData.grades,
            run: { ...run, course }, // Include course in run
            certificate: null, // Explicitly no certificate for enrolled-but-not-completed state
          })
        : null
      renderWithProviders(
        <DashboardCard
          resource={
            enrollment
              ? {
                  type: DashboardType.CourseRunEnrollment,
                  data: enrollment,
                }
              : { type: DashboardType.Course, data: course }
          }
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
      const course = mitxOnlineCourse()
      const run = course.courseruns[0]
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        grades: [mitxonline.factories.enrollment.grade({ passed: true })],
        enrollment_mode: EnrollmentMode.Verified,
        run: { ...run, course },
      })
      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.CourseRunEnrollment,
            data: enrollment,
          }}
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
        ...getContextMenuItems(
          "Test Course",
          {
            type: DashboardType.CourseRunEnrollment,
            data: enrollment,
          },
          false, // useProductPages
        ),
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
    {
      enrollment: null,
      expectedVisible: false,
    },
    {
      enrollment: mitxonline.factories.enrollment.courseEnrollment({
        grades: [],
      }),
      expectedVisible: true,
    },
    {
      enrollment: mitxonline.factories.enrollment.courseEnrollment({
        grades: [mitxonline.factories.enrollment.grade({ passed: true })],
      }),
      expectedVisible: true,
    },
  ])(
    "Context menu button is not shown when enrollment status is not Completed or Enrolled",
    ({ enrollment, expectedVisible }) => {
      setupUserApis()
      const course = mitxOnlineCourse()
      renderWithProviders(
        <DashboardCard
          resource={
            enrollment
              ? {
                  type: DashboardType.CourseRunEnrollment,
                  data: enrollment,
                }
              : { type: DashboardType.Course, data: course }
          }
        />,
      )
      const card = getCard()
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
    {
      enrollmentData: {
        grades: [mitxonline.factories.enrollment.grade({ passed: true })],
      },
      expectedText: "View Course",
    },
    {
      enrollmentData: { grades: [] },
      expectedText: "Continue",
    },
    {
      enrollmentData: null,
      expectedText: "Start Course",
    },
  ])(
    "CoursewareButton shows correct text based on enrollment status",
    ({ enrollmentData, expectedText }) => {
      setupUserApis()
      const run = mitxonline.factories.courses.courseRun({
        start_date: moment().subtract(30, "days").toISOString(),
        end_date: moment().add(30, "days").toISOString(),
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id, // Ensure getBestRun uses this run
      })
      const enrollment = enrollmentData
        ? mitxonline.factories.enrollment.courseEnrollment({
            grades: enrollmentData.grades,
            run: { ...run, course }, // Include course in run
            certificate: null, // Explicitly no certificate for enrolled-but-not-completed state
          })
        : null
      renderWithProviders(
        <DashboardCard
          resource={
            enrollment
              ? {
                  type: DashboardType.CourseRunEnrollment,
                  data: enrollment,
                }
              : { type: DashboardType.Course, data: course }
          }
        />,
      )
      const card = getCard()
      const coursewareButton = within(card).getByTestId("courseware-button")

      expect(coursewareButton).toHaveTextContent(expectedText)
    },
  )

  test("CoursewareButton shows 'View Course' when course has ended even if not completed", () => {
    setupUserApis()
    const run = mitxonline.factories.courses.courseRun({
      start_date: faker.date.past().toISOString(),
      end_date: faker.date.past().toISOString(), // Course has ended
    })
    const course = mitxOnlineCourse({
      courseruns: [run],
      next_run_id: run.id, // Ensure getBestRun uses this run
    })
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      grades: [], // User is enrolled but not completed
      run: { ...run, course },
    })
    renderWithProviders(
      <DashboardCard
        resource={{ type: DashboardType.CourseRunEnrollment, data: enrollment }}
      />,
    )
    const card = getCard()
    const coursewareButton = within(card).getByTestId("courseware-button")

    expect(coursewareButton).toHaveTextContent("View Course")
  })

  const setupEnrollmentApis = (opts: {
    user: ReturnType<typeof mitxUser>
    course: ReturnType<typeof mitxOnlineCourse>
    run?: ReturnType<typeof mitxonline.factories.courses.courseRun>
  }) => {
    setMockResponse.get(mitxonline.urls.userMe.get(), opts.user)

    // Use run's courseware_id if provided, otherwise fall back to course's readable_id
    const runId =
      opts.run?.courseware_id ?? opts.course.readable_id ?? undefined
    const enrollmentUrl = mitxonline.urls.b2b.courseEnrollment(runId)
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
      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: b2bContractId,
        is_enrollable: true,
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id, // Ensure getBestRun uses this run
      })
      // No enrollment = not enrolled, but has B2B contract
      const { enrollmentUrl } = setupEnrollmentApis({
        user: userData,
        course,
        run,
      })
      renderWithProviders(
        <DashboardCard
          resource={{ type: DashboardType.Course, data: course }}
          contractId={b2bContractId}
        />,
      )
      const card = getCard()
      const triggerElement =
        trigger === "button"
          ? within(card).getByTestId("courseware-button")
          : within(card).getByText(course.title)

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
      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: b2bContractId,
        is_enrollable: true,
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id, // Ensure getBestRun uses this run
      })
      // No enrollment = not enrolled, but has B2B contract
      setupEnrollmentApis({ user: userData, course, run })
      renderWithProviders(
        <DashboardCard
          resource={{ type: DashboardType.Course, data: course }}
          contractId={b2bContractId}
        />,
      )
      const card = getCard()
      const triggerElement =
        trigger === "button"
          ? within(card).getByTestId("courseware-button")
          : within(card).getByText(course.title)

      await user.click(triggerElement)

      await screen.findByRole("dialog", { name: "Just a Few More Details" })
      expect(mockAxiosInstance.request).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "POST" }),
      )
    },
  )

  describe("B2C (non-B2B) Enrollment", () => {
    test.each(ENROLLMENT_TRIGGERS)(
      "Clicking $trigger on non-B2B course opens CourseEnrollmentDialog for both-mode enrollment",
      async ({ trigger }) => {
        const userData = mitxUser()
        setMockResponse.get(mitxonline.urls.userMe.get(), userData)

        const run = mitxonline.factories.courses.courseRun({
          b2b_contract: null, // Non-B2B course
          is_enrollable: true,
          enrollment_modes: [
            mitxonline.factories.courses.enrollmentMode({
              requires_payment: false,
            }),
            mitxonline.factories.courses.enrollmentMode({
              requires_payment: true,
            }),
          ],
        })
        const course = mitxOnlineCourse({
          courseruns: [run],
          next_run_id: run.id,
        })

        renderWithProviders(
          <DashboardCard
            resource={{ type: DashboardType.Course, data: course }}
          />,
        )

        const card = getCard()
        const triggerElement =
          trigger === "button"
            ? within(card).getByTestId("courseware-button")
            : within(card).getByText(course.title)

        await user.click(triggerElement)

        // Should open the CourseEnrollmentDialog, not JustInTimeDialog
        await screen.findByRole("dialog", { name: course.title })
        expect(
          screen.queryByRole("dialog", { name: "Just a Few More Details" }),
        ).not.toBeInTheDocument()
      },
    )

    test.each(ENROLLMENT_TRIGGERS)(
      "Clicking $trigger on non-B2B course bypasses dialog for free-only single-run enrollment",
      async ({ trigger }) => {
        const userData = mitxUser()
        setMockResponse.get(mitxonline.urls.userMe.get(), userData)

        const run = mitxonline.factories.courses.courseRun({
          b2b_contract: null,
          is_enrollable: true,
          enrollment_modes: [
            mitxonline.factories.courses.enrollmentMode({
              requires_payment: false,
            }),
          ],
        })
        const course = mitxOnlineCourse({
          courseruns: [run],
          next_run_id: run.id,
        })

        const enrollmentUrl = mitxonline.urls.enrollment.enrollmentsListV1()
        setMockResponse.post(enrollmentUrl, {})

        renderWithProviders(
          <DashboardCard
            resource={{ type: DashboardType.Course, data: course }}
          />,
        )

        const card = getCard()
        const triggerElement =
          trigger === "button"
            ? within(card).getByTestId("courseware-button")
            : within(card).getByText(course.title)

        await user.click(triggerElement)

        await waitFor(() => {
          expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({ method: "POST", url: enrollmentUrl }),
          )
        })

        expect(
          screen.queryByRole("dialog", { name: course.title }),
        ).not.toBeInTheDocument()
      },
    )
  })

  describe("Verified Program Enrollment", () => {
    test.each(ENROLLMENT_TRIGGERS)(
      "Clicking $trigger on course in verified program does one-click enrollment",
      async ({ trigger }) => {
        const userData = mitxUser()
        setMockResponse.get(mitxonline.urls.userMe.get(), userData)

        const run = mitxonline.factories.courses.courseRun({
          b2b_contract: null,
          is_enrollable: true,
          courseware_url: faker.internet.url(),
        })
        const course = mitxOnlineCourse({
          courseruns: [run],
          next_run_id: run.id,
        })

        const programEnrollment =
          mitxonline.factories.enrollment.programEnrollmentV3({
            enrollment_mode: "verified",
          })

        // Mock the enrollment endpoint
        const programEnrollmentEndpoint =
          mitxonline.urls.verifiedProgramEnrollments.create(run.courseware_id)
        setMockResponse.post(programEnrollmentEndpoint, {})

        renderWithProviders(
          <DashboardCard
            resource={{ type: DashboardType.Course, data: course }}
            programEnrollment={programEnrollment}
          />,
        )

        const card = getCard()
        const triggerElement =
          trigger === "button"
            ? within(card).getByTestId("courseware-button")
            : within(card).getByText(course.title)

        await user.click(triggerElement)

        // Should call enrollment endpoint
        await waitFor(() => {
          expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
              method: "POST",
              url: programEnrollmentEndpoint,
            }),
          )
        })

        expect(
          screen.queryByRole("dialog", { name: course.title }),
        ).not.toBeInTheDocument()
        expect(
          screen.queryByRole("dialog", { name: "Just a Few More Details" }),
        ).not.toBeInTheDocument()
      },
    )

    test("Audit program enrollment opens CourseEnrollmentDialog when both enrollment modes are available", async () => {
      const userData = mitxUser()
      setMockResponse.get(mitxonline.urls.userMe.get(), userData)

      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: null,
        is_enrollable: true,
        enrollment_modes: [
          mitxonline.factories.courses.enrollmentMode({
            requires_payment: false,
          }),
          mitxonline.factories.courses.enrollmentMode({
            requires_payment: true,
          }),
        ],
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id,
      })

      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          enrollment_mode: "audit", // Audit, not verified
        })

      renderWithProviders(
        <DashboardCard
          resource={{ type: DashboardType.Course, data: course }}
          programEnrollment={programEnrollment}
        />,
      )

      const card = getCard()
      const button = within(card).getByTestId("courseware-button")

      await user.click(button)

      // Should open the CourseEnrollmentDialog for audit enrollments
      await screen.findByRole("dialog", { name: course.title })
    })

    test("Audit program enrollment bypasses dialog for free-only single-run enrollment", async () => {
      const userData = mitxUser()
      setMockResponse.get(mitxonline.urls.userMe.get(), userData)

      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: null,
        is_enrollable: true,
        enrollment_modes: [
          mitxonline.factories.courses.enrollmentMode({
            requires_payment: false,
          }),
        ],
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id,
      })

      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          enrollment_mode: "audit",
        })

      const enrollmentUrl = mitxonline.urls.enrollment.enrollmentsListV1()
      setMockResponse.post(enrollmentUrl, {})

      renderWithProviders(
        <DashboardCard
          resource={{ type: DashboardType.Course, data: course }}
          programEnrollment={programEnrollment}
        />,
      )

      const card = getCard()
      const button = within(card).getByTestId("courseware-button")

      await user.click(button)

      await waitFor(() => {
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({ method: "POST", url: enrollmentUrl }),
        )
      })

      expect(
        screen.queryByRole("dialog", { name: course.title }),
      ).not.toBeInTheDocument()
    })
  })

  describe("CourseEnrollmentDialog", () => {
    test("shows course runs as options in dialog", async () => {
      const userData = mitxUser()
      setMockResponse.get(mitxonline.urls.userMe.get(), userData)

      const run1 = mitxonline.factories.courses.courseRun({
        b2b_contract: null,
        is_enrollable: true,
        title: "Fall 2025",
      })
      const run2 = mitxonline.factories.courses.courseRun({
        b2b_contract: null,
        is_enrollable: true,
        title: "Spring 2026",
      })
      const course = mitxOnlineCourse({
        title: "Test Course Title",
        courseruns: [run1, run2],
        next_run_id: run1.id,
      })

      renderWithProviders(
        <DashboardCard
          resource={{ type: DashboardType.Course, data: course }}
        />,
      )

      const card = getCard()
      const startButton = within(card).getByTestId("courseware-button")
      await user.click(startButton)

      const dialog = await screen.findByRole("dialog", {
        name: "Test Course Title",
      })

      // Dialog should show course runs as options
      expect(within(dialog).getByText("Choose a date:")).toBeInTheDocument()
    })
  })

  describe("Stacked Variant", () => {
    test("applies stacked variant styling", () => {
      setupUserApis()
      const course = mitxOnlineCourse()
      renderWithProviders(
        <DashboardCard
          variant="stacked"
          resource={{ type: DashboardType.Course, data: course }}
        />,
      )

      const card = getCard()
      expect(card).toBeInTheDocument()
      // Successfully renders a stacked card - the variant prop controls styling via styled-components
    })

    test("renders multiple stacked cards correctly", () => {
      setupUserApis()
      const run1 = mitxonline.factories.courses.courseRun()
      const run2 = mitxonline.factories.courses.courseRun()
      const run3 = mitxonline.factories.courses.courseRun()
      const courses = [
        mitxOnlineCourse({
          title: "First Stacked Course",
          courseruns: [run1],
          next_run_id: run1.id,
        }),
        mitxOnlineCourse({
          title: "Second Stacked Course",
          courseruns: [run2],
          next_run_id: run2.id,
        }),
        mitxOnlineCourse({
          title: "Third Stacked Course",
          courseruns: [run3],
          next_run_id: run3.id,
        }),
      ]

      renderWithProviders(
        <div>
          {courses.map((course, idx) => (
            <DashboardCard
              key={`course-${idx}`}
              variant="stacked"
              resource={{ type: DashboardType.Course, data: course }}
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
      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          program: mitxonline.factories.programs.simpleProgram({
            title: "Test Program Title",
          }),
        })

      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.ProgramEnrollment,
            data: programEnrollment,
          }}
        />,
      )

      const card = getCard()
      expect(within(card).getByText("Test Program Title")).toBeInTheDocument()
    })

    test("program card title links to program dashboard", () => {
      setupUserApis()
      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          program: mitxonline.factories.programs.simpleProgram({
            title: "Test Program Title",
            id: 123,
          }),
        })

      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.ProgramEnrollment,
            data: programEnrollment,
          }}
        />,
      )

      const card = getCard()
      const titleLink = within(card).getByRole("link", {
        name: "Test Program Title",
      })
      expect(titleLink).toHaveAttribute("href", "/dashboard/program/123")
    })

    test("program card does not show course-specific elements", () => {
      setupUserApis()
      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          program: mitxonline.factories.programs.simpleProgram({
            title: "Test Program",
          }),
        })

      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.ProgramEnrollment,
            data: programEnrollment,
          }}
        />,
      )

      const card = getCard()
      // Programs don't show enrollment status or courseware buttons
      expect(
        within(card).queryByTestId("courseware-button"),
      ).not.toBeInTheDocument()
      expect(within(card).queryByTestId("upgrade-root")).not.toBeInTheDocument()
    })

    test.each([
      {
        useProductPages: false,
        description:
          "uses constructed legacy URL when feature flag is disabled",
        getExpectedHref: (readableId: string) =>
          mitxonlineLegacyUrl(`/courses/${readableId}`),
      },
      {
        useProductPages: true,
        description: "uses product page URLs when feature flag is enabled",
        getExpectedHref: (readableId: string) => `/courses/${readableId}`,
      },
    ])(
      "Context menu for course enrollment $description",
      async ({ useProductPages, getExpectedHref }) => {
        mockedUseFeatureFlagEnabled.mockReturnValue(useProductPages)
        setupUserApis()

        const course = mitxOnlineCourse({
          include_in_learn_catalog: true,
        })
        const run = course.courseruns[0]
        const enrollment = mitxonline.factories.enrollment.courseEnrollment({
          grades: [mitxonline.factories.enrollment.grade({ passed: true })],
          enrollment_mode: EnrollmentMode.Verified,
          run: {
            ...run,
            course: { ...course },
          },
        })

        renderWithProviders(
          <DashboardCard
            resource={{
              type: DashboardType.CourseRunEnrollment,
              data: enrollment,
            }}
          />,
        )

        const card = getCard()
        const contextMenuButton = within(card).getByRole("button", {
          name: "More options",
        })
        await user.click(contextMenuButton)

        const viewDetailsItem = screen.getByRole("menuitem", {
          name: "View Course Details",
        })

        expect(viewDetailsItem).toHaveAttribute(
          "href",
          getExpectedHref(course.readable_id),
        )
      },
    )

    test("Context menu for program enrollment uses product page URLs when feature flag is enabled", async () => {
      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setupUserApis()

      const program = mitxonline.factories.programs.simpleProgram()
      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          program,
        })

      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.ProgramEnrollment,
            data: programEnrollment,
          }}
        />,
      )

      const card = getCard()
      const contextMenuButton = within(card).getByRole("button", {
        name: "More options",
      })
      await user.click(contextMenuButton)

      const viewDetailsItem = screen.getByRole("menuitem", {
        name: "View Program Details",
      })

      // Should have product page URL as href
      expect(viewDetailsItem).toHaveAttribute(
        "href",
        `/programs/${program.readable_id}`,
      )
    })

    test("Context menu for program enrollment uses constructed marketing URL when feature flag is disabled", async () => {
      mockedUseFeatureFlagEnabled.mockReturnValue(false)
      setupUserApis()

      const program = mitxonline.factories.programs.simpleProgram({
        readable_id: "test-program-123",
      })
      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          program,
        })

      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.ProgramEnrollment,
            data: programEnrollment,
          }}
        />,
      )

      const card = getCard()
      const contextMenuButton = within(card).getByRole("button", {
        name: "More options",
      })
      await user.click(contextMenuButton)

      const viewDetailsItem = screen.getByRole("menuitem", {
        name: "View Program Details",
      })

      // Should have constructed marketing URL
      expect(viewDetailsItem).toHaveAttribute(
        "href",
        mitxonlineLegacyUrl("/programs/test-program-123"),
      )
    })

    test.each([{ useProductPages: false }, { useProductPages: true }])(
      "Context menu for course enrollment shows View Details (flag=$useProductPages) using readable_id",
      async ({ useProductPages }) => {
        setupUserApis()

        const course = mitxonline.factories.courses.course({
          include_in_learn_catalog: true,
          readable_id: "test-course-readable-id",
        })
        const enrollment = mitxonline.factories.enrollment.courseEnrollment({
          grades: [mitxonline.factories.enrollment.grade({ passed: true })],
          enrollment_mode: EnrollmentMode.Verified,
          run: {
            ...mitxonline.factories.courses.courseRun(),
            course,
          },
        })

        mockedUseFeatureFlagEnabled.mockReturnValue(useProductPages)
        renderWithProviders(
          <DashboardCard
            resource={{
              type: DashboardType.CourseRunEnrollment,
              data: enrollment,
            }}
          />,
        )

        const card = getCard()
        const contextMenuButton = within(card).getByRole("button", {
          name: "More options",
        })
        await user.click(contextMenuButton)

        // View Course Details is always present when include_in_learn_catalog=true
        // (URL is constructed from readable_id, not fetched from Wagtail page_url)
        expect(
          screen.getByRole("menuitem", { name: "View Course Details" }),
        ).toBeInTheDocument()

        // Should also have Email Settings and Unenroll
        expect(
          screen.getByRole("menuitem", { name: "Email Settings" }),
        ).toBeInTheDocument()
        expect(
          screen.getByRole("menuitem", { name: "Unenroll" }),
        ).toBeInTheDocument()
      },
    )

    test("Context menu hides View Course Details for B2B contract enrollments", async () => {
      setupUserApis()
      mockedUseFeatureFlagEnabled.mockReturnValue(true)

      const course = mitxOnlineCourse({
        readable_id: "contract-course-readable-id",
      })
      const run = course.courseruns[0]
      const b2bContractId = faker.number.int()
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        grades: [mitxonline.factories.enrollment.grade({ passed: true })],
        enrollment_mode: EnrollmentMode.Verified,
        b2b_contract_id: b2bContractId,
        run: {
          ...run,
          course: course,
        },
      })

      renderWithProviders(
        <DashboardCard
          resource={{
            type: DashboardType.CourseRunEnrollment,
            data: enrollment,
          }}
        />,
      )

      const card = getCard()
      const contextMenuButton = within(card).getByRole("button", {
        name: "More options",
      })
      await user.click(contextMenuButton)

      expect(
        screen.queryByRole("menuitem", { name: "View Course Details" }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("menuitem", { name: "Email Settings" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("menuitem", { name: "Unenroll" }),
      ).toBeInTheDocument()
    })
  })
})

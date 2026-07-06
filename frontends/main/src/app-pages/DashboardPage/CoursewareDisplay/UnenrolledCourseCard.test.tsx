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
import { makeRequest } from "api/test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { cartesianProduct } from "ol-test-utilities"
import { UnenrolledCourseCard } from "./UnenrolledCourseCard"
import { trackCourseEnrolled } from "@/common/analytics/gtm"

jest.mock("@/common/analytics/gtm", () => ({
  ...jest.requireActual("@/common/analytics/gtm"),
  trackCourseEnrolled: jest.fn(),
}))

const mitxOnlineCourse = mitxonline.factories.courses.course

const mitxUser = mitxonline.factories.user.user

const setupUserApis = (overrides?: Parameters<typeof mitxUser>[0]) => {
  const userData = mitxonline.factories.user.user({
    is_staff: false,
    ...overrides,
  })
  setMockResponse.get(mitxonline.urls.userMe.get(), userData)
  return userData
}

describe.each([
  { display: "desktop", testId: "enrollment-card-desktop" },
  { display: "mobile", testId: "enrollment-card-mobile" },
])("UnenrolledCourseCard $display", ({ testId }) => {
  const getCard = () => screen.getByTestId(testId)

  setupLocationMock()

  test("shows course title as clickable text (not link) when not enrolled", () => {
    setupUserApis()
    const run = mitxonline.factories.courses.courseRun({ b2b_contract: null })
    const course = mitxOnlineCourse({
      title: run.title, // match so heading text is predictable
      courseruns: [run],
      next_run_id: run.id,
    })

    renderWithProviders(<UnenrolledCourseCard course={course} />)

    const card = getCard()
    // Should not be a link
    expect(
      within(card).queryByRole("link", { name: run.title }),
    ).not.toBeInTheDocument()
    // Should be clickable text wrapped in a heading
    expect(
      within(card).getByRole("heading", { name: run.title }),
    ).toBeInTheDocument()
  })

  test("shows course title as clickable text when B2B contract", () => {
    setupUserApis()
    const b2bContractId = faker.number.int()
    const run = mitxonline.factories.courses.courseRun({
      b2b_contract: b2bContractId,
      is_enrollable: true,
    })
    const course = mitxOnlineCourse({
      title: run.title,
      courseruns: [run],
      next_run_id: run.id,
    })

    renderWithProviders(
      <UnenrolledCourseCard course={course} contractId={b2bContractId} />,
    )

    const card = getCard()
    expect(
      within(card).queryByRole("link", { name: run.title }),
    ).not.toBeInTheDocument()
    expect(
      within(card).getByRole("heading", { name: run.title }),
    ).toBeInTheDocument()
  })

  test("accepts a className and Component prop", () => {
    setupUserApis()
    const course = mitxOnlineCourse()
    const TheComponent = faker.helpers.arrayElement([
      "li",
      "div",
      "span",
      "article",
    ])
    renderWithProviders(
      <UnenrolledCourseCard
        Component={TheComponent}
        course={course}
        className="some-custom classes"
      />,
    )
    const card = getCard()
    expect(card.tagName).toBe(TheComponent.toUpperCase())
    expect(card).toHaveClass("some-custom")
    expect(card).toHaveClass("classes")
  })

  test("CTA is disabled when no enrollable runs exist", () => {
    setupUserApis()
    const course = mitxOnlineCourse({
      courseruns: [
        mitxonline.factories.courses.courseRun({ is_enrollable: false }),
      ],
    })

    renderWithProviders(<UnenrolledCourseCard course={course} />)

    const card = getCard()
    expect(within(card).getByTestId("courseware-button")).toBeDisabled()
  })

  test("CTA is disabled when the displayed run is not enrollable", () => {
    setupUserApis()
    // A selected variant run can resolve to a non-enrollable run. The CTA must
    // disable (the diff's `!courseRun?.is_enrollable` guard) rather than fall
    // back to enrolling in some other run. courseware_url/id are present via
    // factory defaults, so is_enrollable is the sole reason it's disabled.
    const nonEnrollableRun = mitxonline.factories.courses.courseRun({
      is_enrollable: false,
    })
    const course = mitxOnlineCourse()

    renderWithProviders(
      <UnenrolledCourseCard course={course} displayedRun={nonEnrollableRun} />,
    )

    expect(within(getCard()).getByTestId("courseware-button")).toBeDisabled()
  })

  test("uses displayedRun title when provided", () => {
    setupUserApis()
    const defaultRun = mitxonline.factories.courses.courseRun({
      title: "Default Run Title",
      is_enrollable: true,
    })
    const displayedRun = mitxonline.factories.courses.courseRun({
      title: "Selected Language Run Title",
      is_enrollable: true,
    })
    const course = mitxOnlineCourse({
      title: "Base Course Title",
      courseruns: [defaultRun, displayedRun],
      next_run_id: defaultRun.id,
    })

    renderWithProviders(
      <UnenrolledCourseCard course={course} displayedRun={displayedRun} />,
    )

    const card = getCard()
    expect(
      within(card).getByText("Selected Language Run Title"),
    ).toBeInTheDocument()
    expect(
      within(card).queryByText("Base Course Title"),
    ).not.toBeInTheDocument()
  })

  test("shows number of days until course starts", () => {
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
      next_run_id: run.id,
    })

    renderWithProviders(<UnenrolledCourseCard course={course} />)

    expect(getCard()).toHaveTextContent(/starts in 5 days/i)
  })

  // ---------------------------------------------------------------------------
  // End date display
  // ---------------------------------------------------------------------------

  test.each([
    {
      endDate: moment().add(2, "days").toISOString(),
      expectedText: /ends in 2 days/i,
      case: "future (plural)",
    },
    {
      endDate: moment().add(1, "day").toISOString(),
      expectedText: /ends tomorrow/i,
      case: "future (singular)",
    },
    {
      endDate: moment().subtract(2, "days").toISOString(),
      expectedText: /ended 2 days ago/i,
      case: "past (plural)",
    },
    {
      endDate: moment().subtract(1, "day").toISOString(),
      expectedText: /ended yesterday/i,
      case: "past (singular)",
    },
  ])("Shows end date text ($case)", ({ endDate, expectedText }) => {
    setupUserApis()
    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
      start_date: moment().subtract(30, "days").toISOString(),
      end_date: endDate,
    })
    const course = mitxOnlineCourse({ courseruns: [run], next_run_id: run.id })
    renderWithProviders(<UnenrolledCourseCard course={course} />)
    expect(within(getCard()).getByText(expectedText)).toBeInTheDocument()
  })

  test("Does not show end date text when run has no end date", () => {
    setupUserApis()
    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
      end_date: null,
    })
    const course = mitxOnlineCourse({ courseruns: [run], next_run_id: run.id })
    renderWithProviders(<UnenrolledCourseCard course={course} />)
    expect(
      within(getCard()).queryByText(/ends in \d+ day/i),
    ).not.toBeInTheDocument()
    expect(
      within(getCard()).queryByText(/ended \d+ day/i),
    ).not.toBeInTheDocument()
  })

  test.each([
    { layout: "compact" as const, testId: "courseware-button" },
    { layout: "default" as const, testId: undefined },
  ])(
    "End date shown in correct position for $layout layout",
    ({ layout, testId }) => {
      setupUserApis()
      const run = mitxonline.factories.courses.courseRun({
        is_enrollable: true,
        start_date: moment().subtract(30, "days").toISOString(),
        end_date: moment().add(5, "days").toISOString(),
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id,
      })
      renderWithProviders(
        <UnenrolledCourseCard course={course} layout={layout} />,
      )
      const card = getCard()
      if (testId) {
        // Compact: end date and button are both inside the compact-meta-row
        const metaRow = within(card).getByTestId("compact-meta-row")
        expect(metaRow).toHaveTextContent(/ends in 5 days/i)
        expect(within(metaRow).getByTestId(testId)).toBeInTheDocument()
      } else {
        // Default layout has no compact-meta-row; end date appears below the title
        expect(
          within(card).queryByTestId("compact-meta-row"),
        ).not.toBeInTheDocument()
        expect(within(card).getByText(/ends in 5 days/i)).toBeInTheDocument()
      }
    },
  )

  // ---------------------------------------------------------------------------
  // B2B enrollment flows
  // ---------------------------------------------------------------------------

  const setupEnrollmentApis = (opts: {
    user: ReturnType<typeof mitxUser>
    course: ReturnType<typeof mitxOnlineCourse>
    run?: ReturnType<typeof mitxonline.factories.courses.courseRun>
  }) => {
    setMockResponse.get(mitxonline.urls.userMe.get(), opts.user)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])

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
    setMockResponse.get(mitxonline.urls.countries.list(), countries)
    return { enrollmentUrl }
  }

  const ENROLLMENT_TRIGGERS = [
    { trigger: "button" as const },
    { trigger: "title-link" as const },
  ]

  test.each(ENROLLMENT_TRIGGERS)(
    "B2B enrollment for complete profile bypasses just-in-time dialog ($trigger)",
    async ({ trigger }) => {
      const userData = mitxUser({
        legal_address: { country: "US" },
        user_profile: { year_of_birth: 1988 },
      })
      const b2bContractId = faker.number.int()
      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: b2bContractId,
        is_enrollable: true,
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id,
      })
      const { enrollmentUrl } = setupEnrollmentApis({
        user: userData,
        course,
        run,
      })

      renderWithProviders(
        <UnenrolledCourseCard course={course} contractId={b2bContractId} />,
      )

      const card = getCard()
      const titleHeading = within(card).getByRole("heading")
      const triggerElement =
        trigger === "button"
          ? within(card).getByTestId("courseware-button")
          : titleHeading

      await user.click(triggerElement)

      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "post", url: enrollmentUrl }),
      )
    },
  )

  test.each(
    cartesianProduct(ENROLLMENT_TRIGGERS, [
      { userData: mitxUser({ legal_address: { country: "" } }) },
      { userData: mitxUser({ user_profile: { year_of_birth: null } }) },
    ]),
  )(
    "B2B enrollment for incomplete profile shows just-in-time dialog ($trigger)",
    async ({ trigger, userData }) => {
      const b2bContractId = faker.number.int()
      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: b2bContractId,
        is_enrollable: true,
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id,
      })
      setupEnrollmentApis({ user: userData, course, run })

      renderWithProviders(
        <UnenrolledCourseCard course={course} contractId={b2bContractId} />,
      )

      const card = getCard()
      const triggerElement =
        trigger === "button"
          ? within(card).getByTestId("courseware-button")
          : within(card).getByRole("heading")

      await user.click(triggerElement)

      await screen.findByRole("dialog", { name: "Just a Few More Details" })
      expect(makeRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "post" }),
      )
    },
  )

  test("B2B enrollment targets the displayed (variant) run, not getBestRun's default pick", async () => {
    const userData = mitxUser({
      legal_address: { country: "US" },
      user_profile: { year_of_birth: 1988 },
    })
    const b2bContractId = faker.number.int()
    // Pre-fix, the card enrolled in getBestRun's pick (defaultRun, the canonical
    // "next run") instead of the run it displays. The selected variant run is
    // what must be enrolled in.
    const defaultRun = mitxonline.factories.courses.courseRun({
      b2b_contract: b2bContractId,
      is_enrollable: true,
    })
    const variantRun = mitxonline.factories.courses.courseRun({
      b2b_contract: b2bContractId,
      is_enrollable: true,
    })
    // The variant run is intentionally NOT in course.courseruns: variant runs
    // come from a separate endpoint and are often absent from the course
    // payload. The card must still enroll in it (via displayedRun), and the
    // handler must resolve its URL from the explicitly-passed href — not a
    // course.courseruns lookup. Keeping it out of the array makes this test
    // fail if that explicit-href path is ever dropped.
    const course = mitxOnlineCourse({
      courseruns: [defaultRun],
      next_run_id: defaultRun.id,
    })
    expect(course.courseruns.map((run) => run.courseware_id)).not.toContain(
      variantRun.courseware_id,
    )
    const { enrollmentUrl: variantEnrollUrl } = setupEnrollmentApis({
      user: userData,
      course,
      run: variantRun,
    })
    // The default run must NOT be enrolled in. Mock it (rather than leaving it
    // unhandled) so a buggy call resolves and the failure surfaces as a clear
    // assertion; the sentinel body documents that reaching it is the bug.
    const defaultEnrollUrl = mitxonline.urls.b2b.courseEnrollment(
      defaultRun.courseware_id,
    )
    setMockResponse.post(defaultEnrollUrl, { result: "SHOULD_NOT_BE_CALLED" })

    renderWithProviders(
      <UnenrolledCourseCard
        course={course}
        contractId={b2bContractId}
        displayedRun={variantRun}
      />,
    )

    await user.click(within(getCard()).getByTestId("courseware-button"))

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "post", url: variantEnrollUrl }),
      )
    })
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", url: defaultEnrollUrl }),
    )
  })

  // ---------------------------------------------------------------------------
  // B2C (non-B2B) enrollment flows
  // ---------------------------------------------------------------------------

  describe("B2C (non-B2B) Enrollment", () => {
    test.each(ENROLLMENT_TRIGGERS)(
      "Clicking $trigger opens CourseEnrollmentDialog for both-mode enrollment",
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
            mitxonline.factories.courses.enrollmentMode({
              requires_payment: true,
            }),
          ],
        })
        const course = mitxOnlineCourse({
          courseruns: [run],
          next_run_id: run.id,
        })

        renderWithProviders(<UnenrolledCourseCard course={course} />)

        const card = getCard()
        const triggerElement =
          trigger === "button"
            ? within(card).getByTestId("courseware-button")
            : within(card).getByRole("heading")

        await user.click(triggerElement)

        await screen.findByRole("dialog", { name: course.title })
        expect(
          screen.queryByRole("dialog", { name: "Just a Few More Details" }),
        ).not.toBeInTheDocument()
      },
    )

    test.each(ENROLLMENT_TRIGGERS)(
      "Clicking $trigger bypasses dialog for free-only single-run enrollment",
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
        setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])

        renderWithProviders(<UnenrolledCourseCard course={course} />)

        const card = getCard()
        const triggerElement =
          trigger === "button"
            ? within(card).getByTestId("courseware-button")
            : within(card).getByRole("heading")

        await user.click(triggerElement)

        await waitFor(() => {
          expect(makeRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: "post", url: enrollmentUrl }),
          )
        })

        expect(trackCourseEnrolled).toHaveBeenCalledWith(course.title)

        expect(
          screen.queryByRole("dialog", { name: course.title }),
        ).not.toBeInTheDocument()
      },
    )

    test.each(ENROLLMENT_TRIGGERS)(
      "Clicking $trigger bypasses dialog for paid-only single-run enrollment",
      async ({ trigger }) => {
        const userData = mitxUser()
        setMockResponse.get(mitxonline.urls.userMe.get(), userData)

        const product = mitxonline.factories.courses.product({ price: "500" })
        const run = mitxonline.factories.courses.courseRun({
          b2b_contract: null,
          is_enrollable: true,
          enrollment_modes: [
            mitxonline.factories.courses.enrollmentMode({
              requires_payment: true,
            }),
          ],
          products: [product],
        })
        const course = mitxOnlineCourse({
          courseruns: [run],
          next_run_id: run.id,
        })

        const clearUrl = mitxonline.urls.baskets.clear()
        setMockResponse.delete(clearUrl, undefined)
        const basketUrl = mitxonline.urls.baskets.createFromProduct(product.id)
        setMockResponse.post(basketUrl, { id: 1, items: [] })

        renderWithProviders(<UnenrolledCourseCard course={course} />)

        const card = getCard()
        const triggerElement =
          trigger === "button"
            ? within(card).getByTestId("courseware-button")
            : within(card).getByRole("heading")

        await user.click(triggerElement)

        await waitFor(() => {
          expect(makeRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: "post", url: basketUrl }),
          )
        })

        expect(
          screen.queryByRole("dialog", { name: course.title }),
        ).not.toBeInTheDocument()
      },
    )
  })

  // ---------------------------------------------------------------------------
  // Verified Program Enrollment
  // ---------------------------------------------------------------------------

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

        const programEnrollmentEndpoint =
          mitxonline.urls.verifiedProgramEnrollments.create(run.courseware_id)
        setMockResponse.post(programEnrollmentEndpoint, {})

        renderWithProviders(
          <UnenrolledCourseCard
            course={course}
            ancestorContext={{ programEnrollment }}
          />,
        )

        const card = getCard()
        const triggerElement =
          trigger === "button"
            ? within(card).getByTestId("courseware-button")
            : within(card).getByRole("heading")

        await user.click(triggerElement)

        await waitFor(() => {
          expect(makeRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              method: "post",
              url: programEnrollmentEndpoint,
            }),
          )
        })

        await waitFor(() => {
          expect(window.location.href).toBe(run.courseware_url)
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
          enrollment_mode: "audit",
        })

      renderWithProviders(
        <UnenrolledCourseCard
          course={course}
          ancestorContext={{ programEnrollment }}
        />,
      )

      const card = getCard()
      const button = within(card).getByTestId("courseware-button")
      await user.click(button)

      await screen.findByRole("dialog", { name: course.title })
      expect(
        screen.queryByRole("dialog", { name: "Just a Few More Details" }),
      ).not.toBeInTheDocument()
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
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])

      renderWithProviders(
        <UnenrolledCourseCard
          course={course}
          ancestorContext={{ programEnrollment }}
        />,
      )

      const card = getCard()
      const button = within(card).getByTestId("courseware-button")
      await user.click(button)

      await waitFor(() => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: "post", url: enrollmentUrl }),
        )
      })

      expect(
        screen.queryByRole("dialog", { name: course.title }),
      ).not.toBeInTheDocument()
    })

    test("Audit program enrollment bypasses dialog for paid-only single-run enrollment", async () => {
      const userData = mitxUser()
      setMockResponse.get(mitxonline.urls.userMe.get(), userData)

      const product = mitxonline.factories.courses.product({ price: "500" })
      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: null,
        is_enrollable: true,
        enrollment_modes: [
          mitxonline.factories.courses.enrollmentMode({
            requires_payment: true,
          }),
        ],
        products: [product],
      })
      const course = mitxOnlineCourse({
        courseruns: [run],
        next_run_id: run.id,
      })

      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          enrollment_mode: "audit",
        })

      const clearUrl = mitxonline.urls.baskets.clear()
      setMockResponse.delete(clearUrl, undefined)
      const basketUrl = mitxonline.urls.baskets.createFromProduct(product.id)
      setMockResponse.post(basketUrl, { id: 1, items: [] })

      renderWithProviders(
        <UnenrolledCourseCard
          course={course}
          ancestorContext={{ programEnrollment }}
        />,
      )

      const card = getCard()
      const button = within(card).getByTestId("courseware-button")
      await user.click(button)

      await waitFor(() => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: "post", url: basketUrl }),
        )
      })

      expect(
        screen.queryByRole("dialog", { name: course.title }),
      ).not.toBeInTheDocument()
    })
  })
})

describe("UnenrolledCourseCard card type label", () => {
  setupLocationMock()

  const getDesktopCard = () => screen.getByTestId("enrollment-card-desktop")

  const setupCourse = (b2bContractId: number | null = null) => {
    const run = mitxonline.factories.courses.courseRun({
      b2b_contract: b2bContractId,
      is_enrollable: true,
    })
    return mitxOnlineCourse({
      title: run.title,
      courseruns: [run],
      next_run_id: run.id,
    })
  }

  test("shows 'Course' for a non-B2B card", () => {
    setupUserApis()
    renderWithProviders(<UnenrolledCourseCard course={setupCourse()} />)
    expect(within(getDesktopCard()).getByText("Course")).toBeInTheDocument()
    expect(
      within(getDesktopCard()).queryByText("Module"),
    ).not.toBeInTheDocument()
  })

  test("shows 'Module' for a B2B card", () => {
    setupUserApis()
    const b2bContractId = faker.number.int()
    renderWithProviders(
      <UnenrolledCourseCard
        course={setupCourse(b2bContractId)}
        contractId={b2bContractId}
      />,
    )
    expect(within(getDesktopCard()).getByText("Module")).toBeInTheDocument()
    expect(
      within(getDesktopCard()).queryByText("Course"),
    ).not.toBeInTheDocument()
  })

  test("shows 'Module' when isModule is set", () => {
    setupUserApis()
    renderWithProviders(
      <UnenrolledCourseCard course={setupCourse()} isModule />,
    )
    expect(within(getDesktopCard()).getByText("Module")).toBeInTheDocument()
  })
})

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

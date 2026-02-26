import { act } from "@testing-library/react"
import {
  screen,
  waitFor,
  renderWithProviders,
  user,
  setupLocationMock,
} from "@/test-utils"
import { makeRequest, mockAxiosInstance, setMockResponse } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import type {
  CourseWithCourseRunsSerializerV2,
  V2Program,
} from "@mitodl/mitxonline-api-axios/v2"
import NiceModal from "@ebay/nice-modal-react"
import ProgramEnrollmentDialog from "./ProgramEnrollmentDialog"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import { DASHBOARD_HOME } from "@/common/urls"

const makeCourseRun = mitxFactories.courses.courseRun

const makeCourse = mitxFactories.courses.course

const enrollableRun: typeof makeCourseRun = (overrides) =>
  makeCourseRun({
    is_enrollable: true,
    enrollment_start: faker.date.past().toISOString(),
    enrollment_end: faker.date.future().toISOString(),
    ...overrides,
  })

const upgradeableRun: typeof makeCourseRun = (overrides) =>
  makeCourseRun({
    is_upgradable: true,
    is_enrollable: true,
    is_archived: false,
    products: [mitxFactories.courses.product()],
    ...overrides,
  })

const getCourseSelect = () => {
  return screen.getByRole("combobox", { name: /choose a course/i })
}

describe("ProgramEnrollmentDialog", () => {
  setupLocationMock()

  const makeProgram = mitxFactories.programs.program

  const COURSE_PAGE_SIZE = 100
  const setupCourseApis = (courses: CourseWithCourseRunsSerializerV2[]) => {
    setMockResponse.get(
      mitxUrls.courses.coursesList({
        id: courses.map((course) => course.id),
        page_size: COURSE_PAGE_SIZE,
      }),
      {
        results: courses,
        count: courses.length,
        next: null,
        previous: null,
      },
    )
  }

  const openProgramDialog = async (program: V2Program) => {
    await act(async () => {
      NiceModal.show(ProgramEnrollmentDialog, { program })
    })
    return await screen.findByRole("dialog")
  }

  describe("Dialog title and basic display", () => {
    test("Dialog opens with program title", async () => {
      const program = makeProgram({ title: "Test Program Title" })
      setupCourseApis([])

      renderWithProviders(null)
      await openProgramDialog(program)

      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getByText("Test Program Title")).toBeInTheDocument()
    })
  })

  describe("Course dropdown states and options", () => {
    test("Dropdown shows 'Please Select' initially when courses load", async () => {
      const course1 = makeCourse({ courseruns: [enrollableRun()] })
      const program = makeProgram({ courses: [course1.id] })
      setupCourseApis([course1])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = getCourseSelect()
      expect(select).toHaveTextContent(/please select/i)
    })

    test("Dropdown shows loading state while courses load", async () => {
      const program = makeProgram()
      const courseResponse = Promise.withResolvers()
      setMockResponse.get(
        expect.stringContaining(mitxUrls.courses.coursesList()),
        courseResponse.promise,
      )
      renderWithProviders(null)
      await openProgramDialog(program)

      const select = getCourseSelect()
      await user.click(select)

      expect(
        screen.getByRole("option", { name: /loading courses/i }),
      ).toBeInTheDocument()
    })

    test("Dropdown shows error state when courses fail to load", async () => {
      const program = makeProgram()
      setMockResponse.get(
        expect.stringContaining(mitxUrls.courses.coursesList()),
        "Failed to load courses",
        { code: 500 },
      )

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = getCourseSelect()
      await waitFor(() => {
        expect(select).toHaveAttribute("aria-invalid", "true")
      })
    })

    test("Dropdown shows course options once loaded", async () => {
      const run1 = enrollableRun({ course_number: "6.001" })
      const run2 = enrollableRun({ course_number: "6.002" })
      const course1 = makeCourse({
        courseruns: [run1],
        title: "Introduction to CS",
        next_run_id: run1.id,
      })
      const course2 = makeCourse({
        courseruns: [run2],
        title: "Advanced CS",
        next_run_id: run2.id,
      })
      const program = makeProgram({ courses: [course1.id, course2.id] })
      setupCourseApis([course1, course2])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = getCourseSelect()
      await user.click(select)

      const options = screen.getAllByRole("option")
      // Should have 3 options: 1 "Please Select" + 2 courses
      expect(options).toHaveLength(3)
    })

    test("Course options include course title suffixed by the chosen run id", async () => {
      const run = enrollableRun({ course_number: "6.001x" })
      const course = makeCourse({
        courseruns: [run],
        title: "Introduction to Computer Science",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = getCourseSelect()
      await user.click(select)

      expect(
        screen.getByRole("option", {
          name: /Introduction to Computer Science - 6.001x/i,
        }),
      ).toBeInTheDocument()
    })

    test("If no run is available, '(No available runs)' shows as suffix", async () => {
      const course = makeCourse({
        courseruns: [],
        title: "Course Without Runs",
        next_run_id: null,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = getCourseSelect()
      await user.click(select)

      screen.getByRole("option", {
        name: "Course Without Runs - (No available runs)",
      })
    })

    test("If the chosen run is not upgradeable, '(No certificate available)' shows as suffix", async () => {
      const nonUpgradableRun = enrollableRun({
        course_number: "6.003",
        is_upgradable: false,
      })
      const course = makeCourse({
        courseruns: [nonUpgradableRun],
        title: "Non-Upgradable Course",
        next_run_id: nonUpgradableRun.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = getCourseSelect()
      await user.click(select)

      expect(
        screen.getByRole("option", {
          name: /Non-Upgradable Course - 6.003 \(No certificate available\)/i,
        }),
      ).toBeInTheDocument()
    })

    test("Upgradeable runs do NOT show '(No certificate available)' suffix", async () => {
      const upgradableRun = upgradeableRun({ course_number: "6.004" })
      const course = makeCourse({
        courseruns: [upgradableRun],
        title: "Upgradable Course",
        next_run_id: upgradableRun.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = getCourseSelect()
      await user.click(select)

      const option = screen.getByRole("option", {
        name: /Upgradable Course - 6.004$/i,
      })
      expect(option).toBeInTheDocument()
      expect(option.textContent).not.toContain("No certificate available")
    })
  })

  describe("Certificate upgrade and enrollment actions", () => {
    test("Clicking 'Add to cart' adds product to basket and redirects to cart", async () => {
      const assign = jest.mocked(window.location.assign)

      const run = upgradeableRun({ course_number: "6.005" })
      const product = run.products[0]
      invariant(product, "Upgradeable run must have a product")
      const course = makeCourse({
        courseruns: [run],
        title: "Test Course",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })

      setMockResponse.get(
        expect.stringContaining(mitxUrls.courses.coursesList()),
        {
          results: [course],
          count: 1,
          next: null,
          previous: null,
        },
      )

      const clearUrl = mitxUrls.baskets.clear()
      setMockResponse.delete(clearUrl, undefined)
      const basketUrl = mitxUrls.baskets.createFromProduct(product.id)
      setMockResponse.post(basketUrl, { id: 1, items: [] })

      renderWithProviders(null)
      await openProgramDialog(program)

      // Select the course
      const select = getCourseSelect()
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /Test Course - 6.005/i,
      })
      await user.click(courseOption)

      // Wait for certificate upgrade section to appear
      await screen.findByText(/Get Certificate/)

      // Click "Add to Cart" button
      const upgradeButton = screen.getByRole("button", {
        name: /Add to Cart.*to get a Certificate/i,
      })
      await user.click(upgradeButton)

      // Verify clear basket API was called first
      await waitFor(() => {
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "DELETE",
            url: clearUrl,
          }),
        )
      })

      // Verify create basket API was called
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: basketUrl,
        }),
      )

      // Verify redirect to cart page
      const expectedCartUrl = new URL(
        "/cart/",
        process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
      ).toString()
      expect(assign).toHaveBeenCalledWith(expectedCartUrl)
    })

    test("Clicking 'No thanks, I'll take the course...' button enrolls in the course", async () => {
      const run = enrollableRun({ course_number: "6.006" })
      const course = makeCourse({
        courseruns: [run],
        title: "Algorithms",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      // Select the course
      const select = getCourseSelect()
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /Algorithms - 6.006/i,
      })
      await user.click(courseOption)

      // Wait for enrollment button to be enabled
      const enrollButton = await screen.findByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })
      expect(enrollButton).toBeEnabled()

      // Mock the enrollment API call
      setMockResponse.post(mitxUrls.enrollment.enrollmentsListV1(), {})

      // Click the enrollment button
      await user.click(enrollButton)

      // Verify the enrollment request was made
      await waitFor(() => {
        expect(makeRequest).toHaveBeenCalledWith(
          "post",
          mitxUrls.enrollment.enrollmentsListV1(),
          { run_id: run.id },
        )
      })
    })

    test("Enrollment button is disabled when no course is selected", async () => {
      const run = enrollableRun()
      const course = makeCourse({
        courseruns: [run],
        title: "Test Course",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      // Don't select any course, just check button state
      const enrollButton = screen.getByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })
      expect(enrollButton).toBeDisabled()
    })

    test("Enrollment button is disabled when course with no runs is selected", async () => {
      const course = makeCourse({
        courseruns: [],
        title: "Course Without Runs",
        next_run_id: null,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      // Try to select the course without runs
      const select = getCourseSelect()
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /No available runs/i,
      })
      await user.click(courseOption)

      // Enrollment button should be disabled
      const enrollButton = screen.getByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })
      expect(enrollButton).toBeDisabled()
    })

    test("Default behavior: redirects to dashboard home after successful enrollment", async () => {
      const run = enrollableRun({ course_number: "6.007" })
      const course = makeCourse({
        courseruns: [run],
        title: "Test Course",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      const { location } = renderWithProviders(null)
      await openProgramDialog(program)

      // Select the course
      const select = getCourseSelect()
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /Test Course - 6.007/i,
      })
      await user.click(courseOption)

      // Wait for enrollment button to be enabled
      const enrollButton = await screen.findByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })

      // Mock the enrollment API call
      setMockResponse.post(mitxUrls.enrollment.enrollmentsListV1(), {})

      // Click the enrollment button
      await user.click(enrollButton)

      // Verify redirect to dashboard home
      await waitFor(() => {
        expect(location.current.pathname).toBe(DASHBOARD_HOME)
      })

      // Verify dialog has closed
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("Custom onCourseEnroll: calls callback instead of redirecting", async () => {
      const run = enrollableRun({ course_number: "6.008" })
      const course = makeCourse({
        courseruns: [run],
        title: "Another Course",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])
      const onCourseEnroll = jest.fn()

      const { location } = renderWithProviders(null)
      await act(async () => {
        NiceModal.show(ProgramEnrollmentDialog, { program, onCourseEnroll })
      })
      await screen.findByRole("dialog")

      // Select the course
      const select = getCourseSelect()
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /Another Course - 6.008/i,
      })
      await user.click(courseOption)

      // Wait for enrollment button to be enabled
      const enrollButton = await screen.findByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })

      // Mock the enrollment API call
      setMockResponse.post(mitxUrls.enrollment.enrollmentsListV1(), {})

      // Click the enrollment button
      await user.click(enrollButton)

      // Verify callback was called with the run
      await waitFor(() => {
        expect(onCourseEnroll).toHaveBeenCalledWith(run)
      })

      // Should NOT redirect to dashboard
      expect(location.current.pathname).not.toBe(DASHBOARD_HOME)

      // Verify dialog has closed
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("Shows error message when enrollment fails", async () => {
      const run = enrollableRun({ course_number: "6.009" })
      const course = makeCourse({
        courseruns: [run],
        title: "Error Test Course",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      // Select the course
      const select = getCourseSelect()
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /Error Test Course - 6.009/i,
      })
      await user.click(courseOption)

      // Wait for enrollment button to be enabled
      const enrollButton = await screen.findByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })

      // Mock enrollment failure
      setMockResponse.post(
        mitxUrls.enrollment.enrollmentsListV1(),
        "Enrollment failed",
        { code: 500 },
      )

      // Click the enrollment button - the error will be caught by the mutation
      await user.click(enrollButton)

      // Check for error alert - the mutation error should be displayed
      await waitFor(() => {
        expect(
          screen.getByText(
            /There was a problem enrolling you in this course. Please try again later./i,
          ),
        ).toBeInTheDocument()
      })
    })
  })

  describe("Financial Assistance", () => {
    test.each([
      { hasFinancialAid: true, expectLink: true },
      { hasFinancialAid: false, expectLink: false },
    ])(
      "Financial aid link is displayed if and only if URL is non-empty (hasFinancialAid=$hasFinancialAid)",
      async ({ hasFinancialAid, expectLink }) => {
        const financialAidUrl = hasFinancialAid
          ? `/financial-aid/${faker.string.alphanumeric(10)}`
          : ""
        const product = mitxFactories.courses.product()
        const run = upgradeableRun({ products: [product] })
        const course = makeCourse({
          courseruns: [run],
          next_run_id: run.id,
          page: { financial_assistance_form_url: financialAidUrl },
        })
        const program = makeProgram({
          courses: [course.id],
        })
        setupCourseApis([course])

        // Mock the flexible price API response when financial aid is available
        if (hasFinancialAid) {
          const mockFlexiblePrice = mitxFactories.products.flexiblePrice({
            id: product.id,
            price: product.price,
            product_flexible_price: null,
          })
          setMockResponse.get(
            mitxUrls.products.userFlexiblePriceDetail(product.id),
            mockFlexiblePrice,
          )
        }

        renderWithProviders(null)
        await openProgramDialog(program)

        // Select the course to display the certificate upsell
        const select = getCourseSelect()
        await user.click(select)
        const courseOption = screen.getByRole("option", {
          name: new RegExp(course.title),
        })
        await user.click(courseOption)

        if (expectLink) {
          const link = await screen.findByRole("link", {
            name: /financial assistance/i,
          })
          const expectedUrl = new URL(
            financialAidUrl,
            process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
          ).toString()
          expect(link).toHaveAttribute("href", expectedUrl)
        } else {
          const link = screen.queryByRole("link", {
            name: /financial assistance/i,
          })
          expect(link).toBeNull()
        }
      },
    )

    test("Displays user-specific discounted price when financial aid is available", async () => {
      const originalPrice = "100.00"
      const discountedAmount = "50.00"
      const product = mitxFactories.courses.product({ price: originalPrice })
      const flexiblePrice = mitxFactories.products.flexiblePrice({
        id: product.id,
        price: originalPrice,
        product_flexible_price: {
          id: faker.number.int(),
          amount: discountedAmount,
          discount_type: "dollars-off" as const,
          discount_code: faker.string.alphanumeric(8),
          redemption_type: "one-time" as const,
          is_redeemed: false,
          automatic: true,
          max_redemptions: 1,
          payment_type: null,
          activation_date: faker.date.past().toISOString(),
          expiration_date: faker.date.future().toISOString(),
        },
      })
      const financialAidUrl = `/financial-aid/${faker.string.alphanumeric(10)}`
      const run = upgradeableRun({ products: [product] })
      const course = makeCourse({
        courseruns: [run],
        next_run_id: run.id,
        page: { financial_assistance_form_url: financialAidUrl },
      })
      const program = makeProgram({
        courses: [course.id],
      })
      setupCourseApis([course])

      setMockResponse.get(
        mitxUrls.products.userFlexiblePriceDetail(product.id),
        flexiblePrice,
      )

      renderWithProviders(null)
      await openProgramDialog(program)

      // Select the course to display the certificate upsell
      const select = getCourseSelect()
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: new RegExp(course.title),
      })
      await user.click(courseOption)

      // Wait for the flexible price API to be called and prices to be displayed
      await screen.findByText("Financial assistance applied")
      expect(screen.getByText(/\$50\.00/)).toBeInTheDocument()
      expect(screen.getByText(/\$100\.00/)).toBeInTheDocument()
    })

    test("Does NOT call flexible price API when financial aid URL is empty", async () => {
      const product = mitxFactories.courses.product({ price: "100.00" })
      const run = upgradeableRun({ products: [product] })
      const course = makeCourse({
        courseruns: [run],
        next_run_id: run.id,
        page: { financial_assistance_form_url: "" },
      })
      const program = makeProgram({
        courses: [course.id],
      })
      setupCourseApis([course])

      // We're NOT setting up a mock response for the flexible price API
      // If it's called, the test will fail

      renderWithProviders(null)
      await openProgramDialog(program)

      // Select the course to display the certificate upsell
      const select = getCourseSelect()
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: new RegExp(course.title),
      })
      await user.click(courseOption)

      // Should show the regular price
      expect(screen.getByText(/\$100\.00/)).toBeInTheDocument()
      // Should NOT show financial assistance link
      expect(
        screen.queryByRole("link", { name: /financial assistance/i }),
      ).toBeNull()
    })
  })
})

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
import { makeRequest } from "api/test-utils"
import { faker } from "@faker-js/faker/locale/en"
import moment from "moment"
import { EnrolledCourseCard } from "./EnrolledCourseCard"

const EnrollmentMode = {
  Audit: "audit",
  Verified: "verified",
} as const

const setupUserApis = (
  overrides?: Parameters<typeof mitxonline.factories.user.user>[0],
) => {
  const userData = mitxonline.factories.user.user({
    is_staff: false,
    ...overrides,
  })
  setMockResponse.get(mitxonline.urls.userMe.get(), userData)
  return userData
}

// Run date helpers for common time-period scenarios
const pastRunDates = {
  start_date: moment().subtract(90, "days").toISOString(),
  end_date: moment().subtract(30, "days").toISOString(),
}
const currentRunDates = {
  start_date: moment().subtract(30, "days").toISOString(),
  end_date: moment().add(30, "days").toISOString(),
}
const futureRunDates = {
  start_date: moment().add(30, "days").toISOString(),
  end_date: moment().add(90, "days").toISOString(),
}

describe.each([
  { display: "desktop", testId: "enrollment-card-desktop" },
  { display: "mobile", testId: "enrollment-card-mobile" },
])("EnrolledCourseCard $display", ({ testId }) => {
  const getCard = () => screen.getByTestId(testId)

  setupLocationMock()

  test("shows title as a link to courseware_url", () => {
    setupUserApis()
    const coursewareUrl = faker.internet.url()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: { courseware_url: coursewareUrl },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    const link = within(getCard()).getByRole("link", {
      name: enrollment.run.course.title,
    })
    expect(link).toHaveAttribute("href", coursewareUrl)
  })

  test.each([
    { runDates: pastRunDates, expectedLink: true, case: "past" },
    { runDates: currentRunDates, expectedLink: true, case: "current" },
    { runDates: futureRunDates, expectedLink: false, case: "future" },
  ])(
    "Courseware button is a link for started courses and disabled for future ($case)",
    ({ runDates, expectedLink }) => {
      setupUserApis()
      const coursewareUrl = faker.internet.url()
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        grades: [],
        certificate: null,
        run: { ...runDates, courseware_url: coursewareUrl },
      })
      renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
      const btn = within(getCard()).getByTestId("courseware-button")
      if (expectedLink) {
        expect(btn.tagName).toBe("A")
        expect(btn).toHaveAttribute("href", coursewareUrl)
      } else {
        expect(btn).toBeDisabled()
      }
    },
  )

  test("Courseware button is a navigable link for staff even when course has not started", async () => {
    setupUserApis({ is_staff: true })
    const coursewareUrl = faker.internet.url()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      grades: [],
      certificate: null,
      run: { ...futureRunDates, courseware_url: coursewareUrl },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    const btn = await within(getCard()).findByRole("link", {
      name: /^Continue course:/,
    })
    expect(btn).toHaveAttribute("href", coursewareUrl)
  })

  test.each([
    {
      runDates: currentRunDates,
      certificate: null,
      grades: [],
      expectedText: "Continue",
      case: "active enrolled",
    },
    {
      runDates: currentRunDates,
      certificate: {
        uuid: faker.string.uuid(),
        link: faker.internet.url(),
      },
      grades: [],
      expectedText: "View",
      case: "completed",
    },
    {
      runDates: pastRunDates,
      certificate: null,
      grades: [],
      expectedText: "View",
      case: "ended not completed",
    },
    {
      runDates: currentRunDates,
      certificate: null,
      grades: [mitxonline.factories.enrollment.grade({ passed: true })],
      expectedText: "View",
      case: "passing grade, no certificate",
    },
  ])(
    "Courseware button text is '$expectedText' for $case",
    ({ runDates, certificate, grades, expectedText }) => {
      setupUserApis()
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        grades,
        certificate,
        run: runDates,
      })
      renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
      expect(
        within(getCard()).getByTestId("courseware-button"),
      ).toHaveTextContent(expectedText)
    },
  )

  test("shows View Certificate link when certificate is present", () => {
    setupUserApis()
    const certUuid = faker.string.uuid()
    const certificateLink = `https://courses.example.com/certificate/${certUuid}/`
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      certificate: { uuid: certUuid, link: certificateLink },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    const certLink = within(getCard()).getByRole("link", {
      name: /View Certificate/,
    })
    expect(certLink).toHaveAttribute(
      "href",
      `https://courses.example.com/certificate/course/${certUuid}/`,
    )
  })

  test("does not show View Certificate when certificate is absent", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      certificate: null,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getCard()).queryByRole("link", { name: /View Certificate/ }),
    ).not.toBeInTheDocument()
  })

  test("shows course start countdown for future courses", () => {
    setupUserApis()
    const startDate = moment()
      .startOf("day")
      .add(5, "days")
      .add(3, "hours")
      .toISOString()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: { start_date: startDate },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
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
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: { ...currentRunDates, end_date: endDate },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(within(getCard()).getByText(expectedText)).toBeInTheDocument()
  })

  test("Does not show end date text when run has no end date", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: { ...currentRunDates, end_date: null },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getCard()).queryByText(/ends in \d+ day/i),
    ).not.toBeInTheDocument()
    expect(
      within(getCard()).queryByText(/ended \d+ day/i),
    ).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Upgrade banner
  // ---------------------------------------------------------------------------

  test.each([
    {
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
      enrollmentMode: EnrollmentMode.Audit,
      b2bContractId: null,
      expectation: { visible: true },
      case: "audit + upgradable + active",
    },
    {
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
      enrollmentMode: EnrollmentMode.Verified,
      b2bContractId: null,
      expectation: { visible: false },
      case: "verified enrollment",
    },
    {
      run: {
        is_upgradable: false,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
      enrollmentMode: EnrollmentMode.Audit,
      b2bContractId: null,
      expectation: { visible: false },
      case: "not upgradable",
    },
    {
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: false,
      },
      enrollmentMode: EnrollmentMode.Audit,
      b2bContractId: null,
      expectation: { visible: false },
      case: "upgrade product inactive",
    },
  ])(
    "Shows upgrade banner based on upgradeability and enrollment mode ($case)",
    ({ run, enrollmentMode, b2bContractId, expectation }) => {
      setupUserApis()
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        enrollment_mode: enrollmentMode,
        b2b_contract_id: b2bContractId,
        certificate: null,
        run,
      })
      renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
      expect(!!within(getCard()).queryByTestId("upgrade-root")).toBe(
        expectation.visible,
      )
    },
  )

  test("Does not show upgrade banner when upgrade deadline has passed", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: null,
      run: {
        ...currentRunDates,
        is_upgradable: true,
        upgrade_deadline: moment().subtract(1, "day").toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getCard()).queryByTestId("upgrade-root"),
    ).not.toBeInTheDocument()
  })

  test("Does not show upgrade banner when upgrade_product_is_active is missing", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      run: {
        is_upgradable: true,
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: null,
      },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getCard()).queryByTestId("upgrade-root"),
    ).not.toBeInTheDocument()
  })

  test("Never shows upgrade banner for B2B enrollment", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: faker.number.int(),
      run: {
        is_upgradable: true,
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getCard()).queryByTestId("upgrade-root"),
    ).not.toBeInTheDocument()
  })

  test("Upgrade banner shows correct price and deadline", () => {
    setupUserApis()
    const price = faker.commerce.price()
    const deadline = moment()
      .startOf("day")
      .add(5, "days")
      .add(3, "hours")
      .toISOString()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: null,
      certificate: null,
      run: {
        is_upgradable: true,
        upgrade_deadline: deadline,
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: price,
        upgrade_product_is_active: true,
      },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    const banner = within(getCard()).getByTestId("upgrade-root")
    expect(banner).toHaveTextContent(`Upgrade for certificate - $${price}`)
    expect(banner).toHaveTextContent(/5 days remaining/)
  })

  test("Upgrade banner shows price without deadline when deadline is null", () => {
    setupUserApis()
    const price = faker.commerce.price()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: null,
      certificate: null,
      run: {
        is_upgradable: true,
        upgrade_deadline: null,
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: price,
        upgrade_product_is_active: true,
      },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    const banner = within(getCard()).getByTestId("upgrade-root")
    expect(banner).toHaveTextContent(`Upgrade for certificate - $${price}`)
    expect(banner).not.toHaveTextContent(/days? remaining/)
  })

  test("Clicking upgrade link adds product to basket and redirects to cart", async () => {
    const assign = jest.mocked(window.location.assign)
    setupUserApis()
    const productId = faker.number.int()
    const price = faker.commerce.price()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: null,
      certificate: null,
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: productId,
        upgrade_product_price: price,
        upgrade_product_is_active: true,
      },
    })
    const clearUrl = mitxonline.urls.baskets.clear()
    setMockResponse.delete(clearUrl, undefined)
    const basketUrl = mitxonline.urls.baskets.createFromProduct(productId)
    setMockResponse.post(basketUrl, { id: 1, items: [] })

    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    await user.click(
      within(getCard()).getByRole("link", { name: /Upgrade for certificate/ }),
    )

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "delete", url: clearUrl }),
    )
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", url: basketUrl }),
    )
    expect(assign).toHaveBeenCalledWith(mitxonlineLegacyUrl("/cart/"))
  })

  test("Calls onUpgradeError when basket API fails", async () => {
    setupUserApis()
    const productId = faker.number.int()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: null,
      certificate: null,
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: productId,
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
    })
    setMockResponse.delete(mitxonline.urls.baskets.clear(), undefined)
    setMockResponse.post(
      mitxonline.urls.baskets.createFromProduct(productId),
      { error: "Server error" },
      { code: 500 },
    )
    const onUpgradeError = jest.fn()

    renderWithProviders(
      <EnrolledCourseCard
        enrollment={enrollment}
        onUpgradeError={onUpgradeError}
      />,
    )
    await user.click(
      within(getCard()).getByRole("link", { name: /Upgrade for certificate/ }),
    )
    await waitFor(() => {
      expect(onUpgradeError).toHaveBeenCalledWith(
        "There was a problem adding the certificate to your cart.",
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Upgrade banner — verified program enrollment (one-click, no checkout)
  // ---------------------------------------------------------------------------

  test("Shows 'Upgrade for certificate' without a price when the program enrollment is verified", () => {
    setupUserApis()
    const price = faker.commerce.price()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: null,
      certificate: null,
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: price,
        upgrade_product_is_active: true,
      },
    })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: "verified",
      })

    renderWithProviders(
      <EnrolledCourseCard
        enrollment={enrollment}
        ancestorContext={{ programEnrollment }}
      />,
    )
    const banner = within(getCard()).getByTestId("upgrade-root")
    expect(banner).toHaveTextContent("Upgrade for certificate")
    expect(banner).not.toHaveTextContent(`$${price}`)
  })

  test("Clicking upgrade link one-click enrolls in verified mode and redirects to courseware when program enrollment is verified", async () => {
    setupUserApis()
    const coursewareUrl = faker.internet.url()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: null,
      certificate: null,
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
        courseware_url: coursewareUrl,
      },
    })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: "verified",
      })
    const programEnrollmentEndpoint =
      mitxonline.urls.verifiedProgramEnrollments.create(
        enrollment.run.courseware_id,
      )
    setMockResponse.post(programEnrollmentEndpoint, {})

    renderWithProviders(
      <EnrolledCourseCard
        enrollment={enrollment}
        ancestorContext={{ programEnrollment }}
      />,
    )
    await user.click(
      within(getCard()).getByRole("link", { name: "Upgrade for certificate" }),
    )

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: programEnrollmentEndpoint,
        }),
      )
    })
    await waitFor(() => {
      expect(window.location.href).toBe(coursewareUrl)
    })
  })

  test("Calls onUpgradeError when verified program enrollment API fails", async () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      b2b_contract_id: null,
      certificate: null,
      run: {
        is_upgradable: true,
        upgrade_deadline: faker.date.future().toISOString(),
        upgrade_product_id: faker.number.int(),
        upgrade_product_price: faker.commerce.price(),
        upgrade_product_is_active: true,
      },
    })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: "verified",
      })
    setMockResponse.post(
      mitxonline.urls.verifiedProgramEnrollments.create(
        enrollment.run.courseware_id,
      ),
      { error: "Server error" },
      { code: 500 },
    )
    const onUpgradeError = jest.fn()

    renderWithProviders(
      <EnrolledCourseCard
        enrollment={enrollment}
        ancestorContext={{ programEnrollment }}
        onUpgradeError={onUpgradeError}
      />,
    )
    await user.click(
      within(getCard()).getByRole("link", { name: "Upgrade for certificate" }),
    )
    await waitFor(() => {
      expect(onUpgradeError).toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Upgraded (paid, certificate not yet earned) banner
  // ---------------------------------------------------------------------------

  test("Shows 'Certificate track' for verified enrollment without a certificate", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Verified,
      certificate: null,
      grades: [],
      run: currentRunDates,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(within(getCard()).getByTestId("upgraded-banner")).toHaveTextContent(
      "Certificate track",
    )
  })

  test("Shows 'View Certificate' in place of 'Certificate track' when verified enrollment has a certificate", () => {
    setupUserApis()
    const certUuid = faker.string.uuid()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Verified,
      certificate: { uuid: certUuid, link: faker.internet.url() },
      run: currentRunDates,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getCard()).queryByTestId("upgraded-banner"),
    ).not.toBeInTheDocument()
    expect(
      within(getCard()).getAllByRole("link", { name: /View Certificate/ }),
    ).toHaveLength(1)
  })

  test("Does not show 'Certificate track' for audit enrollment", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      certificate: null,
      grades: [],
      run: currentRunDates,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getCard()).queryByTestId("upgraded-banner"),
    ).not.toBeInTheDocument()
  })

  test("Does not show 'Certificate track' for B2B verified enrollment", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Verified,
      b2b_contract_id: faker.number.int(),
      certificate: null,
      grades: [],
      run: currentRunDates,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getCard()).queryByTestId("upgraded-banner"),
    ).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Context menu
  // ---------------------------------------------------------------------------

  test("context menu includes View Course Details linking to coursePageView URL", async () => {
    setupUserApis()
    const readableId = "test-course-readable-id"
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: { course: { readable_id: readableId } },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    const item = screen.getByRole("menuitem", { name: "View Course Details" })
    expect(item).toBeInTheDocument()
    expect(item).toHaveAttribute("href", expect.stringContaining(readableId))
  })

  test("context menu hides View Course Details for B2B enrollment", async () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: faker.number.int(),
      run: { course: { readable_id: "some-course-id" } },
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.queryByRole("menuitem", { name: "View Course Details" }),
    ).not.toBeInTheDocument()
  })

  test("context menu includes Email Settings and Unenroll", async () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      grades: [],
      certificate: null,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.getByRole("menuitem", { name: "Email Settings" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "Unenroll" }),
    ).toBeInTheDocument()
  })

  test("Receipt appears in context menu for verified enrollment", async () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Verified,
      grades: [mitxonline.factories.enrollment.grade({ passed: true })],
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.getByRole("menuitem", { name: "Receipt" }),
    ).toBeInTheDocument()
  })

  test("Receipt does not appear for audit enrollment", async () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      grades: [],
      certificate: null,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.queryByRole("menuitem", { name: "Receipt" }),
    ).not.toBeInTheDocument()
  })

  test("Receipt links to correct MITx Online URL for verified enrollment", async () => {
    setupUserApis()
    const runId = faker.number.int()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Verified,
      grades: [mitxonline.factories.enrollment.grade({ passed: true })],
      run: { id: runId },
    })
    const windowOpenSpy = jest
      .spyOn(window, "open")
      .mockImplementation(() => null)

    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    await user.click(screen.getByRole("menuitem", { name: "Receipt" }))

    expect(windowOpenSpy).toHaveBeenCalledWith(
      mitxonlineLegacyUrl(`/orders/receipt/by-run/${runId}/`),
      "_blank",
      "noopener,noreferrer",
    )
    windowOpenSpy.mockRestore()
  })
})

describe("EnrolledCourseCard — multiple enrollment runs", () => {
  setupLocationMock()

  test("shows accordion on desktop when siblingEnrollments is non-empty", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: currentRunDates,
    })
    const siblings = [
      mitxonline.factories.enrollment.courseEnrollment(),
      mitxonline.factories.enrollment.courseEnrollment(),
    ]
    renderWithProviders(
      <EnrolledCourseCard
        enrollment={enrollment}
        siblingEnrollments={siblings}
      />,
    )
    const desktopCard = screen.getByTestId("enrollment-card-desktop")
    // 2 siblings + 1 current = 3
    expect(within(desktopCard).getByText("Course runs (3)")).toBeInTheDocument()
  })

  test("does not show accordion on desktop when siblingEnrollments is empty", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment()
    renderWithProviders(
      <EnrolledCourseCard enrollment={enrollment} siblingEnrollments={[]} />,
    )
    expect(screen.queryByText(/Course runs/)).not.toBeInTheDocument()
  })

  test("does not show accordion when siblingEnrollments is omitted", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment()
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(screen.queryByText(/Course runs/)).not.toBeInTheDocument()
  })

  test("shows accordion on mobile when siblingEnrollments is non-empty", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment()
    const sibling = mitxonline.factories.enrollment.courseEnrollment()
    renderWithProviders(
      <EnrolledCourseCard
        enrollment={enrollment}
        siblingEnrollments={[sibling]}
      />,
    )
    const mobileCard = screen.getByTestId("enrollment-card-mobile")
    expect(within(mobileCard).getByText("Course runs (2)")).toBeInTheDocument()
  })

  test("accordion count reflects total runs (siblings + current)", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment()
    const siblings = Array.from({ length: 4 }, () =>
      mitxonline.factories.enrollment.courseEnrollment(),
    )
    renderWithProviders(
      <EnrolledCourseCard
        enrollment={enrollment}
        siblingEnrollments={siblings}
      />,
    )
    expect(screen.getAllByText("Course runs (5)").length).toBeGreaterThan(0)
  })
})

// The enrollment status icon only renders for compact program module rows
// (i.e. within ProgramAsCourseCard), and even then only for non-B2B
// enrollments. Every other card conveys progress via the ProgressBadge shown
// next to the card type label instead.
describe("EnrolledCourseCard enrollment status icon (module rows)", () => {
  setupLocationMock()

  const getDesktopCard = () => screen.getByTestId("enrollment-card-desktop")

  test.each([
    {
      enrollmentData: { grades: [], certificate: null },
      expectedLabel: "Enrolled",
    },
    {
      enrollmentData: {
        grades: [mitxonline.factories.enrollment.grade({ passed: true })],
        certificate: {
          uuid: faker.string.uuid(),
          link: faker.internet.url(),
        },
      },
      expectedLabel: "Completed",
    },
  ])(
    "Module row shows '$expectedLabel' status icon",
    ({ enrollmentData, expectedLabel }) => {
      setupUserApis()
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        ...enrollmentData,
        b2b_contract_id: null,
      })
      renderWithProviders(
        <EnrolledCourseCard
          enrollment={enrollment}
          isModule
          layout="compact"
        />,
      )
      expect(
        within(getDesktopCard()).getByTestId("enrollment-status"),
      ).toHaveTextContent(expectedLabel)
    },
  )

  test("hidden for B2B module rows", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      grades: [],
      certificate: null,
      b2b_contract_id: faker.number.int(),
    })
    renderWithProviders(
      <EnrolledCourseCard enrollment={enrollment} isModule layout="compact" />,
    )
    expect(
      within(getDesktopCard()).queryByTestId("enrollment-status"),
    ).not.toBeInTheDocument()
  })

  test("hidden for non-module cards", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(
      within(getDesktopCard()).queryByTestId("enrollment-status"),
    ).not.toBeInTheDocument()
  })
})

describe("EnrolledCourseCard card type label", () => {
  setupLocationMock()

  const getDesktopCard = () => screen.getByTestId("enrollment-card-desktop")

  test("shows 'Course' for a non-B2B enrollment", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(within(getDesktopCard()).getByText("Course")).toBeInTheDocument()
    expect(
      within(getDesktopCard()).queryByText("Module"),
    ).not.toBeInTheDocument()
  })

  test("shows 'Module' for a B2B enrollment", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: faker.number.int(),
    })
    renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
    expect(within(getDesktopCard()).getByText("Module")).toBeInTheDocument()
    expect(
      within(getDesktopCard()).queryByText("Course"),
    ).not.toBeInTheDocument()
  })

  test("shows enrollment status indicator instead of 'Module' text when isModule is set (compact layout)", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      grades: [],
      certificate: null,
    })
    renderWithProviders(
      <EnrolledCourseCard enrollment={enrollment} isModule layout="compact" />,
    )
    expect(
      within(getDesktopCard()).getByTestId("enrollment-status"),
    ).toBeInTheDocument()
    expect(
      within(getDesktopCard()).queryByText("Module"),
    ).not.toBeInTheDocument()
  })
})

describe("EnrolledCourseCard progress badge", () => {
  setupLocationMock()

  const getDesktopCard = () => screen.getByTestId("enrollment-card-desktop")

  test.each([
    {
      enrollmentData: { grades: [], certificate: null },
      expectedLabel: "In Progress",
    },
    {
      enrollmentData: {
        grades: [mitxonline.factories.enrollment.grade({ passed: true })],
        certificate: {
          uuid: faker.string.uuid(),
          link: faker.internet.url(),
        },
      },
      expectedLabel: "Completed",
    },
  ])(
    "shows '$expectedLabel' next to the card type label",
    ({ enrollmentData, expectedLabel }) => {
      setupUserApis()
      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        ...enrollmentData,
        b2b_contract_id: null,
      })
      renderWithProviders(<EnrolledCourseCard enrollment={enrollment} />)
      expect(
        within(getDesktopCard()).getByTestId("progress-badge"),
      ).toHaveTextContent(expectedLabel)
    },
  )

  test("hidden on compact module rows, where the status icon takes over", () => {
    setupUserApis()
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
    })
    renderWithProviders(
      <EnrolledCourseCard enrollment={enrollment} isModule layout="compact" />,
    )
    expect(
      within(getDesktopCard()).queryByTestId("progress-badge"),
    ).not.toBeInTheDocument()
  })
})

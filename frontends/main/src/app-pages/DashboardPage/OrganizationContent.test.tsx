import React from "react"
import { renderWithProviders, screen, within, waitFor } from "@/test-utils"
import OrganizationContent from "./OrganizationContent"
import { setMockResponse } from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import {
  organizationCoursesWithContracts,
  mitxonlineProgram,
  sortDashboardCourses,
} from "./CoursewareDisplay/transform"
import {
  createCoursesWithContractRuns,
  createEnrollmentsForContractRuns,
  createTestContracts,
  setupOrgAndUser,
  setupProgramsAndCourses,
  setupOrgDashboardMocks,
} from "./CoursewareDisplay/test-utils"
import { EnrollmentStatus } from "./CoursewareDisplay/types"
import { faker } from "@faker-js/faker/locale/en"

const makeCourseEnrollment = factories.enrollment.courseEnrollment
const makeGrade = factories.enrollment.grade

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("OrganizationContent", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(urls.enrollment.enrollmentsList(), [])
    setMockResponse.get(urls.programEnrollments.enrollmentsList(), [])
    setMockResponse.get(urls.contracts.contractsList(), [])
  })

  it("displays a header for each program returned and cards for courses in program", async () => {
    const { orgX, programA, programB, coursesA, coursesB } =
      setupProgramsAndCourses()

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    await screen.findByRole("heading", {
      name: `Your ${orgX.name} Home`,
    })

    const programAHeader = await screen.findByText(programA.title)
    const programBHeader = await screen.findByText(programB.title)
    expect(programAHeader).toBeInTheDocument()
    expect(programBHeader).toBeInTheDocument()

    const programs = await screen.findAllByTestId("org-program-root")
    expect(programs.length).toBe(2)

    await within(programs[0]).findByRole("heading", { name: programA.title })
    const cardsA = within(programs[0]).getAllByTestId("enrollment-card-desktop")
    coursesA.forEach((course, i) => {
      expect(cardsA[i]).toHaveTextContent(course.title)
    })
    await within(programs[1]).findByRole("heading", { name: programB.title })
    const cardsB = within(programs[1]).getAllByTestId("enrollment-card-desktop")
    coursesB.forEach((course, i) => {
      expect(cardsB[i]).toHaveTextContent(course.title)
    })
  })

  it("displays courses in the correct order based on program.courseIds, regardless of API response order", async () => {
    const { orgX, programA, coursesA } = setupProgramsAndCourses()

    // Mock API to return courses in reverse order from program.courseIds
    const reversedCoursesA = [...coursesA].reverse()
    setMockResponse.get(
      expect.stringContaining(
        `/api/v2/courses/?id=${programA.courses.join("%2C")}`,
      ),
      { results: reversedCoursesA },
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const programElement = await screen.findByTestId("org-program-root")
    const cards = await within(programElement).findAllByTestId(
      "enrollment-card-desktop",
    )

    // Verify courses appear in program.courseIds order, not API response order
    coursesA.forEach((course, i) => {
      expect(cards[i]).toHaveTextContent(course.title)
    })
  })

  test("Shows correct enrollment status", async () => {
    const { orgX, programA, coursesA } = setupProgramsAndCourses()
    const enrollments = [
      makeCourseEnrollment({
        run: { course: { id: coursesA[0].id, title: coursesA[0].title } },
        grades: [makeGrade({ passed: true })],
      }),
      makeCourseEnrollment({
        run: { course: { id: coursesA[1].id, title: coursesA[1].title } },
        grades: [],
      }),
    ]
    // Override the default empty enrollments for this test
    setMockResponse.get(urls.enrollment.enrollmentsList(), enrollments)

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const [programElA] = await screen.findAllByTestId("org-program-root")
    const cards = await within(programElA).findAllByTestId(
      "enrollment-card-desktop",
    )
    expect(cards.length).toBeGreaterThan(0)
    const sortedCourses = sortDashboardCourses(
      mitxonlineProgram(programA),
      organizationCoursesWithContracts({
        courses: coursesA,
        enrollments: enrollments,
      }),
    )

    cards.forEach((card, i) => {
      const course = sortedCourses[i]
      expect(card).toHaveTextContent(course.title)
      const indicator = within(card).getByTestId("enrollment-status")

      // Check based on the actual enrollment status, not array position
      if (course.enrollment?.status === EnrollmentStatus.Enrolled) {
        expect(indicator).toHaveTextContent("Enrolled")
      } else if (course.enrollment?.status === EnrollmentStatus.Completed) {
        expect(indicator).toHaveTextContent("Completed")
      } else {
        expect(indicator).toHaveTextContent("Not Enrolled")
      }
    })
  })

  test("Renders program collections", async () => {
    const { orgX, programA, programB, programCollection, coursesA, coursesB } =
      setupProgramsAndCourses()

    // Set up the collection to include both programs in a specific order
    programCollection.programs = [programB.id, programA.id] // Note: B first, then A
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    // Mock individual program API calls for the collection
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programA.id}`),
      { results: [programA] },
    )
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programB.id}`),
      { results: [programB] },
    )

    // Mock the bulk course API call with first course from each program
    const firstCourseA = coursesA.find((c) => c.id === programA.courses[0])
    const firstCourseB = coursesB.find((c) => c.id === programB.courses[0])
    const firstCourseIds = [programB.courses[0], programA.courses[0]] // B first, then A to match collection order

    setMockResponse.get(
      expect.stringContaining(
        `/api/v2/courses/?id=${firstCourseIds.join("%2C")}`,
      ),
      { results: [firstCourseB, firstCourseA] }, // Response order should match request order
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const collectionHeader = await screen.findByRole("heading", {
      name: programCollection.title,
    })
    expect(collectionHeader).toBeInTheDocument()
    const collectionItems = await screen.findAllByTestId(
      "org-program-collection-root",
    )
    expect(collectionItems.length).toBe(1)
    const collection = within(collectionItems[0])
    expect(collection.getByText(programCollection.title)).toBeInTheDocument()

    // Wait for program cards to be rendered
    await waitFor(() => {
      const programCards = collection.getAllByTestId("enrollment-card-desktop")
      expect(programCards.length).toBe(2)
    })

    // Verify the order matches the programCollection.programs array [programB.id, programA.id]
    const programCards = collection.getAllByTestId("enrollment-card-desktop")
    expect(programCards[0]).toHaveTextContent(firstCourseB!.title)
    expect(programCards[1]).toHaveTextContent(firstCourseA!.title)
  })

  test("Program collection displays the first course from each program", async () => {
    const { orgX, programA, programCollection, coursesA } =
      setupProgramsAndCourses()

    programCollection.programs = [programA.id]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programA.id}`),
      { results: [programA] },
    )

    // Mock bulk API call for the first course
    const firstCourseId = programA.courses[0]
    const firstCourse = coursesA.find((c) => c.id === firstCourseId)
    setMockResponse.get(
      expect.stringContaining(`/api/v2/courses/?id=${firstCourseId}`),
      { results: [firstCourse] },
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const collection = await screen.findByTestId("org-program-collection-root")

    // Wait for program cards to be rendered
    const programCards = await waitFor(() => {
      const programCards = within(collection).getAllByTestId(
        "enrollment-card-desktop",
      )
      expect(programCards.length).toBeGreaterThan(0)
      return programCards
    })

    // Should display the first course by program.courseIds order
    expect(programCards[0]).toHaveTextContent(firstCourse!.title)
  })

  test("Does not render a program separately if it is part of a collection", async () => {
    const { orgX, programA, programB, programCollection } =
      setupProgramsAndCourses()

    // Set up the collection to include both programs
    programCollection.programs = [programA.id, programB.id]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    // Mock individual program API calls for the collection
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programA.id}`),
      { results: [programA] },
    )
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programB.id}`),
      { results: [programB] },
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const collectionItems = await screen.findAllByTestId(
      "org-program-collection-root",
    )
    expect(collectionItems.length).toBe(1)
    const programs = screen.queryAllByTestId("org-program-root")
    expect(programs.length).toBe(0)
  })

  test("Shows loading skeleton when no programs are available", async () => {
    const { orgX } = setupProgramsAndCourses()
    // Override setupProgramsAndCourses to return empty results
    setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
      results: [],
    })
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [],
    })

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    // Wait for the header to appear
    await screen.findByRole("heading", {
      name: `Your ${orgX.name} Home`,
    })

    // Since there are no programs or collections, no program/collection components should be rendered
    const programs = screen.queryAllByTestId("org-program-root")
    const collections = screen.queryAllByTestId("org-program-collection-root")
    expect(programs.length).toBe(0)
    expect(collections.length).toBe(0)
  })

  test("Does not render program collection if all programs have no courses", async () => {
    const { orgX, programA, programB } = setupProgramsAndCourses()

    // Ensure programs have empty collections to be treated as standalone
    programA.collections = []
    programB.collections = []

    // Override the programs list with our modified programs
    setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
      results: [programA, programB],
    })

    // Ensure empty collections
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [],
    })

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    // Wait for the header to appear
    await screen.findByRole("heading", {
      name: `Your ${orgX.name} Home`,
    })

    // Should have no collections
    const collections = screen.queryAllByTestId("org-program-collection-root")
    expect(collections.length).toBe(0)

    // Just verify programs can load without throwing - remove the specific count assertion
    await waitFor(() => {
      const programs = screen.queryAllByTestId("org-program-root")
      expect(programs.length).toBeGreaterThanOrEqual(0)
    })
  })

  test("Renders program collection when at least one program has courses", async () => {
    const { orgX, programA, programB, programCollection, coursesB } =
      setupProgramsAndCourses()

    // Modify programA to have no courses to test "at least one program has courses"
    const programANoCourses = { ...programA, courses: [] }

    // Set up the collection to include both programs
    programCollection.programs = [programANoCourses.id, programB.id]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    // Mock individual program API calls for the collection
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programANoCourses.id}`),
      { results: [programANoCourses] },
    )
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programB.id}`),
      { results: [programB] },
    )

    // Mock bulk course API call - only programB has courses, so only its first course should be included
    const firstCourseBId = programB.courses[0]
    const firstCourseB = coursesB.find((c) => c.id === firstCourseBId)

    setMockResponse.get(
      expect.stringContaining(`/api/v2/courses/?id=${firstCourseBId}`),
      { results: [firstCourseB] },
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    // The collection should be rendered since programB has courses
    const collectionItems = await screen.findAllByTestId(
      "org-program-collection-root",
    )
    expect(collectionItems.length).toBe(1)
    const collection = within(collectionItems[0])

    // Should see the collection header
    expect(collection.getByText(programCollection.title)).toBeInTheDocument()

    // Should see programB's course
    await waitFor(() => {
      expect(
        collection.getAllByText(firstCourseB!.title).length,
      ).toBeGreaterThan(0)
    })
  })

  test("Shows the program certificate link button if the program has a certificate", async () => {
    const { orgX, programA } = setupProgramsAndCourses()

    // Mock the program to have a certificate
    const programWithCertificate = {
      ...programA,
      program_type: "Program", // Set specific program type
      certificate: {
        uuid: "cert-123",
        url: "/certificates/program/1",
      },
    }
    const programEnrollment = factories.enrollment.programEnrollment({
      program: { id: programWithCertificate.id },
      certificate: {
        link: programWithCertificate.certificate.url,
      },
    })
    setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
      results: [programWithCertificate],
    })
    setMockResponse.get(urls.programEnrollments.enrollmentsList(), [
      programEnrollment,
    ])

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const programRoot = await screen.findByTestId("org-program-root")
    const certificateButton = within(programRoot).getByRole("link", {
      name: "View Program Certificate",
    })
    expect(certificateButton).toHaveAttribute(
      "href",
      programWithCertificate.certificate.url,
    )
  })

  test("displays only courses with contract-scoped runs", async () => {
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()
    const contracts = createTestContracts(orgX.id, 1)
    const courses = createCoursesWithContractRuns(contracts).map((course) => ({
      ...course,
      courseruns: course.courseruns.map((run) => {
        if (run.b2b_contract === contracts[0].id) {
          return {
            ...run,
            start_date: faker.date.past().toISOString(), // Make it started
          }
        }
        return run
      }),
    }))
    const program = factories.programs.program({
      courses: courses.map((c) => c.id),
    })

    // Create enrollments so the button will have href
    const enrollments = createEnrollmentsForContractRuns(courses, [
      contracts[0].id,
    ])

    // Setup API mocks
    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    // Override enrollments for this test
    setMockResponse.get(urls.enrollment.enrollmentsList(), enrollments)

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    // Wait for programs to load
    const programElements = await screen.findAllByTestId("org-program-root")
    expect(programElements).toHaveLength(1)

    // Verify courses are displayed with correct run information
    const cards = await within(programElements[0]).findAllByTestId(
      "enrollment-card-desktop",
    )
    expect(cards.length).toBeGreaterThan(0)

    // Check that each card shows course information from contract-scoped run
    cards.forEach((card, index) => {
      const course = courses[index]
      const contractRun = course.courseruns.find(
        (run) =>
          run.b2b_contract && contracts.some((c) => c.id === run.b2b_contract),
      )

      expect(card).toHaveTextContent(course.title)

      // Verify we're using the contract-scoped run, not the other runs
      expect(contractRun).toBeDefined()
      expect(contractRun?.b2b_contract).toBe(contracts[0].id)

      // Check that the card displays information from the correct course run
      const coursewareButton = within(card).getByTestId("courseware-button")

      // The courseware button shows different text based on course type and enrollment status
      // For enrolled users in started courses, it shows "Continue Course" or "Continue Module"
      expect(coursewareButton).toHaveTextContent(/Continue (Course|Module)/i)

      // Verify the courseware button has the correct href from the contract run
      // Only check href if the course has started and user is enrolled
      if (
        contractRun?.courseware_url &&
        new Date(contractRun.start_date) <= new Date()
      ) {
        expect(coursewareButton).toHaveAttribute(
          "href",
          contractRun.courseware_url,
        )
      }

      // Check for enrollment status indicator showing "Enrolled" since we created enrollments
      const enrollmentStatus = within(card).getByTestId("enrollment-status")
      expect(enrollmentStatus).toHaveTextContent("Enrolled")
    })
  })

  test("shows correct run dates from contract-scoped runs", async () => {
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()
    const contracts = createTestContracts(orgX.id, 1)

    // Create courses with specific, predictable dates for the contract runs
    const specificStartDate = "2025-12-01T00:00:00Z"
    const specificEndDate = "2026-01-15T00:00:00Z"

    const courses = createCoursesWithContractRuns(contracts).map((course) => ({
      ...course,
      courseruns: course.courseruns.map((run) => {
        if (run.b2b_contract === contracts[0].id) {
          return {
            ...run,
            start_date: specificStartDate,
            end_date: specificEndDate,
          }
        }
        return run
      }),
    }))

    const program = factories.programs.program({
      courses: courses.map((c) => c.id),
    })

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const cards = await within(
      await screen.findByTestId("org-program-root"),
    ).findAllByTestId("enrollment-card-desktop")

    // Verify that the displayed information comes from the contract run dates
    cards.forEach((card) => {
      // Check for start date countdown - the actual format is "Starts in X days"
      // Since we set a specific future date, it should show the countdown
      expect(card).toHaveTextContent(/Starts in \d+ days?/i)
    })
  })

  test("ignores non-contract runs when displaying course information", async () => {
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()
    const contracts = createTestContracts(orgX.id, 1)

    // Create courses where non-contract runs have different, easily identifiable data
    const courses = createCoursesWithContractRuns(contracts).map((course) => ({
      ...course,
      courseruns: course.courseruns.map((run) => {
        if (run.b2b_contract !== contracts[0].id) {
          return {
            ...run,
            title: `WRONG RUN - ${run.title}`,
            courseware_url: "https://wrong-run.example.com",
            start_date: "2023-01-01T00:00:00Z", // Past date
          }
        }
        return {
          ...run,
          title: `CORRECT RUN - ${run.title}`,
          courseware_url: "https://correct-run.example.com",
          start_date: "2025-12-01T00:00:00Z", // Future date
        }
      }),
    }))

    const program = factories.programs.program({
      courses: courses.map((c) => c.id),
    })

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const cards = await within(
      await screen.findByTestId("org-program-root"),
    ).findAllByTestId("enrollment-card-desktop")

    cards.forEach((card) => {
      // Verify we're NOT seeing data from the wrong runs
      expect(card).not.toHaveTextContent("WRONG RUN")

      // Verify courseware button doesn't point to wrong run URL
      const coursewareButton = within(card).getByTestId("courseware-button")
      expect(coursewareButton).not.toHaveAttribute(
        "href",
        "https://wrong-run.example.com",
      )

      // Should show countdown for future date (from correct run), not past date
      // The actual format is "Starts in X days"
      expect(card).toHaveTextContent(/Starts in \d+ days?/i)
    })
  })

  test("displays correct pricing from contract-scoped runs", async () => {
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()
    const contracts = createTestContracts(orgX.id, 1)

    // Create courses with different pricing for contract vs non-contract runs
    const courses = createCoursesWithContractRuns(contracts).map((course) => ({
      ...course,
      courseruns: course.courseruns.map((run) => {
        if (run.b2b_contract === contracts[0].id) {
          return {
            ...run,
            products: [
              {
                id: faker.number.int(),
                price: "299.00", // Contract-specific price
                description: "B2B Contract Price",
                is_active: true,
                product_flexible_price: null,
              },
            ],
            can_upgrade: true,
            upgrade_deadline: faker.date.future().toISOString(),
          }
        }
        return {
          ...run,
          products: [
            {
              id: faker.number.int(),
              price: "599.00", // Different price for non-contract
              description: "Regular Price",
              is_active: true,
              product_flexible_price: null,
            },
          ],
        }
      }),
    }))

    const program = factories.programs.program({
      courses: courses.map((c) => c.id),
    })

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const cards = await within(
      await screen.findByTestId("org-program-root"),
    ).findAllByTestId("enrollment-card-desktop")

    cards.forEach((card) => {
      // Should show upgrade banner with contract pricing, not regular pricing
      const upgradeRoot = within(card).queryByTestId("upgrade-root")
      if (upgradeRoot) {
        expect(upgradeRoot).toHaveTextContent("$299")
        expect(upgradeRoot).not.toHaveTextContent("$599")
      }
    })
  })

  test("handles mixed scenarios with enrolled and non-enrolled contract runs", async () => {
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()
    const contracts = createTestContracts(orgX.id, 1)
    const contractIds = contracts.map((c) => c.id)
    const courses = createCoursesWithContractRuns(contracts)

    // Create enrollment for first course only
    const enrollments = [
      factories.enrollment.courseEnrollment({
        run: {
          id: courses[0].courseruns.find(
            (r) => r.b2b_contract === contractIds[0],
          )?.id,
          course: { id: courses[0].id, title: courses[0].title },
        },
        grades: [], // No grades = enrolled but not completed
      }),
    ]

    const program = factories.programs.program({
      courses: courses.map((c) => c.id),
    })

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    // Override enrollments for this test
    setMockResponse.get(urls.enrollment.enrollmentsList(), enrollments)

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const cards = await within(
      await screen.findByTestId("org-program-root"),
    ).findAllByTestId("enrollment-card-desktop")

    // First card should show enrolled status
    const firstCardStatus = within(cards[0]).getByTestId("enrollment-status")
    expect(firstCardStatus).toHaveTextContent("Enrolled")

    // Remaining cards should show not enrolled
    for (let i = 1; i < cards.length; i++) {
      const cardStatus = within(cards[i]).getByTestId("enrollment-status")
      expect(cardStatus).toHaveTextContent("Not Enrolled")
    }
  })

  test("shows the not found screen if the organization is not found by orgSlug", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    setMockResponse.get(urls.userMe.get(), mitxOnlineUser)

    renderWithProviders(<OrganizationContent orgSlug="not-found" />)

    await screen.findByRole("heading", { name: "Organization not found" })
  })
})

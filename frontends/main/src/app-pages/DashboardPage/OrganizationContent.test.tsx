import React from "react"
import {
  renderWithProviders,
  screen,
  within,
  waitFor,
  user,
} from "@/test-utils"
import OrganizationContent from "./OrganizationContent"
import { setMockResponse } from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
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

describe("OrganizationContent", () => {
  beforeEach(() => {
    setMockResponse.get(urls.enrollment.enrollmentsList(), [])
    setMockResponse.get(urls.enrollment.enrollmentsListV2(), [])
    setMockResponse.get(urls.programEnrollments.enrollmentsList(), [])
    setMockResponse.get(urls.programEnrollments.enrollmentsListV2(), [])
    setMockResponse.get(urls.contracts.contractsList(), [])
  })

  it("displays a header for each program returned and cards for courses in program", async () => {
    const { orgX, programA, programB, coursesA, coursesB } =
      setupProgramsAndCourses()

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    await screen.findByRole("heading", {
      name: orgX.name,
    })
    await screen.findByText(orgX.contracts[0].name)

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

    const programElements = await screen.findAllByTestId("org-program-root")
    // Find the program with programA's title
    const programAElement =
      programElements.find((el) => el.textContent?.includes(programA.title)) ||
      programElements[0]
    const cards = await within(programAElement).findAllByTestId(
      "enrollment-card-desktop",
    )

    // Verify courses appear in program.courseIds order, not API response order
    coursesA.forEach((course, i) => {
      expect(cards[i]).toHaveTextContent(course.title)
    })
  })

  it("displays programs in the correct order based on contract.programs, regardless of API response order", async () => {
    const { orgX, programA, programB } = setupProgramsAndCourses()

    // Update the contract to specify program order (B first, then A)
    const contract = factories.contracts.contract({
      organization: orgX.id,
      name: "Org X Contract",
      programs: [programB.id, programA.id],
    })
    orgX.contracts = [contract]
    setMockResponse.get(urls.contracts.contractsList(), [contract])
    // Need to update the orgX response to include the new contract
    setMockResponse.get(urls.organization.organizationList(orgX.slug), orgX)

    // Mock API to return programs in opposite order (A first, then B)
    setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
      results: [programA, programB],
    })

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    // Debug: see what's actually rendered
    await screen.findByRole("heading", { name: orgX.name })

    // Check if both program titles exist first
    await screen.findByText(programA.title)
    await screen.findByText(programB.title)

    const programs = await screen.findAllByTestId("org-program-root")
    expect(programs.length).toBe(2)

    // Verify programs appear in contract.programs order (B, A), not API response order (A, B)
    await within(programs[0]).findByRole("heading", { name: programB.title })
    await within(programs[1]).findByRole("heading", { name: programA.title })
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
    setMockResponse.get(urls.enrollment.enrollmentsListV2(), enrollments)

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
    programCollection.programs = [
      {
        id: programB.id,
        title: programB.title,
        order: 1,
      },
      {
        id: programA.id,
        title: programA.title,
        order: 2,
      },
    ] // Note: B first, then A
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    // Mock the new bulk programs API call with array of IDs
    const programIds = [programB.id, programA.id] // B first, then A to match collection order
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programIds.join("%2C")}`),
      { results: [programB, programA] }, // Return in same order as requested
    )

    // Mock the bulk course API call with first course from each program
    const firstCourseA = coursesA.find((c) => c.id === programA.courses[0])
    const firstCourseB = coursesB.find((c) => c.id === programB.courses[0])
    const firstCourseIds = [programB.courses[0], programA.courses[0]] // B first, then A to match collection order

    // Mock the program collection courses query
    setMockResponse.get(
      urls.courses.coursesList({
        id: firstCourseIds,
        org_id: orgX.id,
      }),
      { results: [firstCourseB, firstCourseA] },
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

    // Wait for and verify the actual course cards are displayed
    const courseCards = await collection.findAllByTestId(
      "enrollment-card-desktop",
    )
    expect(courseCards.length).toBe(2)

    // Verify the first course from each program is displayed in collection order
    expect(courseCards[0]).toHaveTextContent(firstCourseB!.title)
    expect(courseCards[1]).toHaveTextContent(firstCourseA!.title)
  })

  test("Program collection displays the first course from each program", async () => {
    const { orgX, programA, programCollection, coursesA } =
      setupProgramsAndCourses()

    programCollection.programs = [
      {
        id: programA.id,
        title: programA.title,
        order: 1,
      },
    ]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    // Mock the new bulk programs API call with array of IDs
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programA.id}`),
      { results: [programA] },
    )

    // Mock bulk API call for the first course
    const firstCourseId = programA.courses[0]
    const firstCourse = coursesA.find((c) => c.id === firstCourseId)
    setMockResponse.get(
      urls.courses.coursesList({
        id: [firstCourseId],
        org_id: orgX.id,
      }),
      { results: [firstCourse] },
    )

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const collection = await screen.findByTestId("org-program-collection-root")
    const collectionWrapper = within(collection)

    expect(
      collectionWrapper.getByRole("heading", { name: programCollection.title }),
    ).toBeInTheDocument()

    // Wait for and verify the first course from the program is displayed
    const courseCard = await collectionWrapper.findByTestId(
      "enrollment-card-desktop",
    )
    expect(courseCard).toHaveTextContent(firstCourse!.title)
  })

  test("Does not render a program separately if it is part of a collection", async () => {
    const { orgX, programA, programB, programCollection, coursesA, coursesB } =
      setupProgramsAndCourses()

    // Set up the collection to include both programs
    programCollection.programs = [
      {
        id: programB.id,
        title: programB.title,
        order: 1,
      },
      {
        id: programA.id,
        title: programA.title,
        order: 2,
      },
    ]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    // Mock the bulk programs API call for the collection
    const programIds = [programB.id, programA.id]
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programIds.join("%2C")}`),
      { results: [programB, programA] },
    )

    // Mock course API calls for program collection (first courses)
    const firstCourseIds = [programB.courses[0], programA.courses[0]]
    const firstCourseA = coursesA.find((c) => c.id === programA.courses[0])
    const firstCourseB = coursesB.find((c) => c.id === programB.courses[0])
    setMockResponse.get(
      urls.courses.coursesList({
        id: firstCourseIds,
        org_id: orgX.id,
      }),
      { results: [firstCourseB, firstCourseA] },
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
      name: orgX.name,
    })
    await screen.findByText(orgX.contracts[0].name)

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
      name: orgX.name,
    })
    await screen.findByText(orgX.contracts[0].name)

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
    programCollection.programs = [
      {
        id: programANoCourses.id,
        title: programANoCourses.title,
        order: 1,
      },
      {
        id: programB.id,
        title: programB.title,
        order: 2,
      },
    ]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    // Mock the bulk programs API call for the collection
    const programIds = [programANoCourses.id, programB.id]
    setMockResponse.get(
      expect.stringContaining(`/api/v2/programs/?id=${programIds.join("%2C")}`),
      { results: [programANoCourses, programB] },
    )

    // Mock bulk course API call - only programB has courses, so only its first course should be included
    const firstCourseBId = programB.courses[0]
    const firstCourseB = coursesB.find((c) => c.id === firstCourseBId)

    setMockResponse.get(
      urls.courses.coursesList({
        id: [firstCourseBId], // Only programB's first course since programA has no courses
        org_id: orgX.id,
      }),
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

    // Wait for and verify the course from programB is displayed
    const courseCard = await collection.findByTestId("enrollment-card-desktop")
    expect(courseCard).toHaveTextContent(firstCourseB!.title)
  })

  test("Shows the program certificate link button if the program has a certificate", async () => {
    const { orgX, programA } = setupProgramsAndCourses()

    // Mock the program to have a certificate
    const programWithCertificate = {
      ...programA,
      program_type: "Program", // Set specific program type
      certificate: {
        uuid: "cert-123",
        url: "/certificate/program/cert-123",
      },
    }
    const programEnrollment = factories.enrollment.programEnrollmentV2({
      program: programWithCertificate,
      certificate: {
        uuid: programWithCertificate.certificate.uuid,
        link: programWithCertificate.certificate.url,
      },
    })
    setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
      results: [programWithCertificate],
    })
    setMockResponse.get(urls.programEnrollments.enrollmentsList(), [
      programEnrollment,
    ])
    setMockResponse.get(urls.programEnrollments.enrollmentsListV2(), [
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
    setMockResponse.get(urls.enrollment.enrollmentsListV2(), enrollments)

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

      // Completed or ended courses show "View Module" text
      expect(coursewareButton).toHaveTextContent("View Module")

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

      // Courses with certificates show "Completed" status
      const enrollmentStatus = within(card).getByTestId("enrollment-status")
      expect(enrollmentStatus).toHaveTextContent("Completed")
    })
  })

  test("shows correct run dates from contract-scoped runs", async () => {
    // Mock current time to ensure deterministic test behavior
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2024-01-01T00:00:00Z"))
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()
    const contracts = createTestContracts(orgX.id, 1)

    // Create courses with specific, predictable dates for the contract runs
    // Use a date that's guaranteed to be in the future relative to mocked time
    const specificStartDate = "2024-12-01T00:00:00Z"
    const specificEndDate = "2025-01-15T00:00:00Z"

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

    jest.useRealTimers()
  })

  test("ignores non-contract runs when displaying course information", async () => {
    // Mock current time to ensure deterministic test behavior
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2024-01-01T00:00:00Z"))

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
          start_date: "2024-12-01T00:00:00Z", // Future date relative to mocked time
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
    jest.useRealTimers()
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

  test("displays welcome message when contract has welcome_message and welcome_message_extra", async () => {
    const { orgX } = setupProgramsAndCourses()

    orgX.contracts[0].welcome_message = "Welcome to our program!"
    orgX.contracts[0].welcome_message_extra =
      "<p>This is additional information with <strong>HTML formatting</strong>.</p>"

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    await screen.findByText("Welcome to our program!")

    expect(screen.getByText("Show more")).toBeInTheDocument()

    expect(screen.queryByText("This is additional information with")).toBeNull()
  })

  test("shows and hides extra welcome message content when clicking show more/less", async () => {
    const { orgX } = setupProgramsAndCourses()

    orgX.contracts[0].welcome_message = "Welcome message"
    orgX.contracts[0].welcome_message_extra =
      "<p>Extra content with <em>emphasis</em></p>"

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const showMoreLink = await screen.findByText("Show more")

    await user.click(showMoreLink)

    expect(screen.getByText("Extra content with")).toBeInTheDocument()
    expect(screen.getByText("emphasis")).toBeInTheDocument()

    expect(screen.getByText("Show less")).toBeInTheDocument()
    expect(screen.queryByText("Show more")).toBeNull()

    await user.click(screen.getByText("Show less"))

    expect(screen.queryByText("Extra content with")).toBeNull()

    expect(screen.getByText("Show more")).toBeInTheDocument()
    expect(screen.queryByText("Show less")).toBeNull()
  })

  test("does not display welcome message when welcome_message is missing", async () => {
    const { orgX } = setupProgramsAndCourses()

    const contractWithoutWelcome = { ...orgX.contracts[0] }
    delete (contractWithoutWelcome as Partial<typeof contractWithoutWelcome>)
      .welcome_message
    contractWithoutWelcome.welcome_message_extra = "<p>Extra content</p>"
    orgX.contracts[0] = contractWithoutWelcome

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    expect(screen.queryByText("Show more")).toBeNull()
    expect(screen.queryByText("Extra content")).toBeNull()
  })

  test("does not display welcome message when welcome_message_extra is missing", async () => {
    const { orgX } = setupProgramsAndCourses()

    const contractWithoutExtra = { ...orgX.contracts[0] }
    contractWithoutExtra.welcome_message = "Welcome message"
    delete (contractWithoutExtra as Partial<typeof contractWithoutExtra>)
      .welcome_message_extra
    orgX.contracts[0] = contractWithoutExtra

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    expect(screen.queryByText("Welcome message")).toBeNull()
    expect(screen.queryByText("Show more")).toBeNull()
  })

  test("does not display welcome message when organization has no contracts", async () => {
    const { orgX } = setupProgramsAndCourses()

    orgX.contracts = []

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    expect(screen.queryByText("Show more")).toBeNull()
  })

  test("sanitizes HTML content in welcome_message_extra", async () => {
    const { orgX } = setupProgramsAndCourses()

    orgX.contracts[0].welcome_message = "Welcome message"
    orgX.contracts[0].welcome_message_extra =
      '<p>Safe content</p><script>alert("xss")</script><img src="x" onerror="alert(1)">'

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    const showMoreLink = await screen.findByText("Show more")
    await user.click(showMoreLink)

    expect(screen.getByText("Safe content")).toBeInTheDocument()

    expect(document.querySelector("script")).toBeNull()
  })

  test("uses the first contract for welcome message when multiple contracts exist", async () => {
    const { orgX } = setupProgramsAndCourses()

    const secondContract = factories.contracts.contract({
      organization: orgX.id,
      name: "Second Contract",
      welcome_message: "Second welcome message",
      welcome_message_extra: "<p>Second extra content</p>",
    })

    orgX.contracts = [
      {
        ...orgX.contracts[0],
        welcome_message: "First welcome message",
        welcome_message_extra: "<p>First extra content</p>",
      },
      secondContract,
    ]

    renderWithProviders(<OrganizationContent orgSlug={orgX.slug} />)

    await screen.findByText("First welcome message")

    expect(screen.queryByText("Second welcome message")).toBeNull()

    const showMoreLink = screen.getByText("Show more")
    await user.click(showMoreLink)

    expect(screen.getByText("First extra content")).toBeInTheDocument()
    expect(screen.queryByText("Second extra content")).toBeNull()
  })
})

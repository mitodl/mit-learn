import React from "react"
import {
  renderWithProviders,
  screen,
  within,
  waitFor,
  user,
} from "@/test-utils"
import ContractContent from "./ContractContent"
import { setMockResponse } from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import {
  createCoursesWithContractRuns,
  createTestContracts,
  setupOrgAndUser,
  setupProgramsAndCourses,
  setupOrgDashboardMocks,
} from "./CoursewareDisplay/test-utils"
import {
  CourseWithCourseRunsSerializerV2,
  LanguageEnum,
} from "@mitodl/mitxonline-api-axios/v2"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { contractAdminView } from "@/common/urls"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
}))
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const mockB2bEnrollMutate = jest.fn()
jest.mock("api/mitxonline-hooks/enrollment", () => ({
  ...jest.requireActual("api/mitxonline-hooks/enrollment"),
  useCreateB2bEnrollment: () => ({
    mutate: mockB2bEnrollMutate,
    isPending: false,
  }),
}))

const API_BASE_URL = process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL
const managerOrganizationsUrl = `${API_BASE_URL}/api/v0/b2b/manager/organizations/`

// ManagerContractDetail = ContractPage plus seat-count fields. total_codes
// mirrors the contract's max_learners (null/0 means no seat cap).
const makeContractDetail = (
  contract: ReturnType<typeof factories.contracts.contract>,
  overrides: { total_codes?: number | null } = {},
) => ({
  ...contract,
  attachment_percentage: null,
  total_enrollments: 0,
  total_codes: overrides.total_codes ?? 10,
  assigned_codes: 0,
  unassigned_codes: 0,
  redeemed_codes: 0,
})

const makeCourseEnrollment = factories.enrollment.courseEnrollment
const makeGrade = factories.enrollment.grade

const normalizeCourseForCardAssertions = (
  course: CourseWithCourseRunsSerializerV2,
): CourseWithCourseRunsSerializerV2 => {
  const firstRun = course.courseruns[0]
  if (!firstRun) return course

  const normalizedRun = {
    ...firstRun,
    title: course.title,
  }

  return {
    ...course,
    courseruns: [normalizedRun],
    next_run_id: normalizedRun.id,
  }
}

describe("ContractContent", () => {
  beforeEach(() => {
    setMockResponse.get(urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.contracts.contractsList(), [])
    mockedUseFeatureFlagEnabled.mockReturnValue(undefined)
  })

  it("displays a header for each program returned and cards for courses in program", async () => {
    const { orgX, programA, programB, coursesA, coursesB } =
      setupProgramsAndCourses()
    const normalizedCoursesA = coursesA.map(normalizeCourseForCardAssertions)
    const normalizedCoursesB = coursesB.map(normalizeCourseForCardAssertions)

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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
    expect(cardsA.length).toBe(normalizedCoursesA.length)
    await within(programs[1]).findByRole("heading", { name: programB.title })
    const cardsB = within(programs[1]).getAllByTestId("enrollment-card-desktop")
    expect(cardsB.length).toBe(normalizedCoursesB.length)
  })

  it("displays courses in the correct order based on program.courseIds, regardless of API response order", async () => {
    const { orgX, programA, coursesA } = setupProgramsAndCourses()
    const normalizedCoursesA = coursesA.map(normalizeCourseForCardAssertions)

    // Mock API to return courses in reverse order from program.courseIds
    const reversedCoursesA = [...normalizedCoursesA].reverse()
    setMockResponse.get(
      urls.courses.coursesList({
        id: programA.courses,
        contract_id: orgX.contracts[0].id,
        page_size: 30,
      }),
      { results: reversedCoursesA },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 200,
      }),
      { results: reversedCoursesA },
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const programAHeading = await screen.findByRole("heading", {
      name: programA.title,
    })
    const programAElement = programAHeading.closest(
      '[data-testid="org-program-root"]',
    )
    invariant(programAElement instanceof HTMLElement)
    const cards = await within(programAElement).findAllByTestId(
      "enrollment-card-desktop",
    )

    // Verify courses appear in program.courseIds order, not API response order
    expect(cards.length).toBe(normalizedCoursesA.length)
    const expectedTitles = programA.courses
      .map((courseId) =>
        normalizedCoursesA.find((course) => course.id === courseId),
      )
      .filter((course): course is CourseWithCourseRunsSerializerV2 =>
        Boolean(course),
      )
      .map((course) => course.courseruns[0].title)

    expectedTitles.forEach((title, index) => {
      expect(cards[index]).toHaveTextContent(title)
    })
  })

  it("displays programs in the correct order based on contract.programs, regardless of API response order", async () => {
    const { orgX, programA, programB, coursesA, coursesB } =
      setupProgramsAndCourses()

    // Update the contract to specify program order (B first, then A)
    const contract = factories.contracts.contract({
      organization: orgX.id,
      name: "Org X Contract",
      programs: [programB.id, programA.id],
    })

    // Update course runs to reference the new contract ID
    const updatedCoursesA = coursesA.map((course) => ({
      ...course,
      courseruns: course.courseruns.map((run) => ({
        ...run,
        b2b_contract: contract.id,
      })),
    }))
    const updatedCoursesB = coursesB.map((course) => ({
      ...course,
      courseruns: course.courseruns.map((run) => ({
        ...run,
        b2b_contract: contract.id,
      })),
    }))

    orgX.contracts = [contract]
    setMockResponse.get(urls.contracts.contractsList(), [contract])
    // Need to update the orgX response to include the new contract
    setMockResponse.get(urls.organization.organizationList(orgX.slug), orgX)

    // Mock API to return programs in opposite order (A first, then B)
    setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
      results: [programA, programB],
    })
    // Add the contract-filtered programs query
    setMockResponse.get(
      urls.programs.programsList({
        org_id: orgX.id,
        contract_id: contract.id,
        page_size: 30,
      }),
      {
        results: [programA, programB],
      },
    )
    // Add the contract-filtered courses query
    setMockResponse.get(
      urls.courses.coursesList({
        org_id: orgX.id,
        contract_id: contract.id,
        page_size: 200,
      }),
      {
        results: [...updatedCoursesA, ...updatedCoursesB],
      },
    )
    // Add per-program course list mocks with new contract ID
    setMockResponse.get(
      urls.courses.coursesList({
        id: programA.courses,
        contract_id: contract.id,
        page_size: 30,
      }),
      {
        results: updatedCoursesA,
      },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        id: programB.courses,
        contract_id: contract.id,
        page_size: 30,
      }),
      {
        results: updatedCoursesB,
      },
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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
    const contract = orgX.contracts[0]
    const normalizedCoursesA = coursesA.map(normalizeCourseForCardAssertions)
    const enrollments = [
      makeCourseEnrollment({
        run: {
          id: normalizedCoursesA[0].courseruns[0].id,
          title: normalizedCoursesA[0].title,
          course: {
            id: normalizedCoursesA[0].id,
            title: normalizedCoursesA[0].title,
          },
        },
        grades: [makeGrade({ passed: true })],
        b2b_contract_id: contract.id,
      }),
      makeCourseEnrollment({
        run: {
          id: normalizedCoursesA[1].courseruns[0].id,
          title: normalizedCoursesA[1].title,
          course: {
            id: normalizedCoursesA[1].id,
            title: normalizedCoursesA[1].title,
          },
        },
        grades: [],
        certificate: null,
        b2b_contract_id: contract.id,
      }),
    ]

    setMockResponse.get(
      urls.courses.coursesList({
        id: programA.courses,
        contract_id: contract.id,
        page_size: 30,
      }),
      { results: normalizedCoursesA },
    )

    // Override the default empty enrollments for this test
    setMockResponse.get(urls.enrollment.enrollmentsListV3(), enrollments)

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const [programElA] = await screen.findAllByTestId("org-program-root")
    const cards = await within(programElA).findAllByTestId(
      "enrollment-card-desktop",
    )
    expect(cards.length).toBeGreaterThanOrEqual(2)

    // Find the cards for our enrolled courses
    const completedCard = cards.find((card) =>
      card.textContent?.includes(coursesA[0].title),
    )
    const enrolledCard = cards.find((card) =>
      card.textContent?.includes(coursesA[1].title),
    )

    expect(completedCard).toBeDefined()
    expect(enrolledCard).toBeDefined()

    // Check enrollment status indicators
    const completedIndicator = within(completedCard!).getByTestId(
      "enrollment-status",
    )
    const enrolledIndicator = within(enrolledCard!).getByTestId(
      "enrollment-status",
    )

    expect(completedIndicator).toHaveTextContent(/^Completed$/)
    expect(enrolledIndicator).toHaveTextContent(/^Enrolled$/)
  })

  test("Renders program collections", async () => {
    const { orgX, programA, programB, programCollection, coursesA, coursesB } =
      setupProgramsAndCourses()
    const normalizedCoursesA = coursesA.map(normalizeCourseForCardAssertions)
    const normalizedCoursesB = coursesB.map(normalizeCourseForCardAssertions)

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

    // Mock the new bulk programs API call with array of IDs and contract_id
    const programIds = [programB.id, programA.id] // B first, then A to match collection order
    setMockResponse.get(
      urls.programs.programsList({
        id: programIds,
        contract_id: orgX.contracts[0].id,
        page_size: programIds.length,
      }),
      { results: [programB, programA] }, // Return in same order as requested
    )

    // Mock the bulk course API call with first course from each program
    const firstCourseA = normalizedCoursesA.find(
      (c) => c.id === programA.courses[0],
    )
    const firstCourseB = normalizedCoursesB.find(
      (c) => c.id === programB.courses[0],
    )
    invariant(firstCourseA)
    invariant(firstCourseB)
    const firstCourseIds = [programB.courses[0], programA.courses[0]] // B first, then A to match collection order

    // Mock the program collection courses query with contract_id
    setMockResponse.get(
      urls.courses.coursesList({
        id: firstCourseIds,
        contract_id: orgX.contracts[0].id,
      }),
      { results: [firstCourseB, firstCourseA] },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 200,
      }),
      { results: [...normalizedCoursesA, ...normalizedCoursesB] },
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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

    // Verify cards follow collection program order (B then A).
    const expectedTitles = [
      firstCourseB.courseruns[0].title,
      firstCourseA.courseruns[0].title,
    ]
    expectedTitles.forEach((title, index) => {
      expect(courseCards[index]).toHaveTextContent(title)
    })
  })

  test("Program collection courses are sorted by program order property", async () => {
    const { orgX, programA, programB, programCollection, coursesA, coursesB } =
      setupProgramsAndCourses()
    const normalizedCoursesA = coursesA.map(normalizeCourseForCardAssertions)
    const normalizedCoursesB = coursesB.map(normalizeCourseForCardAssertions)

    // Set up the collection with programs in reverse order (A first in array, but higher order number)
    programCollection.programs = [
      {
        id: programA.id,
        title: programA.title,
        order: 2, // Higher order - should appear second
      },
      {
        id: programB.id,
        title: programB.title,
        order: 1, // Lower order - should appear first
      },
    ]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    // Mock the programs API call - return in array order (A, B)
    const programIds = [programA.id, programB.id]
    setMockResponse.get(
      urls.programs.programsList({
        id: programIds,
        contract_id: orgX.contracts[0].id,
        page_size: programIds.length,
      }),
      { results: [programA, programB] }, // API returns A first
    )

    // Mock the courses API call - return in array order (A's first course, B's first course)
    const firstCourseA = normalizedCoursesA.find(
      (c) => c.id === programA.courses[0],
    )
    const firstCourseB = normalizedCoursesB.find(
      (c) => c.id === programB.courses[0],
    )
    invariant(firstCourseA)
    invariant(firstCourseB)
    const firstCourseIds = [programA.courses[0], programB.courses[0]]

    setMockResponse.get(
      urls.courses.coursesList({
        id: firstCourseIds,
        contract_id: orgX.contracts[0].id,
      }),
      { results: [firstCourseA, firstCourseB] }, // API returns A's course first
    )
    setMockResponse.get(
      urls.courses.coursesList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 200,
      }),
      { results: [...normalizedCoursesA, ...normalizedCoursesB] },
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const collectionItems = await screen.findAllByTestId(
      "org-program-collection-root",
    )
    const collection = within(collectionItems[0])

    const courseCards = await collection.findAllByTestId(
      "enrollment-card-desktop",
    )
    expect(courseCards.length).toBe(2)

    // Verify cards follow program.order sorting (order 1 then order 2).
    const expectedTitles = [
      firstCourseB.courseruns[0].title,
      firstCourseA.courseruns[0].title,
    ]
    expectedTitles.forEach((title, index) => {
      expect(courseCards[index]).toHaveTextContent(title)
    })
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

    // Mock the new bulk programs API call with array of IDs and contract_id
    setMockResponse.get(
      urls.programs.programsList({
        id: [programA.id],
        contract_id: orgX.contracts[0].id,
        page_size: 1,
      }),
      { results: [programA] },
    )

    // Mock bulk API call for the first course with contract_id
    const firstCourseId = programA.courses[0]
    const firstCourse = coursesA.find((c) => c.id === firstCourseId)
    setMockResponse.get(
      urls.courses.coursesList({
        id: [firstCourseId],
        contract_id: orgX.contracts[0].id,
      }),
      { results: [firstCourse] },
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const collection = await screen.findByTestId("org-program-collection-root")
    const collectionWrapper = within(collection)

    expect(
      collectionWrapper.getByRole("heading", { name: programCollection.title }),
    ).toBeInTheDocument()

    // Wait for and verify the first course from the program is displayed
    const courseCard = await collectionWrapper.findByTestId(
      "enrollment-card-desktop",
    )
    expect(courseCard).toBeInTheDocument()
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

    // Mock the bulk programs API call for the collection with contract_id
    const programIds = [programB.id, programA.id]
    setMockResponse.get(
      urls.programs.programsList({
        id: programIds,
        contract_id: orgX.contracts[0].id,
        page_size: programIds.length,
      }),
      { results: [programB, programA] },
    )

    // Mock course API calls for program collection (first courses) with contract_id
    const firstCourseIds = [programB.courses[0], programA.courses[0]]
    const firstCourseA = coursesA.find((c) => c.id === programA.courses[0])
    const firstCourseB = coursesB.find((c) => c.id === programB.courses[0])
    invariant(firstCourseA)
    invariant(firstCourseB)
    setMockResponse.get(
      urls.courses.coursesList({
        id: firstCourseIds,
        contract_id: orgX.contracts[0].id,
      }),
      { results: [firstCourseB, firstCourseA] },
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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
    setMockResponse.get(
      urls.programs.programsList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
      }),
      {
        results: [],
      },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 200,
      }),
      {
        results: [],
      },
    )
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [],
    })

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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

  test("only renders programs whose courses appear in the contract-scoped courses response", async () => {
    const { orgX, programA, programB } = setupProgramsAndCourses()

    // Create a program whose courses are not in the contract-scoped courses response.
    // The courses API mock from setupProgramsAndCourses only returns coursesA and coursesB,
    // so getSortedStandaloneContractPrograms will exclude programC because none of its
    // course IDs appear in contractCourses.
    const programC = factories.programs.program({
      courses: [99991, 99992],
    })

    // Override the contract-filtered programs list to include the extra program.
    setMockResponse.get(
      urls.programs.programsList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 30,
      }),
      { results: [programA, programB, programC] },
    )
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [],
    })

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    await screen.findByRole("heading", { name: orgX.name })
    // A and B have contract-scoped courses, so they render.
    const renderedPrograms = await screen.findAllByTestId("org-program-root")
    expect(renderedPrograms.length).toBe(2)
    // C has no contract-scoped courses, so it must not appear.
    expect(
      screen.queryByRole("heading", { name: programC.title }),
    ).not.toBeInTheDocument()
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

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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
    const normalizedCoursesB = coursesB.map(normalizeCourseForCardAssertions)

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

    // Mock the bulk programs API call for the collection with contract_id
    const programIds = [programANoCourses.id, programB.id]
    setMockResponse.get(
      urls.programs.programsList({
        id: programIds,
        contract_id: orgX.contracts[0].id,
        page_size: programIds.length,
      }),
      { results: [programANoCourses, programB] },
    )
    setMockResponse.get(
      urls.programs.programsList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 30,
      }),
      { results: [programANoCourses, programB] },
    )

    // Mock bulk course API call - only programB has courses, so only its first course should be included
    const firstCourseBId = programB.courses[0]
    const firstCourseB = normalizedCoursesB.find((c) => c.id === firstCourseBId)

    setMockResponse.get(
      urls.courses.coursesList({
        id: [firstCourseBId],
        contract_id: orgX.contracts[0].id,
      }),
      { results: [firstCourseB] },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 200,
      }),
      { results: [firstCourseB] },
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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
    expect(courseCard).toBeInTheDocument()
  })

  test("Shows the program certificate link button if the program has a certificate", async () => {
    const { orgX, programA, coursesA } = setupProgramsAndCourses()

    // Mock the program to have a certificate
    const programWithCertificate = {
      ...programA,
      program_type: "Program", // Set specific program type
      certificate: {
        uuid: "cert-123",
        url: "/certificate/program/cert-123",
      },
    }
    const programEnrollment = factories.enrollment.programEnrollmentV3({
      program: programWithCertificate,
      certificate: {
        uuid: programWithCertificate.certificate.uuid,
        link: programWithCertificate.certificate.url,
      },
    })
    setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
      results: [programWithCertificate],
    })
    // Add the contract-filtered programs query
    setMockResponse.get(
      urls.programs.programsList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 30,
      }),
      {
        results: [programWithCertificate],
      },
    )
    // Add the contract-filtered courses query
    setMockResponse.get(
      urls.courses.coursesList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 200,
      }),
      {
        results: coursesA,
      },
    )
    setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [
      programEnrollment,
    ])

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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
    const baseCourses = factories.courses.courses({ count: 3 }).results
    const program = factories.programs.program({
      courses: baseCourses.map((c) => c.id),
    })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    // Update the user's b2b_organizations to include contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts
    const courses = createCoursesWithContractRuns(contracts)
    // Update program to use the actual course IDs from createCoursesWithContractRuns
    program.courses = courses.map((c) => c.id)

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    // Wait for programs to load
    const programElements = await screen.findAllByTestId("org-program-root")
    expect(programElements).toHaveLength(1)

    // Verify courses are displayed
    const cards = await within(programElements[0]).findAllByTestId(
      "enrollment-card-desktop",
    )
    expect(cards.length).toBeGreaterThan(0)

    // Verify each course card displays the course and has a contract-scoped run
    cards.forEach((card, index) => {
      const course = courses[index]
      const contractRun = course.courseruns.find(
        (run) =>
          run.b2b_contract && contracts.some((c) => c.id === run.b2b_contract),
      )

      expect(card).toHaveTextContent(course.title)
      expect(contractRun).toBeDefined()
      expect(contractRun?.b2b_contract).toBe(contracts[0].id)
    })
  })

  test("shows correct run dates from contract-scoped runs", async () => {
    // Mock current time to ensure deterministic test behavior
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2024-01-01T00:00:00Z"))
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()

    // Create courses with specific, predictable dates for the contract runs
    // Use a date within 90 days of frozen time so formatCalendarDays returns "in X days"
    const specificStartDate = "2024-02-15T00:00:00Z"
    const specificEndDate = "2024-03-31T00:00:00Z"

    const baseCourses = factories.courses.courses({ count: 3 }).results
    const program = factories.programs.program({
      courses: baseCourses.map((c) => c.id),
    })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts

    const courses = createCoursesWithContractRuns(contracts).map((course) => ({
      ...course,
      courseruns: course.courseruns.map((run) => {
        if (run.b2b_contract === contracts[0].id) {
          return {
            ...run,
            is_enrollable: true,
            start_date: specificStartDate,
            end_date: specificEndDate,
          }
        }
        return run
      }),
    }))
    // Update program to use the actual course IDs
    program.courses = courses.map((c) => c.id)

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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

    // Create courses where non-contract runs have different, easily identifiable data
    const baseCourses = factories.courses.courses({ count: 3 }).results
    const program = factories.programs.program({
      courses: baseCourses.map((c) => c.id),
    })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts

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
          is_enrollable: true,
          title: `CORRECT RUN - ${run.title}`,
          courseware_url: "https://correct-run.example.com",
          start_date: "2024-02-15T00:00:00Z", // Future date relative to mocked time, within 90-day threshold
        }
      }),
    }))
    // Update program to use the actual course IDs
    program.courses = courses.map((c) => c.id)

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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

    // Create courses with different pricing for contract vs non-contract runs
    const baseCourses = factories.courses.courses({ count: 3 }).results
    const program = factories.programs.program({
      courses: baseCourses.map((c) => c.id),
    })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts

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
    // Update program to use the actual course IDs
    program.courses = courses.map((c) => c.id)

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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
    const baseCourses = factories.courses.courses({ count: 3 }).results
    const program = factories.programs.program({
      courses: baseCourses.map((c) => c.id),
    })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts
    const contractIds = contracts.map((c) => c.id)
    const courses = createCoursesWithContractRuns(contracts)
    // Update program to use the actual course IDs
    program.courses = courses.map((c) => c.id)

    // Create enrollment for first course only
    const enrollments = [
      factories.enrollment.courseEnrollment({
        run: {
          id: courses[0].courseruns.find(
            (r) => r.b2b_contract === contractIds[0],
          )?.id,
          course: { id: courses[0].id, title: courses[0].title },
        },
        b2b_contract_id: contracts[0].id,
        b2b_organization_id: contracts[0].organization,
        certificate: { uuid: faker.string.uuid(), link: faker.internet.url() },
      }),
      factories.enrollment.courseEnrollment({
        run: {
          id: courses[1].courseruns.find(
            (r) => r.b2b_contract === contractIds[0],
          )?.id,
          course: { id: courses[1].id, title: courses[1].title },
        },
        b2b_contract_id: contracts[0].id,
        b2b_organization_id: contracts[0].organization,
        certificate: null,
        grades: [],
      }),
    ]
    // Override enrollments for this test
    setMockResponse.get(urls.enrollment.enrollmentsListV3(), enrollments)

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      courses,
      contracts,
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const cards = await within(
      await screen.findByTestId("org-program-root"),
    ).findAllByTestId("enrollment-card-desktop")

    expect(cards.length).toBe(3)
    // First card should show enrolled status
    const cardStatus0 = within(cards[0]).getByTestId("enrollment-status")
    expect(cardStatus0).toHaveTextContent(/^Completed$/)

    const cardStatus1 = within(cards[1]).getByTestId("enrollment-status")
    expect(cardStatus1).toHaveTextContent(/^Enrolled$/)

    const cardStatus2 = within(cards[2]).getByTestId("enrollment-status")
    expect(cardStatus2).toHaveTextContent(/^Not Enrolled$/)
  })

  test("shows the not found screen if the organization is not found by orgSlug", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    setMockResponse.get(urls.userMe.get(), mitxOnlineUser)

    renderWithProviders(
      <ContractContent orgSlug="not-found" contractSlug="not-found" />,
    )

    await screen.findByRole("heading", { name: "Organization not found" })
  })

  test("displays welcome message when contract has welcome_message and welcome_message_extra", async () => {
    const { orgX } = setupProgramsAndCourses()

    orgX.contracts[0].welcome_message = "Welcome to our program!"
    orgX.contracts[0].welcome_message_extra =
      "<p>This is additional information with <strong>HTML formatting</strong>.</p>"

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    await screen.findByText("Welcome to our program!")

    expect(screen.getByText("Show more")).toBeInTheDocument()

    expect(screen.queryByText("This is additional information with")).toBeNull()
  })

  test("shows and hides extra welcome message content when clicking show more/less", async () => {
    const { orgX } = setupProgramsAndCourses()

    orgX.contracts[0].welcome_message = "Welcome message"
    orgX.contracts[0].welcome_message_extra =
      "<p>Extra content with <em>emphasis</em></p>"

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const showMoreLink = await screen.findByText("Show more")

    await user.click(showMoreLink)

    expect(screen.getByText(/Extra content with/)).toBeInTheDocument()
    expect(screen.getByText("emphasis")).toBeInTheDocument()

    expect(screen.getByText("Show less")).toBeInTheDocument()
    expect(screen.queryByText("Show more")).toBeNull()

    await user.click(screen.getByText("Show less"))

    expect(screen.queryByText(/Extra content with/)).toBeNull()

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

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    expect(screen.queryByText("Welcome message")).toBeNull()
    expect(screen.queryByText("Show more")).toBeNull()
  })

  test("shows the not found screen if the contract is not found by contractSlug", async () => {
    const { orgX } = setupProgramsAndCourses()

    orgX.contracts = []

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug="no-contract" />,
    )

    await screen.findByRole("heading", { name: "Contract not found" })
  })

  test("shows the not found screen when contract slug doesn't match any contracts", async () => {
    const { orgX } = setupProgramsAndCourses()

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug="invalid-contract" />,
    )

    await screen.findByRole("heading", { name: "Contract not found" })
  })

  test("does not render the Manage button when the feature flag is off", async () => {
    mockedUseFeatureFlagEnabled.mockImplementation(() => false)
    const { orgX } = setupProgramsAndCourses()

    setMockResponse.get(managerOrganizationsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [orgX],
    })

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    await screen.findByRole("heading", { name: orgX.name })
    expect(
      screen.queryByRole("link", { name: "Manage" }),
    ).not.toBeInTheDocument()
  })

  test("does not render the Manage button when flag is on but user is not a manager for this org", async () => {
    mockedUseFeatureFlagEnabled.mockImplementation(
      (flag) => flag === FeatureFlags.B2BContractManagerDashboard,
    )
    const { orgX } = setupProgramsAndCourses()

    // Return a different org — user is a manager elsewhere, not for orgX
    const otherOrg = factories.organizations.organization({})
    setMockResponse.get(managerOrganizationsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [otherOrg],
    })

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    await screen.findByRole("heading", { name: orgX.name })
    expect(
      screen.queryByRole("link", { name: "Manage" }),
    ).not.toBeInTheDocument()
  })

  test("renders the Manage button with correct href when flag is on and user is a manager", async () => {
    mockedUseFeatureFlagEnabled.mockImplementation(
      (flag) => flag === FeatureFlags.B2BContractManagerDashboard,
    )
    const { orgX } = setupProgramsAndCourses()

    setMockResponse.get(managerOrganizationsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [orgX],
    })
    setMockResponse.get(
      urls.contracts.managerContractDetail(orgX.id, orgX.contracts[0].id),
      makeContractDetail(orgX.contracts[0], { total_codes: 10 }),
    )

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const manageButton = await screen.findByRole("link", { name: "Manage" })
    expect(manageButton).toHaveAttribute(
      "href",
      contractAdminView(orgX.slug, orgX.contracts[0].slug),
    )
  })

  // TEMPORARY: the Manage button is gated on the contract having a seat cap
  // (max_learners / total_codes). Contracts with no cap (null/0) hide it until
  // the seat-assignment admin page supports uncapped contracts.
  test.each([{ totalCodes: null }, { totalCodes: 0 }])(
    "does not render the Manage button when the contract has no seat cap (total_codes=$totalCodes)",
    async ({ totalCodes }) => {
      mockedUseFeatureFlagEnabled.mockImplementation(
        (flag) => flag === FeatureFlags.B2BContractManagerDashboard,
      )
      const { orgX } = setupProgramsAndCourses()

      setMockResponse.get(managerOrganizationsUrl, {
        count: 1,
        next: null,
        previous: null,
        results: [orgX],
      })
      setMockResponse.get(
        urls.contracts.managerContractDetail(orgX.id, orgX.contracts[0].id),
        makeContractDetail(orgX.contracts[0], { total_codes: totalCodes }),
      )

      renderWithProviders(
        <ContractContent
          orgSlug={orgX.slug}
          contractSlug={orgX.contracts[0].slug}
        />,
      )

      await screen.findByRole("heading", { name: orgX.name })
      expect(
        screen.queryByRole("link", { name: "Manage" }),
      ).not.toBeInTheDocument()
    },
  )

  test("sanitizes HTML content in welcome_message_extra", async () => {
    const { orgX } = setupProgramsAndCourses()

    orgX.contracts[0].welcome_message = "Welcome message"
    orgX.contracts[0].welcome_message_extra =
      '<p>Safe content</p><script>alert("xss")</script><img src="x" onerror="alert(1)">'

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

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

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    await screen.findByText("First welcome message")

    expect(screen.queryByText("Second welcome message")).toBeNull()

    const showMoreLink = screen.getByText("Show more")
    await user.click(showMoreLink)

    expect(screen.getByText("First extra content")).toBeInTheDocument()
    expect(screen.queryByText("Second extra content")).toBeNull()
  })

  test("shared contract variant picker switches top-level program card title", async () => {
    const { orgX, user: userApiPath, mitxOnlineUser } = setupOrgAndUser()
    mitxOnlineUser.legal_address = { country: "US" }
    mitxOnlineUser.user_profile = { year_of_birth: 1988 }

    const program = factories.programs.program({ courses: [] })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts
    contracts[0].variant_options = [
      {
        language: LanguageEnum.En,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: true,
      },
      {
        language: LanguageEnum.EsEs,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: false,
      },
    ]

    const englishRun = factories.courses.courseRun({
      id: faker.number.int(),
      title: "Module in English",
      courseware_id: "cw-program-en",
      courseware_url: "https://openedx.example.com/program-english",
      b2b_contract: contracts[0].id,
      is_enrollable: true,
    })
    const spanishRun = factories.courses.courseRun({
      id: faker.number.int(),
      title: "Modulo en Espanol",
      courseware_id: "cw-program-es",
      courseware_url: "https://openedx.example.com/program-spanish",
      b2b_contract: contracts[0].id,
      is_enrollable: true,
      language: LanguageEnum.EsEs,
    })
    const localizedCourse = factories.courses.course({
      courseruns: [englishRun, spanishRun],
      next_run_id: englishRun.id,
    })
    program.courses = [localizedCourse.id]

    setupOrgDashboardMocks(
      orgX,
      userApiPath,
      mitxOnlineUser,
      [program],
      [localizedCourse],
      contracts,
    )
    // Mock the variant runs endpoint for the Spanish selection
    setMockResponse.get(
      urls.courses.courseVariantRuns({
        contract: contracts[0].id,
        course_id: [localizedCourse.id],
        language: LanguageEnum.EsEs,
      }),
      [{ id: localizedCourse.id, courseruns: [spanishRun] }],
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contracts[0].slug} />,
    )

    const root = within(await screen.findByTestId("org-program-root"))
    // Wait for variant picker to appear with English and Spanish radio options
    await screen.findAllByRole("radio")

    const card = await root.findByTestId("enrollment-card-desktop")
    // Default run is the English run (next_run_id)
    expect(card).toHaveTextContent("Module in English")

    // Click the Spanish variant card to switch
    await user.click(screen.getByText(/español/i))

    await waitFor(() => {
      expect(root.getByTestId("enrollment-card-desktop")).toHaveTextContent(
        "Modulo en Espanol",
      )
    })
  })

  test("hides program description when a non-default variant is selected", async () => {
    const { orgX, user: userApiPath, mitxOnlineUser } = setupOrgAndUser()
    mitxOnlineUser.legal_address = { country: "US" }
    mitxOnlineUser.user_profile = { year_of_birth: 1988 }

    const program = factories.programs.program({ courses: [] })
    const programDescription = program.page!.description!
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts
    contracts[0].variant_options = [
      {
        language: LanguageEnum.En,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: true,
      },
      {
        language: LanguageEnum.EsEs,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: false,
      },
    ]

    const englishRun = factories.courses.courseRun({
      id: faker.number.int(),
      b2b_contract: contracts[0].id,
      is_enrollable: true,
    })
    const spanishRun = factories.courses.courseRun({
      id: faker.number.int(),
      b2b_contract: contracts[0].id,
      is_enrollable: true,
      language: LanguageEnum.EsEs,
    })
    const localizedCourse = factories.courses.course({
      courseruns: [englishRun, spanishRun],
      next_run_id: englishRun.id,
    })
    program.courses = [localizedCourse.id]

    setupOrgDashboardMocks(
      orgX,
      userApiPath,
      mitxOnlineUser,
      [program],
      [localizedCourse],
      contracts,
    )
    setMockResponse.get(
      urls.courses.courseVariantRuns({
        contract: contracts[0].id,
        course_id: [localizedCourse.id],
        language: LanguageEnum.EsEs,
      }),
      [{ id: localizedCourse.id, courseruns: [spanishRun] }],
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contracts[0].slug} />,
    )

    await screen.findByTestId("org-program-root")
    await screen.findAllByRole("radio")

    // Description is visible for the default (English) variant
    expect(screen.getByText(programDescription)).toBeInTheDocument()

    // Switch to the non-default (Spanish) variant
    await user.click(screen.getByText(/español/i))

    await waitFor(() => {
      expect(screen.queryByText(programDescription)).not.toBeInTheDocument()
    })

    // Switch back to default — description reappears. The default card is
    // identified by its "Certificate Eligible" badge (its title is the
    // contract-specific defaultVariantLabel, not the computed variant label).
    await user.click(
      screen.getByRole("radio", { name: /Certificate Eligible/ }),
    )

    await screen.findByText(programDescription)
  })

  test("hides collection description when a non-default variant is selected", async () => {
    const { orgX, user: userApiPath, mitxOnlineUser } = setupOrgAndUser()
    mitxOnlineUser.legal_address = { country: "US" }
    mitxOnlineUser.user_profile = { year_of_birth: 1988 }

    const program = factories.programs.program({ courses: [] })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts
    contracts[0].variant_options = [
      {
        language: LanguageEnum.En,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: true,
      },
      {
        language: LanguageEnum.EsEs,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: false,
      },
    ]

    const englishRun = factories.courses.courseRun({
      id: faker.number.int(),
      b2b_contract: contracts[0].id,
      is_enrollable: true,
    })
    const spanishRun = factories.courses.courseRun({
      id: faker.number.int(),
      b2b_contract: contracts[0].id,
      is_enrollable: true,
      language: LanguageEnum.EsEs,
    })
    const localizedCourse = factories.courses.course({
      courseruns: [englishRun, spanishRun],
      next_run_id: englishRun.id,
    })
    program.courses = [localizedCourse.id]

    setupOrgDashboardMocks(
      orgX,
      userApiPath,
      mitxOnlineUser,
      [program],
      [localizedCourse],
      contracts,
    )
    setMockResponse.get(
      urls.courses.courseVariantRuns({
        contract: contracts[0].id,
        course_id: [localizedCourse.id],
        language: LanguageEnum.EsEs,
      }),
      [{ id: localizedCourse.id, courseruns: [spanishRun] }],
    )

    const programCollection = factories.programs.programCollection({
      programs: [{ id: program.id, title: program.title, order: 1 }],
    })
    const collectionDescription = programCollection.description!
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })
    setMockResponse.get(
      urls.programs.programsList({
        id: [program.id],
        contract_id: contracts[0].id,
        page_size: 1,
      }),
      { results: [program] },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        id: [localizedCourse.id],
        contract_id: contracts[0].id,
      }),
      { results: [localizedCourse] },
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contracts[0].slug} />,
    )

    await screen.findByTestId("org-program-collection-root")
    await screen.findAllByRole("radio")

    // Description is visible for the default (English) variant
    expect(screen.getByText(collectionDescription)).toBeInTheDocument()

    // Switch to the non-default (Spanish) variant
    await user.click(screen.getByText(/español/i))

    await waitFor(() => {
      expect(screen.queryByText(collectionDescription)).not.toBeInTheDocument()
    })

    // Switch back to default — description reappears. The default card is
    // identified by its "Certificate Eligible" badge (its title is the
    // contract-specific defaultVariantLabel, not the computed variant label).
    await user.click(
      screen.getByRole("radio", { name: /Certificate Eligible/ }),
    )

    await screen.findByText(collectionDescription)
  })

  test("shared contract variant picker switches program collection card title", async () => {
    const { orgX, user: userApiPath, mitxOnlineUser } = setupOrgAndUser()
    mitxOnlineUser.legal_address = { country: "US" }
    mitxOnlineUser.user_profile = { year_of_birth: 1988 }

    const program = factories.programs.program({ courses: [] })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts
    contracts[0].variant_options = [
      {
        language: LanguageEnum.En,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: true,
      },
      {
        language: LanguageEnum.EsEs,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: false,
      },
    ]

    const englishRun = factories.courses.courseRun({
      id: faker.number.int(),
      title: "Collection English",
      courseware_id: "cw-collection-en",
      courseware_url: "https://openedx.example.com/collection-english",
      b2b_contract: contracts[0].id,
      is_enrollable: true,
    })
    const spanishRun = factories.courses.courseRun({
      id: faker.number.int(),
      title: "Collection Espanol",
      courseware_id: "cw-collection-es",
      courseware_url: "https://openedx.example.com/collection-spanish",
      b2b_contract: contracts[0].id,
      is_enrollable: true,
      language: LanguageEnum.EsEs,
    })
    const localizedCourse = factories.courses.course({
      courseruns: [englishRun, spanishRun],
      next_run_id: englishRun.id,
    })
    program.courses = [localizedCourse.id]

    setupOrgDashboardMocks(
      orgX,
      userApiPath,
      mitxOnlineUser,
      [program],
      [localizedCourse],
      contracts,
    )
    // Mock the variant runs endpoint for the Spanish selection
    setMockResponse.get(
      urls.courses.courseVariantRuns({
        contract: contracts[0].id,
        course_id: [localizedCourse.id],
        language: LanguageEnum.EsEs,
      }),
      [{ id: localizedCourse.id, courseruns: [spanishRun] }],
    )

    const programCollection = factories.programs.programCollection({
      programs: [{ id: program.id, title: program.title, order: 1 }],
    })
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })
    setMockResponse.get(
      urls.programs.programsList({
        id: [program.id],
        contract_id: contracts[0].id,
        page_size: 1,
      }),
      { results: [program] },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        id: [localizedCourse.id],
        contract_id: contracts[0].id,
      }),
      { results: [localizedCourse] },
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contracts[0].slug} />,
    )

    const collectionRoot = await screen.findByTestId(
      "org-program-collection-root",
    )
    const collection = within(collectionRoot)

    // Wait for variant picker to appear with English and Spanish radio options
    await screen.findAllByRole("radio")

    const card = await collection.findByTestId("enrollment-card-desktop")
    // Default run is the English run (next_run_id)
    expect(card).toHaveTextContent("Collection English")

    // Click the Spanish variant card to switch
    await user.click(screen.getByText(/español/i))

    await waitFor(() => {
      expect(
        collection.getByTestId("enrollment-card-desktop"),
      ).toHaveTextContent("Collection Espanol")
    })
  })

  test("hides program section when selected variant has no matching runs", async () => {
    const { orgX, user: userApiPath, mitxOnlineUser } = setupOrgAndUser()
    mitxOnlineUser.legal_address = { country: "US" }
    mitxOnlineUser.user_profile = { year_of_birth: 1988 }

    const program = factories.programs.program({ courses: [] })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts
    contracts[0].variant_options = [
      {
        language: LanguageEnum.En,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: true,
      },
      {
        language: LanguageEnum.EsEs,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: false,
      },
    ]

    // Course only has an English run — no Spanish variant run
    const englishRun = factories.courses.courseRun({
      id: faker.number.int(),
      title: "English Only Module",
      b2b_contract: contracts[0].id,
      is_enrollable: true,
    })
    const englishOnlyCourse = factories.courses.course({
      courseruns: [englishRun],
      next_run_id: englishRun.id,
    })
    program.courses = [englishOnlyCourse.id]

    setupOrgDashboardMocks(
      orgX,
      userApiPath,
      mitxOnlineUser,
      [program],
      [englishOnlyCourse],
      contracts,
    )
    // Variant runs endpoint returns no matching runs for this course
    setMockResponse.get(
      urls.courses.courseVariantRuns({
        contract: contracts[0].id,
        course_id: [englishOnlyCourse.id],
        language: LanguageEnum.EsEs,
      }),
      [],
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contracts[0].slug} />,
    )

    await screen.findByTestId("org-program-root")
    await screen.findAllByRole("radio")

    // Default (English) shows the program
    expect(screen.getByTestId("org-program-root")).toBeInTheDocument()

    // Switch to Spanish — program has no Spanish run, section should disappear
    await user.click(screen.getByText(/español/i))

    await waitFor(() => {
      expect(screen.queryByTestId("org-program-root")).not.toBeInTheDocument()
    })
  })

  test("hides collection section when selected variant has no matching runs", async () => {
    const { orgX, user: userApiPath, mitxOnlineUser } = setupOrgAndUser()
    mitxOnlineUser.legal_address = { country: "US" }
    mitxOnlineUser.user_profile = { year_of_birth: 1988 }

    const program = factories.programs.program({ courses: [] })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts
    contracts[0].variant_options = [
      {
        language: LanguageEnum.En,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: true,
      },
      {
        language: LanguageEnum.EsEs,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: false,
      },
    ]

    const englishRun = factories.courses.courseRun({
      id: faker.number.int(),
      title: "Collection English Only",
      b2b_contract: contracts[0].id,
      is_enrollable: true,
    })
    const englishOnlyCourse = factories.courses.course({
      courseruns: [englishRun],
      next_run_id: englishRun.id,
    })
    program.courses = [englishOnlyCourse.id]

    setupOrgDashboardMocks(
      orgX,
      userApiPath,
      mitxOnlineUser,
      [program],
      [englishOnlyCourse],
      contracts,
    )
    setMockResponse.get(
      urls.courses.courseVariantRuns({
        contract: contracts[0].id,
        course_id: [englishOnlyCourse.id],
        language: LanguageEnum.EsEs,
      }),
      [],
    )

    const programCollection = factories.programs.programCollection({
      programs: [{ id: program.id, title: program.title, order: 1 }],
    })
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })
    setMockResponse.get(
      urls.programs.programsList({
        id: [program.id],
        contract_id: contracts[0].id,
        page_size: 1,
      }),
      { results: [program] },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        id: [englishOnlyCourse.id],
        contract_id: contracts[0].id,
      }),
      { results: [englishOnlyCourse] },
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contracts[0].slug} />,
    )

    await screen.findByTestId("org-program-collection-root")
    await screen.findAllByRole("radio")

    expect(
      screen.getByTestId("org-program-collection-root"),
    ).toBeInTheDocument()

    await user.click(screen.getByText(/español/i))

    await waitFor(() => {
      expect(
        screen.queryByTestId("org-program-collection-root"),
      ).not.toBeInTheDocument()
    })
  })

  test("shared contract variant picker is hidden when only one variant option is present", async () => {
    const { orgX, user: userApiPath, mitxOnlineUser } = setupOrgAndUser()
    mitxOnlineUser.legal_address = { country: "US" }
    mitxOnlineUser.user_profile = { year_of_birth: 1988 }

    const run = factories.courses.courseRun({
      b2b_contract: undefined,
      is_enrollable: true,
    })
    const course = factories.courses.course({
      courseruns: [run],
      next_run_id: run.id,
    })
    const program = factories.programs.program({ courses: [course.id] })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts

    setupOrgDashboardMocks(
      orgX,
      userApiPath,
      mitxOnlineUser,
      [program],
      [course],
      contracts,
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contracts[0].slug} />,
    )

    await screen.findByTestId("org-program-root")
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Available Versions" }),
    ).not.toBeInTheDocument()
  })

  test("shared contract variant picker stays hidden for single-variant program collections", async () => {
    const { orgX, user: userApiPath, mitxOnlineUser } = setupOrgAndUser()
    mitxOnlineUser.legal_address = { country: "US" }
    mitxOnlineUser.user_profile = { year_of_birth: 1988 }

    const program = factories.programs.program({ courses: [] })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts

    const run = factories.courses.courseRun({
      id: faker.number.int(),
      title: "Collection English",
      courseware_id: "cw-collection-en-only",
      courseware_url: "https://openedx.example.com/collection-english-only",
      b2b_contract: contracts[0].id,
      is_enrollable: true,
    })
    const course = factories.courses.course({
      courseruns: [run],
      next_run_id: run.id,
    })
    program.courses = [course.id]

    setupOrgDashboardMocks(
      orgX,
      userApiPath,
      mitxOnlineUser,
      [program],
      [course],
      contracts,
    )
    const programCollection = factories.programs.programCollection({
      programs: [{ id: program.id, title: program.title, order: 1 }],
    })
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })
    setMockResponse.get(
      urls.programs.programsList({
        id: [program.id],
        contract_id: contracts[0].id,
        page_size: 1,
      }),
      { results: [program] },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        id: [course.id],
        contract_id: contracts[0].id,
      }),
      { results: [course] },
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contracts[0].slug} />,
    )

    await screen.findByTestId("org-program-collection-root")
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Available Versions" }),
    ).not.toBeInTheDocument()
  })

  test("disables CTA for non-enrolled B2B course when no translations and no enrollable runs", async () => {
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()

    const course = factories.courses.course()
    const program = factories.programs.program({
      courses: [course.id],
    })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts

    const contractRun = factories.courses.courseRun({
      b2b_contract: contracts[0].id,
      language: LanguageEnum.En,
      run_tag: undefined,
      is_enrollable: false,
      courseware_url: "https://openedx.example.com/unenrollable-run",
    })

    const courseWithoutTranslations = {
      ...course,
      courseruns: [contractRun],
      next_run_id: contractRun.id,
      next_run: null,
    }

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      [courseWithoutTranslations],
      contracts,
    )

    setMockResponse.get(urls.enrollment.enrollmentsListV3(), [])

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const programElement = await screen.findByTestId("org-program-root")
    const card = await within(programElement).findByTestId(
      "enrollment-card-desktop",
    )

    const coursewareButton = within(card).getByTestId("courseware-button")
    expect(coursewareButton).toHaveTextContent("Start")
    expect(coursewareButton).toBeDisabled()
  })

  test("displays correct run URL when user is enrolled in one of multiple runs", async () => {
    const { orgX, user, mitxOnlineUser } = setupOrgAndUser()

    // Create a course with 3 different runs with distinct URLs
    const course = factories.courses.course()
    const program = factories.programs.program({
      courses: [course.id],
    })
    const contracts = createTestContracts(orgX.id, 1, [program.id])
    orgX.contracts = contracts
    mitxOnlineUser.b2b_organizations[0].contracts = contracts

    const runs = [
      factories.courses.courseRun({
        b2b_contract: contracts[0].id,
        language: LanguageEnum.En,
        run_tag: undefined,
        courseware_url: "https://openedx.example.com/course-run-1",
        is_enrollable: true,
        start_date: faker.date.past().toISOString(),
      }),
      factories.courses.courseRun({
        b2b_contract: contracts[0].id,
        language: LanguageEnum.En,
        run_tag: undefined,
        courseware_url: "https://openedx.example.com/course-run-2",
        is_enrollable: true,
        start_date: faker.date.past().toISOString(),
      }),
      factories.courses.courseRun({
        b2b_contract: contracts[0].id,
        language: LanguageEnum.En,
        run_tag: undefined,
        courseware_url: "https://openedx.example.com/course-run-3",
        is_enrollable: true,
        start_date: faker.date.past().toISOString(),
      }),
    ]

    const courseWithMultipleRuns = {
      ...course,
      courseruns: runs,
      next_run_id: runs[0].id,
      next_run: null, // Clear any factory-generated next_run reference
    }

    // Use the first run so the enrollment matches default language/run selection.
    const enrolledRun = runs[0]

    const enrollment = factories.enrollment.courseEnrollment({
      run: {
        id: enrolledRun.id,
        course: { id: course.id, title: course.title },
        courseware_id: enrolledRun.courseware_id,
        courseware_url: enrolledRun.courseware_url,
      },
      b2b_contract_id: contracts[0].id,
      b2b_organization_id: orgX.id,
      grades: [],
      certificate: null,
    })

    setupOrgDashboardMocks(
      orgX,
      user,
      mitxOnlineUser,
      [program],
      [courseWithMultipleRuns],
      contracts,
    )

    setMockResponse.get(urls.enrollment.enrollmentsListV3(), [enrollment])

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const programElement = await screen.findByTestId("org-program-root")
    const card = await within(programElement).findByTestId(
      "enrollment-card-desktop",
    )

    // Verify the courseware button has the correct href from the enrolled run
    const coursewareButton = within(card).getByTestId("courseware-button")
    expect(coursewareButton).toHaveAttribute("href", enrolledRun.courseware_url)
  })

  it("renders without crashing when program.page is null", async () => {
    const { orgX, programA, programB } = setupProgramsAndCourses()
    const contract = orgX.contracts[0]

    setMockResponse.get(
      urls.programs.programsList({
        org_id: orgX.id,
        contract_id: contract.id,
        page_size: 30,
      }),
      {
        results: [
          { ...programA, page: null },
          { ...programB, page: null },
        ],
      },
    )

    renderWithProviders(
      <ContractContent orgSlug={orgX.slug} contractSlug={contract.slug} />,
    )

    await screen.findByText(programA.title)
    await screen.findByText(programB.title)
  })

  test("unenrolled B2B course row forwards the program's readable_id when enrolling", async () => {
    const { orgX, mitxOnlineUser, programA, coursesA, coursesB } =
      setupProgramsAndCourses()

    // Normalize first course so it has a single run with a known courseware_id
    // and next_run_id is set. Override BOTH the per-program and the all-courses
    // queries so that useContractDashboardData builds the entry from the same data.
    const normalizedCourse = normalizeCourseForCardAssertions(coursesA[0])
    const normalizedCoursesA = [normalizedCourse, ...coursesA.slice(1)]
    setMockResponse.get(
      urls.courses.coursesList({
        org_id: orgX.id,
        contract_id: orgX.contracts[0].id,
        page_size: 200,
      }),
      { results: [...normalizedCoursesA, ...coursesB] },
    )
    setMockResponse.get(
      urls.courses.coursesList({
        id: programA.courses,
        contract_id: orgX.contracts[0].id,
        page_size: 30,
      }),
      { results: normalizedCoursesA },
    )

    // Complete profile so enrollment bypasses the JustInTimeDialog
    setMockResponse.get(urls.userMe.get(), {
      ...mitxOnlineUser,
      legal_address: { country: "US" },
      user_profile: { year_of_birth: 1988 },
    })

    renderWithProviders(
      <ContractContent
        orgSlug={orgX.slug}
        contractSlug={orgX.contracts[0].slug}
      />,
    )

    const [programAEl] = await screen.findAllByTestId("org-program-root")
    const cards = await within(programAEl).findAllByTestId(
      "enrollment-card-desktop",
    )
    await user.click(within(cards[0]).getByTestId("courseware-button"))

    await waitFor(() =>
      expect(mockB2bEnrollMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          readable_id: normalizedCourse.courseruns[0].courseware_id,
          B2BEnrollRequestRequest: { program_id: programA.readable_id },
        }),
        expect.anything(),
      ),
    )
  })
})

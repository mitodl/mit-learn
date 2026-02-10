import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides, type PartialFactory } from "ol-test-utilities"
import * as u from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { setMockResponse } from "../../../test-utils"
import moment from "moment"
import {
  ContractPage,
  CourseRunEnrollmentRequestV2,
  CourseWithCourseRunsSerializerV2,
  OrganizationPage,
  User,
  V2Program,
} from "@mitodl/mitxonline-api-axios/v2"

const makeCourses = factories.courses.courses
const makeProgram = factories.programs.program
const makeProgramCollection = factories.programs.programCollection
const makeCourseEnrollment = factories.enrollment.courseEnrollment
const makeGrade = factories.enrollment.grade
const makeContract = factories.contracts.contract

const dashboardCourse: PartialFactory<CourseWithCourseRunsSerializerV2> = (
  ...overrides
) => {
  // Use the existing factory that creates proper CourseWithCourseRunsSerializerV2 objects
  const course = factories.courses.course()
  return mergeOverrides<CourseWithCourseRunsSerializerV2>(course, ...overrides)
}

const dashboardProgram: PartialFactory<V2Program> = (...overrides) => {
  // Use the existing factory that creates proper V2Program objects
  const program = makeProgram()
  return mergeOverrides<V2Program>(program, ...overrides)
}

const setupEnrollments = (includeExpired: boolean) => {
  const completed = [
    makeCourseEnrollment({
      b2b_contract_id: null, // Personal enrollment, not B2B
      run: { title: "C Course Ended" },
      grades: [makeGrade({ passed: true })],
    }),
  ]
  const expired = includeExpired
    ? [
        makeCourseEnrollment({
          b2b_contract_id: null, // Personal enrollment, not B2B
          run: {
            title: "A Course Ended",
            end_date: faker.date.past().toISOString(),
          },
        }),
        makeCourseEnrollment({
          b2b_contract_id: null, // Personal enrollment, not B2B
          run: {
            title: "B Course Ended",
            end_date: faker.date.past().toISOString(),
          },
        }),
      ]
    : []
  const started = [
    makeCourseEnrollment({
      b2b_contract_id: null, // Personal enrollment, not B2B
      run: {
        title: "A Course Started",
        start_date: faker.date.past().toISOString(),
      },
    }),
    makeCourseEnrollment({
      b2b_contract_id: null, // Personal enrollment, not B2B
      run: {
        title: "B Course Started",
        start_date: faker.date.past().toISOString(),
      },
    }),
  ]
  const notStarted = [
    makeCourseEnrollment({
      b2b_contract_id: null, // Personal enrollment, not B2B
      run: {
        start_date: moment().add(1, "day").toISOString(), // Sooner first
      },
    }),
    makeCourseEnrollment({
      b2b_contract_id: null, // Personal enrollment, not B2B
      run: {
        start_date: moment().add(5, "day").toISOString(), // Later second
      },
    }),
  ]
  const enrollments = faker.helpers.shuffle([
    ...expired,
    ...completed,
    ...started,
    ...notStarted,
  ])
  return {
    enrollments: enrollments,
    completed: completed,
    expired: expired,
    started: started,
    notStarted: notStarted,
  }
}

const setupProgramsAndCourses = () => {
  const user = u.factories.user.user()
  const orgX = factories.organizations.organization({ name: "Org X" })

  const contract = makeContract({
    organization: orgX.id,
    name: "Org X Contract",
    programs: [], // Will be set after creating programs
  })

  const coursesA = makeCourses({ count: 4 })
  const coursesB = makeCourses({ count: 3 })

  // Add contract IDs to course runs
  coursesA.results = coursesA.results.map((course) => ({
    ...course,
    courseruns: course.courseruns.map((run) => ({
      ...run,
      b2b_contract: contract.id,
      is_enrollable: true,
    })),
  }))
  coursesB.results = coursesB.results.map((course) => ({
    ...course,
    courseruns: course.courseruns.map((run) => ({
      ...run,
      b2b_contract: contract.id,
      is_enrollable: true,
    })),
  }))

  const programA = makeProgram({
    courses: coursesA.results.map((c) => c.id),
  })
  const programB = makeProgram({
    courses: coursesB.results.map((c) => c.id),
  })

  // Now set the programs on the contract
  contract.programs = [programA.id, programB.id]

  orgX.contracts = [contract]
  const mitxOnlineUser = factories.user.user({ b2b_organizations: [orgX] })
  setMockResponse.get(u.urls.userMe.get(), user)
  setMockResponse.get(urls.userMe.get(), mitxOnlineUser)
  setMockResponse.get(urls.organization.organizationList(""), orgX)
  setMockResponse.get(urls.organization.organizationList(orgX.slug), orgX)

  const programCollection = makeProgramCollection({
    title: "Program Collection",
    programs: [],
  })

  setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
    results: [programA, programB],
  })
  setMockResponse.get(
    urls.programs.programsList({
      org_id: orgX.id,
      contract_id: contract.id,
    }),
    {
      results: [programA, programB],
    },
  )
  setMockResponse.get(urls.programCollections.programCollectionsList(), {
    results: [programCollection],
  })
  setMockResponse.get(
    urls.programs.programsList({ id: [programA.id], org_id: orgX.id }),
    { results: [programA] },
  )
  setMockResponse.get(
    urls.programs.programsList({ id: [programB.id], org_id: orgX.id }),
    { results: [programB] },
  )
  setMockResponse.get(
    urls.courses.coursesList({
      org_id: orgX.id,
      contract_id: contract.id,
      page_size: 200,
    }),
    {
      results: [...coursesA.results, ...coursesB.results],
    },
  )
  setMockResponse.get(
    urls.courses.coursesList({
      id: programA.courses,
      contract_id: contract.id,
      page_size: 30,
    }),
    {
      results: coursesA.results,
    },
  )
  setMockResponse.get(
    urls.courses.coursesList({
      id: programB.courses,
      contract_id: contract.id,
      page_size: 30,
    }),
    {
      results: coursesB.results,
    },
  )

  return {
    orgX,
    user,
    mitxOnlineUser,
    programA,
    programB,
    programCollection,
    coursesA: coursesA.results,
    coursesB: coursesB.results,
  }
}

/**
 * Test utility to create enrollments for contract-scoped runs
 */
const createEnrollmentsForContractRuns = (
  courses: CourseWithCourseRunsSerializerV2[],
  contractIds: number[],
): CourseRunEnrollmentRequestV2[] => {
  return courses.flatMap((course) =>
    course.courseruns
      .filter(
        (run) => run.b2b_contract && contractIds.includes(run.b2b_contract),
      )
      .map((run) => ({
        ...factories.enrollment.courseEnrollment({
          run: {
            id: run.id,
            course: {
              id: course.id,
              title: course.title,
            },
            title: run.title,
          },
        }),
        b2b_contract_id: run.b2b_contract ?? null,
        b2b_organization_id: null, // Will be set by individual tests as needed
      })),
  )
}

/**
 * Helper function to set up organization, user, and related data
 */
function setupOrgAndUser() {
  const user = u.urls.userMe.get()
  const orgX = factories.organizations.organization({ name: "Test Org" })
  const mitxOnlineUser = factories.user.user({
    b2b_organizations: [
      {
        ...orgX,
        slug: `org-${orgX.slug}`,
      },
    ],
  })

  return { orgX, user, mitxOnlineUser }
}

/**
 * Helper function to set up all necessary API mocks for organization dashboard
 */
function setupOrgDashboardMocks(
  org: OrganizationPage,
  user: string,
  mitxOnlineUser: User,
  programs: V2Program[],
  courses: CourseWithCourseRunsSerializerV2[],
  contracts: ContractPage[],
) {
  // Basic user and org setup
  setMockResponse.get(u.urls.userMe.get(), user)
  setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)
  setMockResponse.get(
    mitxonline.urls.organization.organizationList(org.slug),
    org,
  )

  // Empty defaults
  setMockResponse.get(
    mitxonline.urls.programEnrollments.enrollmentsListV3(),
    [],
  )
  setMockResponse.get(mitxonline.urls.contracts.contractsList(), contracts)
  setMockResponse.get(
    mitxonline.urls.programCollections.programCollectionsList(),
    { results: [] },
  )

  // Program and course data
  setMockResponse.get(
    mitxonline.urls.programs.programsList({ org_id: org.id }),
    { results: programs },
  )

  // Mock programs query with contract filter
  if (contracts.length > 0) {
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        org_id: org.id,
        contract_id: contracts[0].id,
      }),
      { results: programs },
    )

    // Mock courses query with contract filter for program validation
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({
        org_id: org.id,
        contract_id: contracts[0].id,
        page_size: 200,
      }),
      { results: courses },
    )
  }

  programs.forEach((program) => {
    if (contracts.length > 0) {
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          contract_id: contracts[0].id,
          page_size: 30,
        }),
        { results: courses },
      )
    }
  })
}

/**
 * Test utility to create B2B contracts for testing
 */
const createTestContracts = (
  orgId: number,
  count: number = 1,
  programs: number[] = [],
): ContractPage[] =>
  Array.from({ length: count }, () =>
    makeContract({ organization: orgId, programs }),
  )

/**
 * Test utility to create courses with contract-scoped course runs
 */
const createCoursesWithContractRuns = (contracts: ContractPage[]) => {
  const contractIds = contracts.map((c) => c.id)

  return factories.courses.courses({ count: 3 }).results.map((course) => ({
    ...course,
    courseruns: [
      // First run associated with organization's contract
      {
        ...course.courseruns[0],
        id: faker.number.int(),
        b2b_contract: contractIds[0], // Associated with org contract
        is_enrollable: true,
        start_date: faker.date.future().toISOString(),
        end_date: faker.date.future().toISOString(),
        title: `${course.title} - Org Contract Run`,
      },
      // Second run associated with different organization's contract
      {
        ...course.courseruns[0],
        id: faker.number.int(),
        b2b_contract: faker.number.int(), // Different contract ID
        is_enrollable: true,
        start_date: faker.date.past().toISOString(),
        end_date: faker.date.past().toISOString(),
        title: `${course.title} - Other Org Run`,
      },
      // Third run with no contract (general enrollment)
      {
        ...course.courseruns[0],
        id: faker.number.int(),
        b2b_contract: null,
        is_enrollable: true,
        start_date: faker.date.future().toISOString(),
        end_date: faker.date.future().toISOString(),
        title: `${course.title} - General Run`,
      },
    ],
  }))
}

export {
  dashboardCourse,
  dashboardProgram,
  setupEnrollments,
  setupProgramsAndCourses,
  setupOrgAndUser,
  setupOrgDashboardMocks,
  createTestContracts,
  createCoursesWithContractRuns,
  createEnrollmentsForContractRuns,
}

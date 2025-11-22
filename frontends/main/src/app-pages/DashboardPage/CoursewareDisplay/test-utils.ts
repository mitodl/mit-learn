import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides, type PartialFactory } from "ol-test-utilities"
import {
  DashboardResourceType,
  EnrollmentMode,
  EnrollmentStatus,
} from "./types"
import type { DashboardCourse } from "./types"
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

const dashboardCourse: PartialFactory<DashboardCourse> = (...overrides) => {
  return mergeOverrides<DashboardCourse>(
    {
      key: faker.string.uuid(),
      coursewareId: faker.string.uuid(),
      type: DashboardResourceType.Course,
      title: faker.commerce.productName(),
      marketingUrl: faker.internet.url(),
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.future().toISOString(),
        certificateUpgradeDeadline: faker.date.future().toISOString(),
        certificateUpgradePrice: faker.commerce.price(),
        canUpgrade: true,
        coursewareUrl: faker.internet.url(),
      },
      enrollment: {
        id: faker.number.int(),
        status: faker.helpers.arrayElement(Object.values(EnrollmentStatus)),
        mode: faker.helpers.arrayElement(Object.values(EnrollmentMode)),
      },
    },
    ...overrides,
  )
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
  })
  orgX.contracts = [contract]
  const mitxOnlineUser = factories.user.user({ b2b_organizations: [orgX] })
  setMockResponse.get(u.urls.userMe.get(), user)
  setMockResponse.get(urls.userMe.get(), mitxOnlineUser)
  setMockResponse.get(urls.organization.organizationList(""), orgX)
  setMockResponse.get(urls.organization.organizationList(orgX.slug), orgX)

  const coursesA = makeCourses({ count: 4 })
  const coursesB = makeCourses({ count: 3 })
  const programA = makeProgram({
    courses: coursesA.results.map((c) => c.id),
  })
  const programB = makeProgram({
    courses: coursesB.results.map((c) => c.id),
  })
  const programCollection = makeProgramCollection({
    title: "Program Collection",
    programs: [],
  })

  setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
    results: [programA, programB],
  })
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
      id: programA.courses,
      org_id: orgX.id,
      page_size: 30,
    }),
    {
      results: coursesA.results,
    },
  )
  setMockResponse.get(
    urls.courses.coursesList({
      id: programB.courses,
      org_id: orgX.id,
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
  setMockResponse.get(mitxonline.urls.enrollment.enrollmentsList(), [])
  setMockResponse.get(mitxonline.urls.programEnrollments.enrollmentsList(), [])
  setMockResponse.get(
    mitxonline.urls.programEnrollments.enrollmentsListV2(),
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

  programs.forEach((program) => {
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({
        id: program.courses,
        org_id: org.id,
        page_size: 30,
      }),
      { results: courses },
    )
  })
}

/**
 * Test utility to create B2B contracts for testing
 */
const createTestContracts = (
  orgId: number,
  count: number = 1,
): ContractPage[] =>
  Array.from({ length: count }, () => makeContract({ organization: orgId }))

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
        start_date: faker.date.future().toISOString(),
        end_date: faker.date.future().toISOString(),
        title: `${course.title} - Org Contract Run`,
      },
      // Second run associated with different organization's contract
      {
        ...course.courseruns[0],
        id: faker.number.int(),
        b2b_contract: faker.number.int(), // Different contract ID
        start_date: faker.date.past().toISOString(),
        end_date: faker.date.past().toISOString(),
        title: `${course.title} - Other Org Run`,
      },
      // Third run with no contract (general enrollment)
      {
        ...course.courseruns[0],
        id: faker.number.int(),
        b2b_contract: null,
        start_date: faker.date.future().toISOString(),
        end_date: faker.date.future().toISOString(),
        title: `${course.title} - General Run`,
      },
    ],
  }))
}

export {
  dashboardCourse,
  setupEnrollments,
  setupProgramsAndCourses,
  setupOrgAndUser,
  setupOrgDashboardMocks,
  createTestContracts,
  createCoursesWithContractRuns,
  createEnrollmentsForContractRuns,
}

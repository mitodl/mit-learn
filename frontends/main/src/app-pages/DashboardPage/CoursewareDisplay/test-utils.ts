import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides, type PartialFactory } from "ol-test-utilities"
import {
  DashboardResourceType,
  EnrollmentMode,
  EnrollmentStatus,
} from "./types"
import type { DashboardCourse } from "./types"
import * as u from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { setMockResponse } from "../../../test-utils"
import moment from "moment"

const makeCourses = factories.courses.courses
const makeProgram = factories.programs.program
const makeProgramCollection = factories.programs.programCollection
const makeCourseEnrollment = factories.enrollment.courseEnrollment
const makeGrade = factories.enrollment.grade

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
      run: { title: "C Course Ended" },
      grades: [makeGrade({ passed: true })],
    }),
  ]
  const expired = includeExpired
    ? [
        makeCourseEnrollment({
          run: {
            title: "A Course Ended",
            end_date: faker.date.past().toISOString(),
          },
        }),
        makeCourseEnrollment({
          run: {
            title: "B Course Ended",
            end_date: faker.date.past().toISOString(),
          },
        }),
      ]
    : []
  const started = [
    makeCourseEnrollment({
      run: {
        title: "A Course Started",
        start_date: faker.date.past().toISOString(),
      },
    }),
    makeCourseEnrollment({
      run: {
        title: "B Course Started",
        start_date: faker.date.past().toISOString(),
      },
    }),
  ]
  const notStarted = [
    makeCourseEnrollment({
      run: {
        start_date: moment().add(1, "day").toISOString(), // Sooner first
      },
    }),
    makeCourseEnrollment({
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
  const mitxOnlineUser = factories.user.user({ b2b_organizations: [orgX] })
  setMockResponse.get(u.urls.userMe.get(), user)
  setMockResponse.get(urls.currentUser.get(), mitxOnlineUser)
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
    urls.programs.programsList({ id: programA.id, org_id: orgX.id }),
    { results: [programA] },
  )
  setMockResponse.get(
    urls.programs.programsList({ id: programB.id, org_id: orgX.id }),
    { results: [programB] },
  )
  setMockResponse.get(
    urls.courses.coursesList({ id: programA.courses, org_id: orgX.id }),
    {
      results: coursesA.results,
    },
  )
  setMockResponse.get(
    urls.courses.coursesList({ id: programB.courses, org_id: orgX.id }),
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

export { dashboardCourse, setupEnrollments, setupProgramsAndCourses }

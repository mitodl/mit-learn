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

const makeCourses = factories.courses.courses
const makeProgram = factories.programs.program

const dashboardCourse: PartialFactory<DashboardCourse> = (...overrides) => {
  return mergeOverrides<DashboardCourse>(
    {
      id: faker.string.uuid(),
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
        status: faker.helpers.arrayElement(Object.values(EnrollmentStatus)),
        mode: faker.helpers.arrayElement(Object.values(EnrollmentMode)),
      },
    },
    ...overrides,
  )
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

  setMockResponse.get(urls.programs.programsList({ org_id: orgX.id }), {
    results: [programA, programB],
  })
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
    coursesA: coursesA.results,
    coursesB: coursesB.results,
  }
}

export { dashboardCourse, setupProgramsAndCourses }

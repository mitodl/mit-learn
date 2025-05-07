import * as mitx from "./enrollment"
import * as programs from "./programs"
import * as courses from "./courses"
import * as u from "api/test-utils"
import { urls } from "api/mitxonline-test-utils"
import { mockOrgData } from "../../hooks/enrollment"
import { setMockResponse } from "../../../test-utils"

const setupProgramsAndCourses = () => {
  const user = u.factories.user.user()
  setMockResponse.get(u.urls.userMe.get(), user)

  const orgId = mockOrgData.orgX.id
  const coursesA = courses.courses({ count: 4 })
  const coursesB = courses.courses({ count: 3 })
  const programA = programs.program({
    courses: coursesA.results.map((c) => c.id),
  })
  const programB = programs.program({
    courses: coursesB.results.map((c) => c.id),
  })

  setMockResponse.get(
    urls.programs.programsList({ orgId: mockOrgData.orgX.id }),
    { results: [programA, programB] },
  )
  setMockResponse.get(urls.courses.coursesList({ id: programA.courses }), {
    results: coursesA.results,
  })
  setMockResponse.get(urls.courses.coursesList({ id: programB.courses }), {
    results: coursesB.results,
  })

  return {
    orgId,
    user,
    programA,
    programB,
    coursesA: coursesA.results,
    coursesB: coursesB.results,
  }
}

export { mitx as enrollment, programs, courses, setupProgramsAndCourses }

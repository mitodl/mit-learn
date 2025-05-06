import type { CoursesApiApiV2CoursesListRequest } from "@mitodl/mitxonline-api-axios/v0"
import { queryify } from "ol-test-utilities"
import type { EnrollmentsListOptions } from "../hooks/enrollment/queries"
import type { ProgramsListRequest } from "../hooks/programs/queries"
const API_BASE_URL = process.env.NEXT_PUBLIC_MITXONLINE_API_BASE_URL

const enrollment = {
  courseEnrollment: (opts?: EnrollmentsListOptions) =>
    `${API_BASE_URL}/api/v1/enrollments/${queryify(opts)}`,
}

const programs = {
  programsList: (opts?: ProgramsListRequest) =>
    `${API_BASE_URL}/api/v2/programs/${queryify(opts)}`,
}

const courses = {
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) =>
    `${API_BASE_URL}/api/v2/courses/${queryify(opts, { explode: false })}`,
}

export { enrollment, programs, courses }

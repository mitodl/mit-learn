import type {
  CoursesApiApiV2CoursesListRequest,
  ProgramsApiProgramsListV2Request,
} from "@mitodl/mitxonline-api-axios/v1"
import { RawAxiosRequestConfig } from "axios"
import { queryify } from "ol-test-utilities"

const API_BASE_URL = process.env.NEXT_PUBLIC_MITXONLINE_API_BASE_URL

const enrollment = {
  courseEnrollment: (opts?: RawAxiosRequestConfig) =>
    `${API_BASE_URL}/api/v1/enrollments/${queryify(opts)}`,
}

const programs = {
  programsList: (opts?: ProgramsApiProgramsListV2Request) =>
    `${API_BASE_URL}/api/v2/programs/${queryify(opts)}`,
}

const courses = {
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) =>
    `${API_BASE_URL}/api/v2/courses/${queryify(opts, { explode: false })}`,
}

export { enrollment, programs, courses }

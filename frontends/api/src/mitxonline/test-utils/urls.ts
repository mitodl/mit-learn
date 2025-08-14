import type {
  CoursesApiApiV2CoursesListRequest,
  ProgramCollectionsApiProgramCollectionsListRequest,
  ProgramsApiProgramsListV2Request,
} from "@mitodl/mitxonline-api-axios/v2"
import { RawAxiosRequestConfig } from "axios"
import { queryify } from "ol-test-utilities"

const API_BASE_URL = process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL

const currentUser = {
  get: (opts?: RawAxiosRequestConfig) =>
    `${API_BASE_URL}/api/v0/users/current_user/${queryify(opts)}`,
}

const enrollment = {
  enrollmentsList: () => `${API_BASE_URL}/api/v1/enrollments/`,
  courseEnrollment: (id?: number) =>
    `${API_BASE_URL}/api/v1/enrollments/${id ? `${id}/` : ""}`,
}

const b2b = {
  courseEnrollment: (readableId?: string) =>
    `${API_BASE_URL}/api/v0/b2b/enroll/${readableId}/`,
}

const programs = {
  programsList: (opts?: ProgramsApiProgramsListV2Request) =>
    `${API_BASE_URL}/api/v2/programs/${queryify(opts)}`,
  programDetail: (id: number) => `${API_BASE_URL}/api/v2/programs/${id}/`,
}

const programCollections = {
  programCollectionsList: (
    opts?: ProgramCollectionsApiProgramCollectionsListRequest,
  ) => `${API_BASE_URL}/api/v2/program-collections/${queryify(opts)}`,
}

const courses = {
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) =>
    `${API_BASE_URL}/api/v2/courses/${queryify(opts, { explode: false })}`,
}

const organization = {
  organizationList: (organizationSlug: string) =>
    `${API_BASE_URL}/api/v0/b2b/organizations/${organizationSlug}/`,
}

const b2bAttach = {
  b2bAttachView: (code: string) => `${API_BASE_URL}/api/v0/b2b/attach/${code}/`,
}

export {
  b2b,
  b2bAttach,
  currentUser,
  enrollment,
  programs,
  programCollections,
  courses,
  organization,
}

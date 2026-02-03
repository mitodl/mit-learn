import type {
  CoursesApiApiV2CoursesListRequest,
  CourseCertificatesApiCourseCertificatesRetrieveRequest,
  ProgramCertificatesApiProgramCertificatesRetrieveRequest,
  ProgramCollectionsApiProgramCollectionsListRequest,
  ProgramsApiProgramsListV2Request,
} from "@mitodl/mitxonline-api-axios/v2"
import { queryify } from "ol-test-utilities"

const API_BASE_URL = process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL

const userMe = {
  get: () => `${API_BASE_URL}/api/v0/users/me`,
}

const countries = {
  list: () => `${API_BASE_URL}/api/v0/countries/`,
}

const enrollment = {
  courseEnrollment: (id?: number) =>
    `${API_BASE_URL}/api/v1/enrollments/${id ? `${id}/` : ""}`,
  enrollmentsListV1: () => `${API_BASE_URL}/api/v1/enrollments/`,
  enrollmentsListV2: () => `${API_BASE_URL}/api/v2/enrollments/`,
}

const programEnrollments = {
  enrollmentsListV3: () => `${API_BASE_URL}/api/v3/program_enrollments/`,
}

const b2b = {
  courseEnrollment: (readableId?: string) =>
    `${API_BASE_URL}/api/v0/b2b/enroll/${readableId}/`,
}

const programs = {
  programsList: (opts?: ProgramsApiProgramsListV2Request) =>
    `${API_BASE_URL}/api/v2/programs/${queryify(opts, { explode: false })}`,
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

const pages = {
  coursePages: (readableId: string) =>
    `${API_BASE_URL}/api/v2/pages/?fields=*&type=cms.coursepage&readable_id=${encodeURIComponent(
      readableId,
    )}`,
  programPages: (readableId: string) =>
    `${API_BASE_URL}/api/v2/pages/?fields=*&type=cms.programpage&readable_id=${encodeURIComponent(
      readableId,
    )}`,
}

const organization = {
  organizationList: (organizationSlug: string) =>
    `${API_BASE_URL}/api/v0/b2b/organizations/${organizationSlug}/`,
}

const b2bAttach = {
  b2bAttachView: (code: string) => `${API_BASE_URL}/api/v0/b2b/attach/${code}/`,
}

const contracts = {
  contractsList: () => `${API_BASE_URL}/api/v0/b2b/contracts/`,
}

const certificates = {
  courseCertificatesRetrieve: (
    params: CourseCertificatesApiCourseCertificatesRetrieveRequest,
  ) => `${API_BASE_URL}/api/v2/course_certificates/${params.cert_uuid}/`,
  programCertificatesRetrieve: (
    params: ProgramCertificatesApiProgramCertificatesRetrieveRequest,
  ) => `${API_BASE_URL}/api/v2/program_certificates/${params.cert_uuid}/`,
}

const products = {
  userFlexiblePriceDetail: (productId: number) =>
    `${API_BASE_URL}/api/v0/products/${productId}/user_flexible_price/`,
}

const baskets = {
  createFromProduct: (productId: number) =>
    `${API_BASE_URL}/api/v0/baskets/create_from_product/${productId}/`,
  clear: () => `${API_BASE_URL}/api/v0/baskets/clear/`,
}

export {
  b2b,
  b2bAttach,
  userMe,
  countries,
  enrollment,
  programs,
  programCollections,
  courses,
  pages,
  organization,
  programEnrollments,
  contracts,
  certificates,
  products,
  baskets,
}

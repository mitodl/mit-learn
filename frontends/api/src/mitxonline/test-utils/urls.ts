import type {
  CoursesApiApiV2CoursesListRequest,
  CoursesApiCourseVariantRunsV3Request,
  CourseCertificatesApiCourseCertificatesRetrieveRequest,
  ProgramCertificatesApiProgramCertificatesRetrieveRequest,
  ProgramCollectionsApiProgramCollectionsListRequest,
  ProgramsApiProgramsListV2Request,
} from "@mitodl/mitxonline-api-axios/v2"
import { queryify } from "ol-test-utilities"
import mitxAxios from "../axios"

// Keep these helpers absolute so the shared request mock can distinguish Learn
// and MITx requests by origin; switching to path-only URLs would reintroduce
// cross-backend collisions in tests. The base URL is read from the configured
// axios instance (the single source of truth).
const getApiBaseUrl = () => mitxAxios.defaults.baseURL

const userMe = {
  get: () => `${getApiBaseUrl()}/api/v0/users/me`,
}

const countries = {
  list: () => `${getApiBaseUrl()}/api/v0/countries/`,
}

const enrollment = {
  courseEnrollment: (id?: number) =>
    `${getApiBaseUrl()}/api/v1/enrollments/${id ? `${id}/` : ""}`,
  enrollmentsListV1: () => `${getApiBaseUrl()}/api/v1/enrollments/`,
  enrollmentsListV2: () => `${getApiBaseUrl()}/api/v2/enrollments/`,
  enrollmentsListV3: () => `${getApiBaseUrl()}/api/v3/enrollments/`,
}

const programEnrollments = {
  enrollmentsListV3: () => `${getApiBaseUrl()}/api/v3/program_enrollments/`,
  programEnrollment: (programId: number) =>
    `${getApiBaseUrl()}/api/v3/program_enrollments/${programId}/`,
}

const b2b = {
  courseEnrollment: (readableId?: string) =>
    `${getApiBaseUrl()}/api/v0/b2b/enroll/${readableId}/`,
}

const programs = {
  programsList: (opts?: ProgramsApiProgramsListV2Request) =>
    `${getApiBaseUrl()}/api/v2/programs/${queryify(opts, { explode: false })}`,
  programDetail: (id: number) => `${getApiBaseUrl()}/api/v2/programs/${id}/`,
}

const programCollections = {
  programCollectionsList: (
    opts?: ProgramCollectionsApiProgramCollectionsListRequest,
  ) => `${getApiBaseUrl()}/api/v2/program-collections/${queryify(opts)}`,
}

const courses = {
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) =>
    `${getApiBaseUrl()}/api/v2/courses/${queryify(opts, { explode: false })}`,
  courseOutline: (coursewareId: string) =>
    `${getApiBaseUrl()}/api/v3/courses/${encodeURIComponent(coursewareId)}/ol_openedx_outline/`,
  courseVariantRuns: (opts: CoursesApiCourseVariantRunsV3Request) =>
    `${getApiBaseUrl()}/api/v3/courses/variant_runs/${queryify(opts)}`,
}

const pages = {
  coursePages: (readableId: string) =>
    `${getApiBaseUrl()}/api/v2/pages/?fields=*&type=cms.coursepage&readable_id=${encodeURIComponent(
      readableId,
    )}`,
  programPages: (readableId: string) =>
    `${getApiBaseUrl()}/api/v2/pages/?fields=*&type=cms.programpage&readable_id=${encodeURIComponent(
      readableId,
    )}`,
}

const organization = {
  organizationList: (organizationSlug: string) =>
    `${getApiBaseUrl()}/api/v0/b2b/organizations/${organizationSlug}/`,
  managerOrganizationsList: () =>
    `${getApiBaseUrl()}/api/v0/b2b/manager/organizations/`,
}

const b2bAttach = {
  b2bAttachView: (code: string) =>
    `${getApiBaseUrl()}/api/v0/b2b/attach/${code}/`,
}

const contracts = {
  contractsList: () => `${getApiBaseUrl()}/api/v0/b2b/contracts/`,
  managerContractDetail: (orgId: number, contractId: number) =>
    `${getApiBaseUrl()}/api/v0/b2b/manager/organizations/${orgId}/contracts/${contractId}/`,
  managerContractCodes: (orgId: number, contractId: number) =>
    `${getApiBaseUrl()}/api/v0/b2b/manager/organizations/${orgId}/contracts/${contractId}/codes/`,
  managerContractBulkAssign: (orgId: number, contractId: number) =>
    `${getApiBaseUrl()}/api/v0/b2b/manager/organizations/${orgId}/contracts/${contractId}/codes/bulk_assign/`,
  managerContractCodeRemind: (
    orgId: number,
    contractId: number,
    code: string,
  ) =>
    `${getApiBaseUrl()}/api/v0/b2b/manager/organizations/${orgId}/contracts/${contractId}/codes/${code}/remind/`,
  managerContractCodeRevoke: (
    orgId: number,
    contractId: number,
    code: string,
  ) =>
    `${getApiBaseUrl()}/api/v0/b2b/manager/organizations/${orgId}/contracts/${contractId}/codes/${code}/revoke/`,
  managerContractCodeReassign: (
    orgId: number,
    contractId: number,
    code: string,
  ) =>
    `${getApiBaseUrl()}/api/v0/b2b/manager/organizations/${orgId}/contracts/${contractId}/codes/${code}/reassign/`,
}

const certificates = {
  courseCertificatesRetrieve: (
    params: CourseCertificatesApiCourseCertificatesRetrieveRequest,
  ) => `${getApiBaseUrl()}/api/v2/course_certificates/${params.uuid}/`,
  programCertificatesRetrieve: (
    params: ProgramCertificatesApiProgramCertificatesRetrieveRequest,
  ) => `${getApiBaseUrl()}/api/v2/program_certificates/${params.uuid}/`,
}

const products = {
  userFlexiblePriceDetail: (productId: number) =>
    `${getApiBaseUrl()}/api/v0/products/${productId}/user_flexible_price/`,
}

const baskets = {
  createFromProduct: (productId: number) =>
    `${getApiBaseUrl()}/api/v0/baskets/create_from_product/${productId}/`,
  clear: () => `${getApiBaseUrl()}/api/v0/baskets/clear/`,
}

const orders = {
  receipt: (orderId: number) =>
    `${getApiBaseUrl()}/api/v0/orders/receipt/${orderId}/`,
}

const verifiedProgramEnrollments = {
  create: (courserunId: string) =>
    `${getApiBaseUrl()}/api/v2/verified_program_enrollments/${encodeURIComponent(courserunId)}/`,
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
  orders,
  verifiedProgramEnrollments,
}

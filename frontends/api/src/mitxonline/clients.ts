import {
  B2bApi,
  CoursesApi,
  CourseCertificatesApi,
  EnrollmentsApi,
  ProgramCollectionsApi,
  ProgramsApi,
  ProgramCertificatesApi,
  UsersApi,
} from "@mitodl/mitxonline-api-axios/v2"
import axios, { AxiosInstance } from "axios"

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL,
  xsrfCookieName: process.env.NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME,
  xsrfHeaderName: "X-CSRFToken",
  withXSRFToken: true,
  withCredentials:
    process.env.NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS === "true",
})

const BASE_PATH =
  process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL?.replace(/\/+$/, "") ?? ""

class B2BAttachApi {
  private axiosInstance: AxiosInstance
  private basePath: string

  constructor(
    _config: unknown = undefined,
    basePath: string,
    axiosInstance: AxiosInstance,
  ) {
    this.basePath = basePath
    this.axiosInstance = axiosInstance
  }

  async attach(code: string, data?: unknown, options?: unknown) {
    const url = `${this.basePath}/api/v0/b2b/attach/${encodeURIComponent(code)}/`
    return this.axiosInstance.post(url, data, options || undefined)
  }
}

const usersApi = new UsersApi(undefined, BASE_PATH, axiosInstance)
const b2bApi = new B2bApi(undefined, BASE_PATH, axiosInstance)
const programsApi = new ProgramsApi(undefined, BASE_PATH, axiosInstance)
const programCollectionsApi = new ProgramCollectionsApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

const programCertificatesApi = new ProgramCertificatesApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

const coursesApi = new CoursesApi(undefined, BASE_PATH, axiosInstance)
const b2bAttachApi = new B2BAttachApi(undefined, BASE_PATH, axiosInstance)

const courseCertificatesApi = new CourseCertificatesApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

const courseRunEnrollmentsApi = new EnrollmentsApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

export {
  usersApi,
  b2bApi,
  courseRunEnrollmentsApi,
  b2bAttachApi,
  programsApi,
  programCollectionsApi,
  coursesApi,
  programCertificatesApi,
  courseCertificatesApi,
  axiosInstance,
}

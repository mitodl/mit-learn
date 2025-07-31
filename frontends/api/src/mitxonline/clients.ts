import {
  B2bApi,
  CoursesApi,
  CourseCertificatesApi,
  EnrollmentsApi,
  ProgramsApi,
  ProgramCertificatesApi,
  UsersApi,
} from "@mitodl/mitxonline-api-axios/v2"
import axios from "axios"

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

const usersApi = new UsersApi(undefined, BASE_PATH, axiosInstance)
const b2bApi = new B2bApi(undefined, BASE_PATH, axiosInstance)
const enrollmentsApi = new EnrollmentsApi(undefined, BASE_PATH, axiosInstance)
const programsApi = new ProgramsApi(undefined, BASE_PATH, axiosInstance)
const coursesApi = new CoursesApi(undefined, BASE_PATH, axiosInstance)
const courseCertificatesApi = new CourseCertificatesApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)
const programCertificatesApi = new ProgramCertificatesApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

export {
  usersApi,
  b2bApi,
  enrollmentsApi,
  programsApi,
  courseCertificatesApi,
  programCertificatesApi,
  programCollectionsApi,
  coursesApi,
  axiosInstance,
}

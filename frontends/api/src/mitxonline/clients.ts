import {
  B2bApi,
  BasketsApi,
  CoursesApi,
  CourseCertificatesApi,
  EnrollmentsApi,
  ProgramCollectionsApi,
  ProgramsApi,
  ProgramCertificatesApi,
  UsersApi,
  ProgramEnrollmentsApi,
  PagesApi,
  CountriesApi,
  ProductsApi,
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
const countriesApi = new CountriesApi(undefined, BASE_PATH, axiosInstance)
const b2bApi = new B2bApi(undefined, BASE_PATH, axiosInstance)
const basketsApi = new BasketsApi(undefined, BASE_PATH, axiosInstance)
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

const programEnrollmentsApi = new ProgramEnrollmentsApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

const pagesApi = new PagesApi(undefined, BASE_PATH, axiosInstance)

const productsApi = new ProductsApi(undefined, BASE_PATH, axiosInstance)

export {
  usersApi,
  countriesApi,
  b2bApi,
  basketsApi,
  courseRunEnrollmentsApi,
  programEnrollmentsApi,
  programsApi,
  programCollectionsApi,
  coursesApi,
  programCertificatesApi,
  courseCertificatesApi,
  axiosInstance,
  pagesApi,
  productsApi,
}

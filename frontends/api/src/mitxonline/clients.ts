import {
  B2bApi,
  BasketsApi,
  UsersApi,
  CountriesApi,
  ProductsApi,
  OrdersApi,
} from "@mitodl/mitxonline-api-axios/v0"
import { EnrollmentsApi as EnrollmentsApiV1 } from "@mitodl/mitxonline-api-axios/v1"
import {
  CoursesApi,
  CourseCertificatesApi,
  ProgramCollectionsApi,
  ProgramsApi,
  ProgramCertificatesApi,
  PagesApi,
  VerifiedProgramEnrollmentsApi,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  CoursesApi as CoursesApiV3,
  EnrollmentsApi as EnrollmentsApiV3,
  ProgramEnrollmentsApi,
} from "@mitodl/mitxonline-api-axios/v3"
import axiosInstance from "./axios"

const BASE_PATH = ""

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
const coursesV3Api = new CoursesApiV3(undefined, BASE_PATH, axiosInstance)

const courseCertificatesApi = new CourseCertificatesApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

const courseRunEnrollmentsApi = new EnrollmentsApiV1(
  undefined,
  BASE_PATH,
  axiosInstance,
)

const courseRunEnrollmentsV3Api = new EnrollmentsApiV3(
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

const verifiedProgramEnrollmentsApi = new VerifiedProgramEnrollmentsApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

const ordersApi = new OrdersApi(undefined, BASE_PATH, axiosInstance)

export {
  usersApi,
  countriesApi,
  b2bApi,
  basketsApi,
  courseRunEnrollmentsApi,
  courseRunEnrollmentsV3Api,
  programEnrollmentsApi,
  programsApi,
  programCollectionsApi,
  coursesApi,
  coursesV3Api,
  programCertificatesApi,
  courseCertificatesApi,
  axiosInstance,
  pagesApi,
  productsApi,
  verifiedProgramEnrollmentsApi,
  ordersApi,
}

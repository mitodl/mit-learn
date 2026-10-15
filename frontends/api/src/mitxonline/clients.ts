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
  VerifiedProgramEnrollmentsApi,
  OrdersApi,
} from "@mitodl/mitxonline-api-axios/v2"
// The enrollment eligibility endpoints are only in the v1 client module.
import {
  CourseRunsApi as CourseRunsV1Api,
  ProgramsApi as ProgramsV1Api,
} from "@mitodl/mitxonline-api-axios/v1"
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

const verifiedProgramEnrollmentsApi = new VerifiedProgramEnrollmentsApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

const ordersApi = new OrdersApi(undefined, BASE_PATH, axiosInstance)

const courseRunsV1Api = new CourseRunsV1Api(undefined, BASE_PATH, axiosInstance)

const programsV1Api = new ProgramsV1Api(undefined, BASE_PATH, axiosInstance)

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
  verifiedProgramEnrollmentsApi,
  ordersApi,
  courseRunsV1Api,
  programsV1Api,
}

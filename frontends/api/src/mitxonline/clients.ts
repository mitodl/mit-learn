import {
  CoursesApi,
  EnrollmentsApi,
  ProgramsApi,
} from "@mitodl/mitxonline-api-axios/v1"
import axios from "axios"

const axiosInstance = axios.create({
  baseURL: "https://mitxonline.c4103.com/",
  xsrfCookieName: process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME,
  xsrfHeaderName: "X-CSRFToken",
  withXSRFToken: true,
  withCredentials:
    process.env.NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS === "true",
})

const BASE_PATH =
  process.env.NEXT_PUBLIC_MITXONLINE_API_BASE_URL?.replace(/\/+$/, "") ?? ""

const enrollmentsApi = new EnrollmentsApi(undefined, BASE_PATH, axiosInstance)
const programsApi = new ProgramsApi(undefined, BASE_PATH, axiosInstance)
const coursesApi = new CoursesApi(undefined, BASE_PATH, axiosInstance)

export { enrollmentsApi, programsApi, coursesApi, axiosInstance }

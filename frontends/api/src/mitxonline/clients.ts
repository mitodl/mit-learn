import { EnrollmentsApi, ProgramsApi, CoursesApi } from "./generated/v0/api"
import axios from "axios"

const axiosInstance = axios.create({})

const BASE_PATH =
  process.env.NEXT_PUBLIC_MITXONLINE_API_BASE_URL?.replace(/\/+$/, "") ?? ""

const enrollmentsApi = new EnrollmentsApi(undefined, BASE_PATH, axiosInstance)
const programsApi = new ProgramsApi(undefined, BASE_PATH, axiosInstance)
const coursesApi = new CoursesApi(undefined, BASE_PATH, axiosInstance)

export { enrollmentsApi, programsApi, coursesApi, axiosInstance }

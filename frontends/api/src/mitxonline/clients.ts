import { EnrollmentsApi, ProgramsApi, CoursesApi } from "./generated/v0/api"
import axios from "axios"

const instance = axios.create({})

const BASE_PATH =
  process.env.NEXT_PUBLIC_MITXONLINE_API_BASE_URL?.replace(/\/+$/, "") ?? ""

const enrollmentsApi = new EnrollmentsApi(undefined, BASE_PATH, instance)
const programsApi = new ProgramsApi(undefined, BASE_PATH, instance)
const coursesApi = new CoursesApi(undefined, BASE_PATH, instance)

export { enrollmentsApi, programsApi, coursesApi }

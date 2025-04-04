import { EnrollmentsApi } from "./generated/v0/api"
import axios from "axios"

const instance = axios.create({})

const BASE_PATH =
  process.env.NEXT_PUBLIC_MITXONLINE_API_BASE_URL?.replace(/\/+$/, "") ?? ""

const enrollmentsApi = new EnrollmentsApi(undefined, BASE_PATH, instance)

export { enrollmentsApi }

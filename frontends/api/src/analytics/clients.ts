import {
  ContractsApi,
  LearnersApi,
  NeedsAttentionApi,
} from "@mitodl/ol-analytics-dashboard-api-axios"
import axiosInstance from "./axios"

/**
 * Generated paths already carry the b2b_dashboard tenant's mount prefix
 * (`/api/v1/analytics`), and the configured axios `baseURL` is the API host,
 * so the generated client needs no base path of its own.
 */
const BASE_PATH = ""

const contractsApi = new ContractsApi(undefined, BASE_PATH, axiosInstance)
const learnersApi = new LearnersApi(undefined, BASE_PATH, axiosInstance)
const needsAttentionApi = new NeedsAttentionApi(
  undefined,
  BASE_PATH,
  axiosInstance,
)

export { contractsApi, learnersApi, needsAttentionApi }

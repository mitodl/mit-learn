import axios from "axios"
import type { LearnApiConfig } from "./runtime"

const instance = axios.create({
  xsrfHeaderName: "X-CSRFToken",
  withXSRFToken: true,
})

let configured = false

instance.interceptors.request.use((request) => {
  if (!configured) {
    throw new Error(
      "API clients are not configured. Call configureApiClients(...) before making requests.",
    )
  }
  return request
})

export const applyLearnAxiosConfig = (config: LearnApiConfig) => {
  instance.defaults.baseURL = config.baseUrl
  instance.defaults.xsrfCookieName = config.csrfCookieName
  instance.defaults.withCredentials = config.withCredentials
  configured = true
}

export const resetLearnAxiosForTests = () => {
  configured = false
  delete instance.defaults.baseURL
  delete instance.defaults.xsrfCookieName
  delete instance.defaults.withCredentials
}

export default instance

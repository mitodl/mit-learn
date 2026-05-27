import axios from "axios"
import type { MitxOnlineApiConfig } from "../runtime"

const mitxAxios = axios.create({
  xsrfHeaderName: "X-CSRFToken",
  withXSRFToken: true,
})

let configured = false

mitxAxios.interceptors.request.use((request) => {
  if (!configured) {
    throw new Error(
      "API clients are not configured. Call configureApiClients(...) before making requests.",
    )
  }
  return request
})

export const applyMitxOnlineAxiosConfig = (config: MitxOnlineApiConfig) => {
  mitxAxios.defaults.baseURL = config.baseUrl
  mitxAxios.defaults.xsrfCookieName = config.csrfCookieName
  mitxAxios.defaults.withCredentials = config.withCredentials
  configured = true
}

export const resetMitxOnlineAxiosForTests = () => {
  configured = false
  delete mitxAxios.defaults.baseURL
  delete mitxAxios.defaults.xsrfCookieName
  delete mitxAxios.defaults.withCredentials
}

export default mitxAxios

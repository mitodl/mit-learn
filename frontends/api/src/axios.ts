import axios from "axios"

/**
 * Our axios instance with default baseURL, headers, etc.
 */
const instance = axios.create({
  adapter: "fetch",
  xsrfCookieName: process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME,
  xsrfHeaderName: "X-CSRFToken",
  withXSRFToken: true,
  withCredentials:
    process.env.NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS === "true",
})

// Add a response interceptor to sanitize error objects for server-side rendering
// Prevented non-serializable objects from entering React Query, which causes errors during prefetch
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window === "undefined") {
      const sanitizedError = new Error(error.message || "Request failed")
      sanitizedError.name = error.name || "AxiosError"
      Object.assign(sanitizedError, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        code: error.code,
      })
      console.error(
        "Sanitized error object for server-side rendering",
        sanitizedError,
      )
      return Promise.reject(sanitizedError)
    }
    return Promise.reject(error)
  },
)

export default instance

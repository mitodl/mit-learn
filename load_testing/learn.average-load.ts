import { IGNORE_HTTPS_ERRORS } from "./config.ts"

export { testBackend } from "./backend/test.ts"
export { testFrontend } from "./frontend/test.ts"

const MAX_VUS = 100
const BROWSER_VU_SHARE = 0.5
const BACKEND_VU_SHARE = 1 - BROWSER_VU_SHARE

const BROWSER_VUS = Math.floor(MAX_VUS * BROWSER_VU_SHARE)
const BACKEND_VUS = Math.floor(MAX_VUS * BACKEND_VU_SHARE)

export const options = {
  scenarios: {
    browser: {
      exec: "testFrontend",
      executor: "ramping-vus",
      options: {
        browser: {
          type: "chromium",
        },
      },
      stages: [
        { duration: "5m", target: BROWSER_VUS },
        { duration: "30m", target: BROWSER_VUS },
        { duration: "5m", target: 0 },
      ],
    },
    backend: {
      exec: "testBackend",
      executor: "ramping-vus",
      stages: [
        { duration: "5m", target: BACKEND_VUS },
        { duration: "30m", target: BACKEND_VUS },
        { duration: "5m", target: 0 },
      ],
    },
  },
  thresholds: {
    // the rate of successful checks should be higher than 90%
    checks: ["rate>0.9"],
  },
  insecureSkipTLSVerify: IGNORE_HTTPS_ERRORS,
}

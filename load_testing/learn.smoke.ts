import { IGNORE_HTTPS_ERRORS } from "./config.ts"

export { testBackend } from "./backend/test.ts"
export { testFrontend } from "./frontend/test.ts"

const MAX_VUS = 4
const BROWSER_VU_SHARE = 0.5
const BACKEND_VU_SHARE = 1 - BROWSER_VU_SHARE

export const options = {
  scenarios: {
    browser: {
      exec: "testFrontend",
      executor: "constant-vus",
      vus: Math.floor(MAX_VUS * BROWSER_VU_SHARE),
      duration: "1m",
      options: {
        browser: {
          type: "chromium",
        },
      },
    },
    backend: {
      exec: "testBackend",
      executor: "constant-vus",
      vus: Math.floor(MAX_VUS * BACKEND_VU_SHARE),
      duration: "1m",
    },
  },
  thresholds: {
    // the rate of successful checks should be higher than 90%
    checks: ["rate>0.9"],
  },
  insecureSkipTLSVerify: IGNORE_HTTPS_ERRORS,
}

export { testBackend } from "./backend/test.ts"
export { testFrontend } from "./frontend/test.ts"

export const options = {
  scenarios: {
    browser: {
      exec: "testFrontend",
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
      options: {
        browser: {
          type: "chromium",
        },
      },
    },
    backend: {
      exec: "testBackend",
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
    },
  },
  thresholds: {
    // the rate of successful checks should be higher than 90%
    checks: ["rate>0.9"],
  },
}

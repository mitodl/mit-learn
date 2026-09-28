import path from "path"
import type { Config } from "@jest/types"
import baseConfig from "../jest.jsdom.config"
const config: Config.InitialOptions = {
  ...baseConfig,
  setupFilesAfterEnv: [
    ...baseConfig.setupFilesAfterEnv,
    "./test-utils/setupJest.tsx",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!(@faker-js|react-hotkeys-hook)).+",
  ],
  // jest-environment-jsdom defaults these to ["browser"], but
  // @happy-dom/jest-environment defaults to ["node", "node-addons"], under
  // which `@sentry/nextjs` does not resolve at all. Setting it here keeps the
  // two environments resolving packages identically; both simulate a browser.
  testEnvironmentOptions: {
    ...baseConfig.testEnvironmentOptions,
    customExportConditions: ["browser"],
  },
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    "^@/(.*)$": path.resolve(__dirname, "src/$1"),
    "^rehype-mathjax/browser$": "ol-test-utilities/filemocks/filemock.js",
    "^rehype-raw$": "ol-test-utilities/filemocks/filemock.js",
    "^remark-math$": "ol-test-utilities/filemocks/filemock.js",
    "^remark-supersub$": "ol-test-utilities/filemocks/filemock.js",
  },
}
export default config

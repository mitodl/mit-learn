/** @jest-config-loader esbuild-register */
import path from "path"
import type { Config } from "@jest/types"
import baseConfig from "../jest.jsdom.config"
const config: Config.InitialOptions = {
  ...baseConfig,
  setupFilesAfterEnv: [
    ...baseConfig.setupFilesAfterEnv,
    "./test-utils/setupJest.tsx",
  ],
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

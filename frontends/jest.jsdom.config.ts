import { resolve } from "path"
import type { Config } from "@jest/types"

/**
 * Base configuration for jest tests.
 */
const config: Config.InitialOptions &
  Pick<Required<Config.InitialOptions>, "setupFilesAfterEnv"> = {
  setupFilesAfterEnv: [resolve(__dirname, "./jest-shared-setup.ts")],
  testEnvironment: resolve(__dirname, "./jsdom-extended.ts"),
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
  moduleNameMapper: {
    "\\.(svg|jpg|jpeg|png)$": "ol-test-utilities/filemocks/imagemock.js",
    "\\.(css|scss)$": "ol-test-utilities/filemocks/filemock.js",
    "^rehype-mathjax/browser$": "ol-test-utilities/filemocks/filemock.js",
    "^rehype-raw$": "ol-test-utilities/filemocks/filemock.js",
    "^remark-math$": "ol-test-utilities/filemocks/filemock.js",
  },
  rootDir: "./src",
}

export default config

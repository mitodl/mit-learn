import { resolve } from "path"
import type { Config } from "@jest/types"

/**
 * Base configuration for jest tests.
 */
const config: Config.InitialOptions &
  Pick<Required<Config.InitialOptions>, "setupFilesAfterEnv"> = {
  setupFilesAfterEnv: [resolve(__dirname, "./jest-shared-setup.ts")],
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
  moduleNameMapper: {
    "\\.(svg|jpg|jpeg|png)$": "ol-test-utilities/filemocks/imagemock.js",
    "\\.(css|scss)$": "ol-test-utilities/filemocks/filemock.js",
    "ol-components/constants/(.*)$": resolve(
      __dirname,
      "ol-components/src/constants/$1",
    ),
    "ol-components/(.*)$": resolve(
      __dirname,
      "ol-components/src/components/$1",
    ),
  },
  rootDir: "./src",
}

export default config

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
  },
}
export default config

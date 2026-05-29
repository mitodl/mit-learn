import { createConfigurableAxios } from "./configurableAxios"
import type { LearnApiConfig } from "./runtime"

const learn = createConfigurableAxios("mit-learn.api.axios.learn")

export const applyLearnAxiosConfig = (config: LearnApiConfig) =>
  learn.applyConfig(config)

export const resetLearnAxiosForTests = learn.resetForTests

export default learn.instance

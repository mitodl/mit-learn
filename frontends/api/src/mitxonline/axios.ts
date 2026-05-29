import { createConfigurableAxios } from "../configurableAxios"
import type { MitxOnlineApiConfig } from "../runtime"

const mitxonline = createConfigurableAxios("mit-learn.api.axios.mitxonline")

export const applyMitxOnlineAxiosConfig = (config: MitxOnlineApiConfig) =>
  mitxonline.applyConfig(config)

export const resetMitxOnlineAxiosForTests = mitxonline.resetForTests

export default mitxonline.instance

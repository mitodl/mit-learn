import { createConfigurableAxios } from "./configurableAxios"

export const learnAxiosClient = createConfigurableAxios(
  "mit-learn.api.axios.learn",
)

export default learnAxiosClient.instance

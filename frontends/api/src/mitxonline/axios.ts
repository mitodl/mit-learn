import { createConfigurableAxios } from "../configurableAxios"

export const mitxAxiosClient = createConfigurableAxios(
  "mit-learn.api.axios.mitxonline",
)

export default mitxAxiosClient.instance

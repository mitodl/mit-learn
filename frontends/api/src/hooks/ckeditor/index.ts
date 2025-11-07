import { queryOptions } from "@tanstack/react-query"
import { ckeditorApi } from "../../clients"

const ckEditorQueries = {
  token: () =>
    queryOptions({
      queryKey: ["ckeditorToken"],
      queryFn: async () => {
        const response = await ckeditorApi.ckeditorRetrieve()
        return response.data
      },
    }),
}
export { ckEditorQueries }

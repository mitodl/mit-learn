import { useQuery } from "@tanstack/react-query"
import { ckeditorApi } from "../../clients"

const useCkeditorToken = (enabled: boolean) =>
  useQuery({
    queryKey: ["ckeditorToken"],
    queryFn: async () => {
      const response = await ckeditorApi.ckeditorRetrieve()
      return response.data
    },
    enabled: enabled,
  })

export { useCkeditorToken }

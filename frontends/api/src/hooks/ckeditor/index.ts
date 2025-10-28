import { useQuery } from "@tanstack/react-query"
import { ckeditorApi } from "../../clients"

const useCkeditorParams = (enabled: boolean) =>
  useQuery({
    queryKey: ["ckeditorParams"],
    queryFn: async () => {
      const response = await ckeditorApi.ckeditorRetrieve()
      return response.data
    },
    enabled: enabled,
  })

export { useCkeditorParams }

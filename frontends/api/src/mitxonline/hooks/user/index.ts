import { useQuery } from "@tanstack/react-query"
import { usersApi } from "../../clients"
import type { User } from "@mitodl/mitxonline-api-axios/v1"

const useMitxOnlineCurrentUser = () =>
  useQuery({
    queryKey: ["mitxonline", "currentUser"],
    queryFn: async (): Promise<User> => {
      const response = await usersApi.usersCurrentUserRetrieve()
      return {
        ...response.data,
      }
    },
  })

export { useMitxOnlineCurrentUser }
export type { User as MitxOnlineUser }

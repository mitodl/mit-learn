import { useQuery } from "@tanstack/react-query"
import { usersApi } from "../../clients"
import type { User } from "@mitodl/mitxonline-api-axios/v2"

const useMitxOnlineCurrentUser = (opts: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: ["mitxonline", "currentUser"],
    queryFn: async (): Promise<User> => {
      const response = await usersApi.usersCurrentUserRetrieve()
      return {
        ...response.data,
      }
    },
    ...opts,
  })

export { useMitxOnlineCurrentUser }
export type { User as MitxOnlineUser }

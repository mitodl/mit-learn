import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { countriesApi, usersApi } from "../../clients"
import type { User } from "@mitodl/mitxonline-api-axios/v2"
import { UsersApiUsersMePartialUpdateRequest } from "@mitodl/mitxonline-api-axios/v2"

const userKeys = {
  root: ["mitxonline", "users"] as const,
  me: () => [...userKeys.root, "me"] as const,
  countries: () => ["mitxonline", "countries"] as const,
}

const queries = {
  me: () =>
    queryOptions({
      queryKey: userKeys.me(),
      queryFn: async () => {
        const response = await usersApi.usersMeRetrieve()
        return response.data
      },
    }),
  countries: () =>
    queryOptions({
      queryKey: userKeys.countries(),
      queryFn: async () => {
        const response = await countriesApi.countriesList()
        return response.data
      },
    }),
}

/**
 * @deprecated Prefer direct use of queries.me()
 */
const useMitxOnlineUserMe = (opts: { enabled?: boolean } = {}) =>
  useQuery({ ...queries.me(), ...opts })

const useUpdateUserMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: UsersApiUsersMePartialUpdateRequest) =>
      usersApi.usersMePartialUpdate(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() })
    },
  })
}

export {
  queries as mitxUserQueries,
  useMitxOnlineUserMe,
  useUpdateUserMutation,
}
export type { User as MitxOnlineUser }

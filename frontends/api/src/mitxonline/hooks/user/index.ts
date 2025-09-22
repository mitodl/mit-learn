import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { countriesApi, usersApi } from "../../clients"
import type { User } from "@mitodl/mitxonline-api-axios/v2"
import { UsersApiUsersMePartialUpdateRequest } from "@mitodl/mitxonline-api-axios/v2"

const useMitxOnlineUserMe = (opts: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: ["mitxonline", "currentUser"],
    queryFn: async (): Promise<User> => {
      const response = await usersApi.usersMeRetrieve()
      return {
        ...response.data,
      }
    },
    ...opts,
  })

const useMitxOnlineCountries = () =>
  useQuery({
    queryKey: ["mitxonline", "countries"],
    queryFn: async (): Promise<{ code: string; name: string }[]> => {
      const response = await countriesApi.countriesList()
      return response.data
    },
  })

const useUpdateUserMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: UsersApiUsersMePartialUpdateRequest) =>
      usersApi.usersMePartialUpdate(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mitxonline", "currentUser"] })
    },
  })
}

export { useMitxOnlineCountries, useMitxOnlineUserMe, useUpdateUserMutation }
export type { User as MitxOnlineUser }

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { profilesApi } from "../../clients"
import type { Profile, PatchedProfileRequest } from "../../generated/v0/api"
import { userKeys } from "../user/queries"

const profileKeys = {
  root: ["profiles"],
  detail: (username: string) => [...profileKeys.root, { username }],
}

const useProfileQuery = (username: string) =>
  useQuery<Profile>({
    queryKey: profileKeys.detail(username),
    queryFn: async (): Promise<Profile> => {
      const response = await profilesApi.profilesRetrieve({
        user__username: username,
      })
      return response.data
    },
  })

const useProfileMutation = (username: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: PatchedProfileRequest) => {
      return profilesApi.profilesPartialUpdate({
        user__username: username,
        PatchedProfileRequest: params,
      })
    },
    onSuccess: (response) => {
      queryClient.setQueryData(profileKeys.detail(username), response.data)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() })
    },
  })
}

const useProfileMeQuery = () => useProfileQuery("me")

const useProfileMeMutation = () => useProfileMutation("me")

export {
  profileKeys,
  useProfileQuery,
  useProfileMutation,
  useProfileMeQuery,
  useProfileMeMutation,
}
export type { Profile }

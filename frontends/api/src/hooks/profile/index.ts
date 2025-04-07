import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { profilesApi } from "../../clients"
import type { Profile, PatchedProfileRequest } from "../../generated/v0/api"
import { userMeQuery } from "../user"

const useProfileQuery = (username: string) =>
  useQuery<Profile>({
    queryKey: ["profiles", { username }],
    queryFn: async (): Promise<Profile> => {
      const response = await profilesApi.profilesRetrieve({
        user__username: username,
      })
      return response.data
    },
  })

const useProfileMeMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: PatchedProfileRequest) => {
      return profilesApi.profilesPartialUpdate({
        user__username: "me",
        PatchedProfileRequest: params,
      })
    },
    onSuccess: (response) => {
      queryClient.setQueryData(["profiles", { username: "me" }], response.data)
      queryClient.setQueryData(userMeQuery.queryKey, (userData) => {
        if (!userData) return userData
        return {
          ...userData,
          profile: response.data,
        }
      })
    },
  })
}

const useProfileMeQuery = () => useProfileQuery("me")

export { useProfileQuery, useProfileMeQuery, useProfileMeMutation }
export type { Profile }

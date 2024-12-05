import { useQuery } from "@tanstack/react-query"
import { usersApi } from "../../clients"
import type { User as UserApi } from "../../generated/v0/api"

enum Permission {
  ArticleEditor = "is_article_editor",
  Authenticated = "is_authenticated",
  LearningPathEditor = "is_learning_path_editor",
}

interface User extends Partial<UserApi> {
  is_authenticated: boolean
}

const useUserMe = () =>
  useQuery({
    queryKey: ["userMe"],
    queryFn: async (): Promise<User> => {
      try {
        const response = await usersApi.usersMeRetrieve()
        return {
          is_authenticated: true,
          ...response.data,
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.response?.status === 403) {
          return {
            is_authenticated: false,
          }
        }
        throw error
      }
    },
  })

const useUserIsAuthenticated = () => {
  const { data: user } = useUserMe()
  return !!user?.is_authenticated
}

const useUserHasPermission = (permission: Permission) => {
  const { data: user } = useUserMe()
  return !!user?.[permission]
}

export { useUserMe, useUserIsAuthenticated, useUserHasPermission, Permission }
export type { User }

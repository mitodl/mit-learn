import { useQuery } from "@tanstack/react-query"
import { usersApi } from "../../clients"
import type { User } from "../../generated/v0/api"

enum Permission {
  ArticleEditor = "is_article_editor",
  Authenticated = "is_authenticated",
  LearningPathEditor = "is_learning_path_editor",
}

const useUserMe = () =>
  useQuery({
    queryKey: ["userMe"],
    queryFn: async (): Promise<User> => {
      const response = await usersApi.usersMeRetrieve()
      return {
        ...response.data,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

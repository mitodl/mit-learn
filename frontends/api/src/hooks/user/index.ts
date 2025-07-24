import { useQuery } from "@tanstack/react-query"
import type { User } from "../../generated/v0/api"
import { userQueries } from "./queries"

enum Permission {
  ArticleEditor = "is_article_editor",
  Authenticated = "is_authenticated",
  LearningPathEditor = "is_learning_path_editor",
}

const useUserMe = () => useQuery(userQueries.me())

const useUserIsAuthenticated = () => {
  const { data: user } = useUserMe()
  return !!user?.is_authenticated
}

const useUserHasPermission = (permission: Permission) => {
  const { data: user } = useUserMe()
  return !!user?.[permission]
}

export {
  userQueries,
  useUserMe,
  useUserIsAuthenticated,
  useUserHasPermission,
  Permission,
}
export type { User }

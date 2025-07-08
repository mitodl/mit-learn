import { queryOptions } from "@tanstack/react-query"
import { usersApi } from "../../clients"

const userKeys = {
  root: ["users"],
  me: () => [...userKeys.root, "me"],
}

const userQueries = {
  me: () =>
    queryOptions({
      queryKey: userKeys.me(),
      queryFn: () => usersApi.usersMeRetrieve().then((res) => res.data),
      /**
       * Always refetch on window focus in case the user has logged in or out
       * in another tab or window while this tab was inactive.
       */
      refetchOnWindowFocus: "always",
    }),
}

export { userQueries, userKeys }

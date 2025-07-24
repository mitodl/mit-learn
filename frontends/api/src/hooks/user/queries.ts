import { queryOptions } from "@tanstack/react-query"
import { usersApi } from "../../clients"

const userKeys = {
  root: ["users"],
  me: () => [...userKeys.root, "me"],
}

const userQueries = {
  me: () =>
    queryOptions({
      /**
       * Use a short stale-time to help keep the user data fresh.
       * (Nonzero, since staleTime:0 can result in many fetches per page load.)
       */
      staleTime: 3 * 60 * 1000,
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

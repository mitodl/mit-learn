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
    }),
}

export { userQueries, userKeys }

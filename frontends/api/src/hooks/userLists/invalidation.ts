// import { QueryClient, Query } from "@tanstack/react-query"
// import userLists from "./keyFactory"
// import {
//   UserList,
//   LearningResource,
//   PaginatedLearningResourceList,
// } from "../../generated/v1"

// const invalidateUserListQueries = (
//   queryClient: QueryClient,
//   userListId: UserList["id"],
// ) => {
//   queryClient.invalidateQueries(userLists.detail(userListId).queryKey)
//   const lists = [userLists.list._def]

//   lists.forEach((queryKey) => {
//     queryClient.invalidateQueries({
//       queryKey,
//       predicate: listHasResource(userListId),
//     })
//   })
// }

// const listHasResource =
//   (resourceId: number) =>
//   (query: Query): boolean => {
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     const data = query.state.data as any
//     const resources: LearningResource[] | UserList[] = data.pages
//       ? data.pages.flatMap(
//           (page: PaginatedLearningResourceList) => page.results,
//         )
//       : data.results

//     return resources.some((res) => res.id === resourceId)
//   }

// export { invalidateUserListQueries, listHasResource }

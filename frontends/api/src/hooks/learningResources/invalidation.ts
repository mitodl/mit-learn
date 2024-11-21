// import type { QueryClient } from "@tanstack/react-query"
// import type { LearningResource } from "../../generated/v1"
// import learningResources from "./keyFactory"
// import learningPaths from "../learningPaths/keyFactory"
// import userLists from "../userLists/keyFactory"
// import { listHasResource } from "../userLists/invalidation"

// /**
//  * Invalidate Resource queries that a specific resource appears in.
//  *
//  * By default, this will invalidate featured list queries. This can result in
//  * odd behavior because the featured list item order is randomized: when the
//  * featured list cache is invalidated, the newly fetched data may be in a
//  * different order. To maintain the order, use skipFeatured to skip invalidation
//  * of featured lists and instead manually update the cached data via
//  * `updateListParentsOnAdd`.
//  */
// const invalidateResourceQueries = (
//   queryClient: QueryClient,
//   resourceId: LearningResource["id"],
//   { skipFeatured = false } = {},
// ) => {
//   /**
//    * Invalidate details queries.
//    * In this case, looking up queries by key is easy.
//    */
//   queryClient.invalidateQueries(learningResources.detail(resourceId).queryKey)
//   queryClient.invalidateQueries(learningPaths.detail(resourceId).queryKey)
//   queryClient.invalidateQueries(userLists.detail(resourceId).queryKey)
//   /**
//    * Invalidate lists that the resource belongs to.
//    * Check for actual membership.
//    */
//   const lists = [
//     learningResources.list._def,
//     learningPaths.list._def,
//     learningResources.search._def,
//     ...(skipFeatured ? [] : [learningResources.featured._def]),
//   ]
//   lists.forEach((queryKey) => {
//     queryClient.invalidateQueries({
//       queryKey,
//       predicate: listHasResource(resourceId),
//     })
//   })
// }

// export { invalidateResourceQueries }

import type { QueryClient, Query } from "@tanstack/react-query"
import type {
  PaginatedLearningResourceList,
  LearningResource,
} from "../../generated/v1"
import learningResources from "./keyFactory"
import learningPaths from "../learningPaths/keyFactory"
import userLists from "../userLists/keyFactory"
import { listHasResource } from "../userLists/invalidation"

/**
 * Invalidate Resource queries that a specific resource appears in.
 *
 * By default, this will invalidate featured list queries. This can result in
 * odd behavior because the featured list item order is randomized: when the
 * featured list cache is invalidated, the newly fetched data may be in a
 * different order. To maintain the order, use skipFeatured to skip invalidation
 * of featured lists and instead manually update the cached data via
 * `updateListParentsOnAdd`.
 */
const invalidateResourceQueries = (
  queryClient: QueryClient,
  resourceId: LearningResource["id"],
  { skipFeatured = false } = {},
) => {
  /**
   * Invalidate details queries.
   * In this case, looking up queries by key is easy.
   */
  queryClient.invalidateQueries(learningResources.detail(resourceId).queryKey)
  queryClient.invalidateQueries(learningPaths.detail(resourceId).queryKey)
  queryClient.invalidateQueries(userLists.detail(resourceId).queryKey)
  /**
   * Invalidate lists that the resource belongs to.
   * Check for actual membership.
   */
  const lists = [
    learningResources.list._def,
    learningPaths.list._def,
    learningResources.search._def,
    ...(skipFeatured ? [] : [learningResources.featured._def]),
  ]
  lists.forEach((queryKey) => {
    queryClient.invalidateQueries({
      queryKey,
      predicate: listHasResource(resourceId),
    })
  })
}

/**
 * Invalidate Resource queries that a resource that belongs to user list appears in.
 */
const invalidateResourceWithUserListQueries = (
  queryClient: QueryClient,
  userListId: LearningResource["id"],
) => {
  /**
   * Invalidate resource detail query for resource that is in the user list.
   */
  queryClient.invalidateQueries({
    queryKey: learningResources.detail._def,
    predicate: resourceHasUserList(userListId),
  })

  /**
   * Invalidate lists with a resource that is in the user list.
   */
  const lists = [
    learningResources.list._def,
    learningPaths.list._def,
    learningResources.search._def,
    learningResources.featured._def,
  ]

  lists.forEach((queryKey) => {
    queryClient.invalidateQueries({
      queryKey,
      predicate: resourcesHaveUserList(userListId),
    })
  })
}

const resourcesHaveUserList =
  (userListId: number) =>
  (query: Query): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = query.state.data as any
    const resources: LearningResource[] = data.pages
      ? data.pages.flatMap(
          (page: PaginatedLearningResourceList) => page.results,
        )
      : data.results

    return resources?.some((res) =>
      res.user_list_parents?.some((userList) => userList.parent === userListId),
    )
  }

const resourceHasUserList =
  (userListId: number) =>
  (query: Query): boolean => {
    const data = query.state.data as LearningResource
    return !!data.user_list_parents?.some(
      (userList) => userList.parent === userListId,
    )
  }

export {
  invalidateResourceQueries,
  // invalidateUserListQueries,
  invalidateResourceWithUserListQueries,
}

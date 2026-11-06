import { createContext, useContext } from "react"

import { LearningResource } from "api/hooks/learningResources"

export interface LearningResourceContextValue {
  resources: Record<number, LearningResource>
  /**
   * The list query's `isLoading` (pending and fetching), not its `isFetching`:
   * a background refetch of a list that already has data must not put cards
   * back into their skeleton state.
   */
  isLoading: boolean
}

export const LearningResourceContext =
  createContext<LearningResourceContextValue>({
    resources: {},
    isLoading: false,
  })

export const useLearningResource = (id: number) => {
  const { resources, isLoading } = useContext(LearningResourceContext)
  const resource = resources[id]

  return {
    resource,
    // Per card: one that already has its data never goes back to loading.
    isLoading: isLoading && !resource,
  }
}

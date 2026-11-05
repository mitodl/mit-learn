import { createContext, useContext } from "react"

import { LearningResource } from "api/hooks/learningResources"

export interface LearningResourceContextValue {
  resources: Record<number, LearningResource>
  isFetching: boolean
}

export const LearningResourceContext =
  createContext<LearningResourceContextValue>({
    resources: {},
    isFetching: false,
  })

export const useLearningResource = (id: number) => {
  const { resources, isFetching } = useContext(LearningResourceContext)
  const resource = resources[id]

  return {
    resource,
    // Per card: one that already has its data never goes back to loading.
    isLoading: isFetching && !resource,
  }
}

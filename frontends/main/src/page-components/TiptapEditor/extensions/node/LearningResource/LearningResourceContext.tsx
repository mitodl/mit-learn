import { createContext, useContext } from "react"

import { LearningResource } from "api/hooks/learningResources"

export interface LearningResourceContextValue {
  resources: Record<number, LearningResource>
  isLoading: boolean
}

export const LearningResourceContext =
  createContext<LearningResourceContextValue>({
    resources: {},
    isLoading: false,
  })

export const useLearningResource = (id: number) => {
  const { resources, isLoading } = useContext(LearningResourceContext)

  return {
    resource: resources[id],
    isLoading,
  }
}

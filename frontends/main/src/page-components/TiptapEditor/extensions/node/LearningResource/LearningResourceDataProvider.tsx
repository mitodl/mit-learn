import React from "react"
import { LearningResourceContext } from "./LearningResourceContext"

import {
  useLearningResourcesBulkList,
  LearningResource,
} from "api/hooks/learningResources"
import { keepPreviousData } from "@tanstack/react-query"

interface LearningResourceProviderProps {
  resourceIds: number[]
  children: React.ReactNode
}

const byId = (resources: LearningResource[] | undefined) => {
  const map: Record<number, LearningResource> = {}
  resources?.forEach((resource) => {
    map[resource.id] = resource
  })
  return map
}

export const LearningResourceProvider = ({
  resourceIds,
  children,
}: LearningResourceProviderProps) => {
  // The bulk list is what the page prefetches on the server, so reading it
  // directly matches the SSR cache.
  const { data, isLoading, isPlaceholderData } = useLearningResourcesBulkList(
    resourceIds,
    // Adding a card in the editor changes `resourceIds`, and so the key. The
    // previous list stands in until the new one loads, so the cards already
    // shown stay put.
    { placeholderData: keepPreviousData },
  )
  const resources = React.useMemo(() => byId(data), [data])

  return (
    <LearningResourceContext.Provider
      value={{
        resources,
        // The previous list standing in for a new key counts as `success`, so
        // a card it lacks is loading too.
        isLoading: isLoading || isPlaceholderData,
      }}
    >
      {children}
    </LearningResourceContext.Provider>
  )
}

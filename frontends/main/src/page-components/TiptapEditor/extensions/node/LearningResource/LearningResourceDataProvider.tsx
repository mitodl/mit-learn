import React from "react"
import { LearningResourceContext } from "./LearningResourceContext"

import {
  useLearningResourcesBulkList,
  LearningResource,
} from "api/hooks/learningResources"

interface LearningResourceProviderProps {
  resourceIds: number[]
  children: React.ReactNode
}
export const LearningResourceProvider = ({
  resourceIds,
  children,
}: LearningResourceProviderProps) => {
  // The bulk list is what the page prefetches on the server, so reading it
  // directly matches the SSR cache.
  const { data, isLoading } = useLearningResourcesBulkList(resourceIds)

  const resources = React.useMemo(() => {
    const map: Record<number, LearningResource> = {}
    data?.forEach((resource) => {
      map[resource.id] = resource
    })
    return map
  }, [data])

  return (
    <LearningResourceContext.Provider value={{ resources, isLoading }}>
      {children}
    </LearningResourceContext.Provider>
  )
}

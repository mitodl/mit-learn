import React from "react"
import { LearningResourceContext } from "./LearningResourceContext"

import {
  useLearningResourcesBulkList,
  learningResourceKeys,
  LearningResource,
} from "api/hooks/learningResources"
import { useQueries } from "@tanstack/react-query"

interface LearningResourceProviderProps {
  resourceIds: number[]
  children: React.ReactNode
}
export const LearningResourceProvider = ({
  resourceIds,
  children,
}: LearningResourceProviderProps) => {
  const { isLoading } = useLearningResourcesBulkList(resourceIds)

  /* We can use the data from useLearningResourcesBulkList(),
   * however pulling back from the query cache ensures aligns with the
   * cache population during SSR and ensures we don't get any prefetch warnings.
   */
  const resourceQueries = useQueries({
    queries: resourceIds.map((id) => ({
      queryKey: learningResourceKeys.detail(id),
      enabled: false, // 👈 read-only, no refetch
    })),
  })

  const resources = React.useMemo(() => {
    const map: Record<number, LearningResource> = {}

    resourceQueries.forEach((query, index) => {
      const id = resourceIds[index]
      if (query.data) {
        map[id] = query.data as LearningResource
      }
    })

    return map
  }, [resourceQueries, resourceIds])

  return (
    <LearningResourceContext.Provider value={{ resources, isLoading }}>
      {children}
    </LearningResourceContext.Provider>
  )
}

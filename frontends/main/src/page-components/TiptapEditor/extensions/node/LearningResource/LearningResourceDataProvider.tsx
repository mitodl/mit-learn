import React from "react"
import { LearningResourceContext } from "./LearningResourceContext"

import {
  useLearningResourcesBulkList,
  learningResourceKeys,
  LearningResource,
} from "api/hooks/learningResources"
import { useQueries, useQueryClient } from "@tanstack/react-query"

interface LearningResourceProviderProps {
  resourceIds: number[]
  children: React.ReactNode
}
export const LearningResourceProvider = ({
  resourceIds,
  children,
}: LearningResourceProviderProps) => {
  const queryClient = useQueryClient()

  const uniqueIds = React.useMemo(
    () => Array.from(new Set(resourceIds)),
    [resourceIds],
  )

  const missingIds = React.useMemo(
    () =>
      uniqueIds.filter(
        (id) => !queryClient.getQueryData(learningResourceKeys.detail(id)),
      ),
    [uniqueIds, queryClient],
  )

  // 🚀 fetch missing
  const { isLoading: bulkLoading } = useLearningResourcesBulkList(missingIds, {
    enabled: missingIds.length > 0,
  })

  // 👇 SUBSCRIBE to each resource
  const resourceQueries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: learningResourceKeys.detail(id),
      enabled: false, // 👈 read-only, no refetch
    })),
  })

  const resources = React.useMemo(() => {
    const map: Record<number, LearningResource> = {}

    resourceQueries.forEach((query, index) => {
      const id = uniqueIds[index]
      if (query.data) {
        map[id] = query.data as LearningResource
      }
    })

    return map
  }, [resourceQueries, uniqueIds])

  const isLoading = bulkLoading || resourceQueries.some((q) => q.isLoading)

  return (
    <LearningResourceContext.Provider value={{ resources, isLoading }}>
      {children}
    </LearningResourceContext.Provider>
  )
}

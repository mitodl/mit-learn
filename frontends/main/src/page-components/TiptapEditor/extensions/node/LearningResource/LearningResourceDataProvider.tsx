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
  const { data, isFetching } = useLearningResourcesBulkList(resourceIds)
  const current = React.useMemo(() => byId(data), [data])

  // Adding a card in the editor changes the ids, and so the query key. Keep
  // what earlier lists returned so the cards already shown stay put while the
  // new list loads, or if it fails.
  const [earlier, setEarlier] = React.useState<
    Record<number, LearningResource>
  >({})
  React.useEffect(() => {
    if (data) setEarlier((prev) => ({ ...prev, ...current }))
  }, [data, current])

  const resources = React.useMemo(
    () => ({ ...earlier, ...current }),
    [earlier, current],
  )

  return (
    <LearningResourceContext.Provider value={{ resources, isFetching }}>
      {children}
    </LearningResourceContext.Provider>
  )
}

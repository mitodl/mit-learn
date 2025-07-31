"use client"

import React, { useMemo } from "react"
import { useParams } from "next/navigation"
import { useUserMe } from "api/hooks/user"
import {
  useInfiniteLearningPathItems,
  useLearningPathsDetail,
} from "api/hooks/learningPaths"
import { ListType } from "api/constants"
import { manageListDialogs } from "@/page-components/ManageListDialogs/ManageListDialogs"
import ListDetailsPage from "./ListDetailsPage"
import dynamic from "next/dynamic"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

type RouteParams = {
  id: string
}

const LearningPathDetailsPage: React.FC = () => {
  const { data: user } = useUserMe()
  const params = useParams<RouteParams>()

  const id = parseInt(params.id)

  const pathQuery = useLearningPathsDetail(id)
  // Very high limit set here beacuse pagination not implemented on the frontend
  const itemsQuery = useInfiniteLearningPathItems({
    learning_resource_id: id,
    limit: 1000,
  })
  const items = useMemo(() => {
    const pages = itemsQuery.data?.pages
    return pages?.flatMap((p) => p.results ?? []) ?? []
  }, [itemsQuery.data])
  const list = useMemo(() => {
    if (!pathQuery.data) {
      return undefined
    }
    return {
      title: pathQuery.data.title,
      description: pathQuery.data.description,
      item_count: pathQuery.data.learning_path.item_count,
    }
  }, [pathQuery.data])

  return (
    <>
      <LearningResourceDrawer />
      <ListDetailsPage
        listType={ListType.LearningPath}
        list={list}
        items={items}
        showSort={!!user?.is_authenticated}
        canEdit={!!user?.is_learning_path_editor}
        isLoading={itemsQuery.isLoading}
        isFetching={itemsQuery.isFetching}
        handleEdit={() => manageListDialogs.upsertLearningPath(pathQuery.data)}
      />
    </>
  )
}

export default LearningPathDetailsPage

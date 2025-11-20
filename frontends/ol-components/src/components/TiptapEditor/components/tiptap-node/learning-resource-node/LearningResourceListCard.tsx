import React from "react"
import { NodeViewWrapper } from "@tiptap/react"
import { LearningResourceListCard } from "ol-components"
import { useLearningResourcesDetail } from "api/hooks/learningResources"

import "./style.scss"

export const LearningResourceNodeView = ({ node }: any) => {
  const resourceId = node.attrs.resourceId
  const href = node.attrs.href

  const { data, isLoading } = useLearningResourcesDetail(resourceId)

  return (
    <NodeViewWrapper className="learning-resource-node">
      <LearningResourceListCard
        resource={data}
        href={href}
        isLoading={isLoading}
      />
    </NodeViewWrapper>
  )
}

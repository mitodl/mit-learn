import React from "react"
import { NodeViewWrapper } from "@tiptap/react"
import { LearningResourceListCard, styled } from "ol-components"
import { useLearningResourcesDetail } from "api/hooks/learningResources"

const StyledLearningResourceListCard = styled(LearningResourceListCard)({
  "&& a": {
    color: "inherit",
    textDecoration: "none",
  },
  "&& a span": {
    textDecoration: "none",
  },
})

export const LearningResourceNodeView = ({ node }: any) => {
  const resourceId = node.attrs.resourceId
  const href = node.attrs.href

  const { data, isLoading } = useLearningResourcesDetail(resourceId)

  return (
    <NodeViewWrapper className="learning-resource-node">
      <StyledLearningResourceListCard
        resource={data}
        href={href}
        isLoading={isLoading}
      />
    </NodeViewWrapper>
  )
}

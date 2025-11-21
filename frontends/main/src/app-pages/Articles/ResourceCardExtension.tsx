import React from "react"
import {
  ReactNodeViewRenderer,
  Node,
  mergeAttributes,
  NodeViewWrapper,
} from "@tiptap/react"
import { type NodeViewProps } from "@tiptap/react"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import { theme, styled, LearningResourceCard } from "ol-components"

const LoadingCard = styled.div({
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  background: theme.custom.colors.white,
  display: "block",
  overflow: "hidden",
  minWidth: "300px",
  maxWidth: "300px",
  padding: "16px",
})

const SelectableWrapper = styled.div({
  cursor: "pointer",
  transition: "all 0.2s",
  display: "inline-block",
  "&:hover": {
    outline: `2px solid ${theme.custom.colors.lightGray2}`,
    outlineOffset: "2px",
  },
  '&[data-node-view-selected="true"]': {
    outline: `2px solid ${theme.custom.colors.mitRed}`,
    outlineOffset: "2px",
  },
})

const ResourceCardWrapper = (props: NodeViewProps) => {
  const { node, selected } = props

  const { data: resource, isLoading } = useLearningResourcesDetail(
    node.attrs.resourceId,
  )

  return (
    <NodeViewWrapper data-node-view-selected={selected}>
      <SelectableWrapper data-node-view-selected={selected}>
        {isLoading && <LoadingCard>Loading...</LoadingCard>}
        {!isLoading && !resource && (
          <LoadingCard>Resource not found</LoadingCard>
        )}
        {!isLoading && resource && <LearningResourceCard resource={resource} />}
      </SelectableWrapper>
    </NodeViewWrapper>
  )
}

const ResourceCardExtension = Node.create({
  name: "resourceCard",

  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      resourceId: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [{ tag: "resource-card" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["resource-card", mergeAttributes(HTMLAttributes)]
  },

  markdownTokenizer: {
    name: "resourceCard",
    level: "block",

    start: (src) => {
      return src.indexOf("[[resource-card:")
    },

    tokenize: (src, _tokens, _lexer) => {
      // Match [[resource:resourceId]]
      const match = /^\[\[resource-card:(\d+)\]\]/.exec(src)

      if (!match) {
        return undefined
      }

      return {
        type: "resourceCard",
        raw: match[0],
        resourceId: match[1],
      }
    },
  },

  parseMarkdown: (token, _helpers) => {
    return {
      type: "resourceCard",
      attrs: {
        resourceId: token.resourceId || null,
      },
    }
  },

  renderMarkdown: (node, _helpers) => {
    const resourceId = node.attrs?.resourceId || ""
    return `[[resource-card:${resourceId}]]\n\n`
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResourceCardWrapper)
  },
})

export { ResourceCardExtension }

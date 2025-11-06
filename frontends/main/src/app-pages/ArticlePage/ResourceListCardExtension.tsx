import {
  ReactNodeViewRenderer,
  Node,
  mergeAttributes,
  NodeViewWrapper,
} from "@tiptap/react"
import { type NodeViewProps } from "@tiptap/react"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import { theme, styled, LearningResourceListCard } from "ol-components"

const LoadingCard = styled.div({
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  background: theme.custom.colors.white,
  display: "block",
  overflow: "hidden",
  height: "183px",
  width: "100%",
  padding: "16px",
  marginTop: "16px",
})

const StyledLearningResourceListCard = styled(LearningResourceListCard)({
  marginTop: "16px",
})

const SelectableWrapper = styled.div({
  cursor: "pointer",
  transition: "all 0.2s",
  "&:hover": {
    outline: `2px solid ${theme.custom.colors.lightGray2}`,
    outlineOffset: "2px",
  },
  '&[data-node-view-selected="true"]': {
    outline: `2px solid ${theme.custom.colors.mitRed}`,
    outlineOffset: "2px",
  },
})

const ResourceListCardWrapper = (props: NodeViewProps) => {
  const { node, selected } = props

  const { data: resource, isLoading } = useLearningResourcesDetail(
    node.attrs.resourceId,
  )

  if (!node.attrs.resourceId) {
    return (
      <NodeViewWrapper data-node-view-selected={selected}>
        <SelectableWrapper data-node-view-selected={selected}>
          <LoadingCard>Resource ID not set</LoadingCard>
        </SelectableWrapper>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper data-node-view-selected={selected}>
      <SelectableWrapper data-node-view-selected={selected}>
        {isLoading && <LoadingCard>Loading...</LoadingCard>}
        {!isLoading && !resource && (
          <LoadingCard>Resource not found</LoadingCard>
        )}
        {!isLoading && resource && (
          <StyledLearningResourceListCard resource={resource} />
        )}
      </SelectableWrapper>
    </NodeViewWrapper>
  )
}

const ResourceListCardExtension = Node.create({
  name: "resourceListCard",

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
    return [{ tag: "resource-list-card" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["resource-list-card", mergeAttributes(HTMLAttributes)]
  },

  markdownTokenizer: {
    name: "resourceListCard",
    level: "block",

    start: (src) => {
      return src.indexOf("[[resource-list-card:")
    },

    tokenize: (src, _tokens, _lexer) => {
      // Match [[resource:resourceId]]
      const match = /^\[\[resource-list-card:(\d+)\]\]/.exec(src)

      if (!match) {
        return undefined
      }

      return {
        type: "resourceListCard",
        raw: match[0],
        resourceId: match[1],
      }
    },
  },

  parseMarkdown: (token, _helpers) => {
    return {
      type: "resourceListCard",
      attrs: {
        resourceId: token.resourceId || null,
      },
    }
  },

  renderMarkdown: (node, _helpers) => {
    const resourceId = node.attrs?.resourceId || ""
    return `[[resource-list-card:${resourceId}]]\n\n`
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResourceListCardWrapper)
  },
})

export { ResourceListCardExtension }

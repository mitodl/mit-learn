import React from "react"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import { Node, mergeAttributes } from "@tiptap/core"
import { LearningResourceListCard, styled } from "ol-components"
import { useLearningResourcesDetail } from "api/hooks/learningResources"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    learningResource: {
      insertLearningResource: (resourceId: number, href?: string) => ReturnType
    }
  }
}

const StyledLearningResourceListCard = styled(LearningResourceListCard)({
  "&& a": {
    color: "inherit",
    textDecoration: "none",
  },
  "&& a span": {
    textDecoration: "none",
  },
})

export const LearningResourceListCardWrapper = ({
  node,
}: ReactNodeViewProps) => {
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

export interface LearningResourceOptions {
  HTMLAttributes: Record<string, string | number | null | undefined>
}

export const LearningResourceNode = Node.create<LearningResourceOptions>({
  name: "learningResource",

  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      resourceId: {
        default: null,
      },
      href: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [{ tag: "learning-resource" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["learning-resource", mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      insertLearningResource:
        (resourceId: number, href?: string) =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection

          const nodeType = state.schema.nodes.learningResource
          const paragraphType = state.schema.nodes.paragraph
          if (!nodeType) return false

          // 🛑 Guard: top-level selection
          if ($from.depth === 0) {
            tr.insert(
              state.selection.from,
              nodeType.create({ resourceId, href }),
            )

            dispatch?.(tr.scrollIntoView())
            return true
          }

          // ✅ Replace the current block
          const from = $from.before($from.depth)
          const to = $from.after($from.depth)

          tr.replaceWith(
            from,
            to,
            [
              nodeType.create({ resourceId, href }),
              paragraphType?.create(),
            ].filter(Boolean),
          )

          dispatch?.(tr.scrollIntoView())
          return true
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(LearningResourceListCardWrapper)
  },
})

import React from "react"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import { Node, mergeAttributes, type CommandProps } from "@tiptap/core"
import { styled } from "ol-components"
import { useLearningResource } from "./LearningResourceContext"
import { ResourceCard } from "../../../../ResourceCard/ResourceCard"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    learningResource: {
      insertLearningResource: (resourceId: number, href?: string) => ReturnType
    }
  }
}

const NodeWrapper = styled(NodeViewWrapper)({
  position: "relative",
  marginBottom: "20px",

  "& .remove-button": {
    opacity: 0,
    pointerEvents: "none",
  },

  "&:hover .remove-button": {
    opacity: 1,
    pointerEvents: "auto",
  },
})

const StyledLearningResourceListCard = styled(ResourceCard)(({ theme }) => ({
  position: "relative",

  ".ProseMirror-selectednode &": {
    borderColor: theme.custom.colors.red,
    userSelect: "none",
  },

  "&& a": {
    color: "inherit",
    textDecoration: "none",
  },

  "&& a span": {
    textDecoration: "none",
  },
  "&:hover .remove-button": {
    opacity: 1,
    pointerEvents: "auto",
  },
}))

const RemoveButton = styled("button")(({ theme }) => ({
  position: "absolute",
  top: -7,
  right: -7,
  zIndex: 2,

  background: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "50%",
  width: 24,
  height: 24,

  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,

  opacity: 0, // 👈 hidden
  pointerEvents: "none", // 👈 not clickable when hidden
  transition: "opacity 0.15s ease",

  "&:hover": {
    background: theme.custom.colors.lightGray1,
  },
}))

export const LearningResourceListCardWrapper = ({
  node,
  editor,
  getPos,
}: ReactNodeViewProps) => {
  const resourceId = node.attrs.resourceId
  const editable = node.attrs.editable

  const { resource: data, isLoading } = useLearningResource(resourceId)

  const handleRemove = () => {
    const pos = getPos()
    if (typeof getPos !== "function" || typeof pos !== "number") return

    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.delete(pos, pos + node.nodeSize)
        return true
      })
      .run()
  }

  return (
    <NodeWrapper className="learning-resource-node">
      {editable && (
        <RemoveButton
          type="button"
          aria-label="Remove course card"
          onClick={handleRemove}
          className="remove-button"
        >
          ×
        </RemoveButton>
      )}
      <StyledLearningResourceListCard
        isLoading={isLoading && !data}
        resource={data}
        list
      />
    </NodeWrapper>
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
      editable: { default: true },
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
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: { resourceId, href },
          })
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(LearningResourceListCardWrapper)
  },
})

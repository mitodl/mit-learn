import React from "react"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import { Node, mergeAttributes, type CommandProps } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { styled } from "ol-components"
import { useLearningResource } from "./LearningResourceContext"
import { ResourceCard } from "../../../../ResourceCard/ResourceCard"
import { ActionButton } from "@mitodl/smoot-design"
import { RiCloseLargeLine } from "@remixicon/react"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    learningResource: {
      insertLearningResource: (resourceId: number, href?: string) => ReturnType
    }
  }
}

const NodeWrapper = styled(NodeViewWrapper)({
  position: "relative",
  cursor: "pointer",
})

const StyledLearningResourceCard = styled(ResourceCard)(({ theme }) => ({
  position: "relative",
  marginBottom: "20px",

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

  ".node-learningResource &": {
    pointerEvents: "none",
    userSelect: "none",
    cursor: "default",
  },
}))

const RemoveButton = styled(ActionButton)({
  position: "absolute",
  top: "-4px",
  right: "-6px",
  zIndex: 2,
  display: "none",
  pointerEvents: "auto",
  ".node-learningResource:hover &": {
    display: "flex",
  },
})

export const LearningResourceCardViewer = ({
  node,
}: {
  node: ProseMirrorNode
}) => {
  const { resourceId } = node.attrs
  const { resource, isLoading } = useLearningResource(resourceId ?? 0)

  if (!resourceId) {
    return null
  }

  return (
    <StyledLearningResourceCard
      resource={resource}
      list
      isLoading={isLoading}
    />
  )
}

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

  const selectNode = () => {
    if (!editable) return
    const pos = getPos()
    if (typeof getPos !== "function" || typeof pos !== "number") return

    editor.chain().focus().setNodeSelection(pos).run()
  }

  return (
    <NodeWrapper onMouseDown={selectNode}>
      {editable && (
        <RemoveButton
          variant="primary"
          edge="circular"
          size="small"
          onClick={handleRemove}
          aria-label="Close"
        >
          <RiCloseLargeLine />
        </RemoveButton>
      )}
      <StyledLearningResourceCard
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

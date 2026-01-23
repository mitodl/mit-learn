import React from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react"
import styled from "@emotion/styled"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    divider: {
      insertDivider: () => ReturnType
    }
  }
}

const StyledDivider = styled.div(({ theme }) => ({
  position: "relative",
  display: "block",
  width: "100%",
  textAlign: "center",
  margin: "0 auto",
  lineHeight: "1em",
  marginBottom: "40px",
  padding: "8px",
  borderRadius: "4px",
  transition: "outline-color 0.2s ease",
  outline: "1px solid transparent",
  "&::after": {
    content: '". . ."',
    fontSize: "50px",
    color: theme.custom.colors.darkGray2,
    letterSpacing: "6px",
    transition: "color 0.2s ease",
  },
  ".ProseMirror-selectednode &": {
    outline: `1px solid ${theme.custom.colors.red}`,
    outlineOffset: "-1px",
    backgroundColor: "var(--tt-selection-color)",
    "&::after": {
      color: theme.custom.colors.red,
    },
  },
  ".node-divider &": {
    cursor: "pointer",
  },
}))

export const DividerViewer = () => <StyledDivider />

const DividerWrapper = ({ editor, getPos }: ReactNodeViewProps) => {
  const selectNode = (e: React.MouseEvent) => {
    const pos = getPos()
    if (typeof pos !== "number") return

    editor.chain().focus().setNodeSelection(pos).run()
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <NodeViewWrapper
      data-type="divider"
      tabIndex={0}
      role="separator"
      aria-orientation="horizontal"
      onClick={selectNode}
    >
      <StyledDivider />
    </NodeViewWrapper>
  )
}

export const DividerNode = Node.create({
  name: "divider",
  group: "block",
  atom: true,
  draggable: false,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="divider"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": "divider", class: "tiptap-divider-node" },
        HTMLAttributes,
      ),
      0,
    ]
  },

  addCommands() {
    return {
      insertDivider:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(DividerWrapper)
  },
})

export default DividerNode

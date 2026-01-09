import React from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react"
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
  outline: "none",
  margin: "0 auto",
  lineHeight: "1em",
  marginBottom: "40px",
  "&::after": {
    content: '". . ."',
    fontSize: "50px",
    color: theme.custom.colors.darkGray2,
    letterSpacing: "6px",
  },
}))

export const DividerViewer = () => <StyledDivider />

const DividerWrapper = () => {
  return (
    <NodeViewWrapper
      data-type="divider"
      tabIndex={0}
      role="separator"
      aria-orientation="horizontal"
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
  selectable: false,

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

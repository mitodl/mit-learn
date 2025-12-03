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

const StyledNodeViewWrapper = styled(NodeViewWrapper)`
  position: relative;
  display: block;
  width: 100%;
  text-align: center;
  outline: none;
`

const Divider = styled.div(({ theme }) => ({
  width: "100%",
  margin: "0 auto",
  textAlign: "center",
  lineHeight: "1em",
  marginBottom: "40px",
  "&::after": {
    content: '". . ."',
    fontSize: "50px",
    color: theme.custom.colors.darkGray2,
    letterSpacing: "6px",
  },
}))

const DividerWrapper = () => {
  return (
    <StyledNodeViewWrapper
      data-type="divider"
      tabIndex={0}
      role="separator"
      aria-orientation="horizontal"
    >
      <Divider />
    </StyledNodeViewWrapper>
  )
}

export const DividerNode = Node.create({
  name: "divider",
  group: "block",
  atom: true,
  draggable: false,
  selectable: false,

  addAttributes() {
    return {
      // future attributes (e.g. style) can go here
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="divider"]' }, { tag: ". . ." }]
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

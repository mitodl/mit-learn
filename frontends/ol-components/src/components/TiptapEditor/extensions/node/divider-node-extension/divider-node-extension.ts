// divider-node-extension.ts
import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import DividerNodeView from "./divider-node-view"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    divider: {
      insertDivider: () => ReturnType
    }
  }
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
    return ReactNodeViewRenderer(DividerNodeView)
  },
})

export default DividerNode

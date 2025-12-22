import { Node, mergeAttributes } from "@tiptap/core"

export const Callout = Node.create({
  name: "callout",

  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [
      { tag: "callout" },
      { tag: "div[data-type='callout']" }, // optional fallback
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["callout", mergeAttributes(HTMLAttributes), 0]
  },
})

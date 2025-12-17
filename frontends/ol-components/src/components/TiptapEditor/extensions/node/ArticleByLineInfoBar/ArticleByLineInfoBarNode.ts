import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import ArticleByLineInfoBar from "./ArticleByLineInfoBar"

export const ArticleByLineInfoBarNode = Node.create({
  name: "byline",
  atom: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "byline" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["byline", mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ArticleByLineInfoBar)
  },
})

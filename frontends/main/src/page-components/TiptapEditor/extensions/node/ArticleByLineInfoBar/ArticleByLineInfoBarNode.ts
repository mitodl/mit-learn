import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import ArticleByLineInfoBar from "./ArticleByLineInfoBar"

/** @deprecated Use ByLineInfoBarNode */
export const ArticleByLineInfoBarNode = Node.create({
  name: "byline",
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      authorName: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author-name"),
        renderHTML: (attributes) => {
          if (!attributes.authorName) {
            return {}
          }
          return {
            "data-author-name": attributes.authorName,
          }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: "byline" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["byline", mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return ReactNodeViewRenderer(ArticleByLineInfoBar)
  },
})

/** Primary export — use this name in new code. */
export { ArticleByLineInfoBarNode as ByLineInfoBarNode }

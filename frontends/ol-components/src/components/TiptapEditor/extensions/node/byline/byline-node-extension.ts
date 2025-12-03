import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import BylineComponent from "./Byline-view"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    byline: {
      insertByline: (options: {
        authorName: string
        avatarUrl?: string
        readTime?: string
        publishedDate?: string
      }) => ReturnType
    }
  }
}

export const ArticleBylineInfoBar = Node.create({
  name: "byline",

  group: "block",
  atom: true,
  selectable: false,

  addOptions() {
    return {
      authorName: "",
      avatarUrl: "",
      readTime: "",
      publishedDate: "",
      editable: true,
    }
  },

  addAttributes() {
    return {
      authorName: {
        default: null,
      },
      avatarUrl: {
        default: null,
      },
      readTime: {
        default: null,
      },
      publishedDate: {
        default: null,
      },
      editable: { default: true },
    }
  },

  parseHTML() {
    return [{ tag: "byline-block" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "byline-block",
      mergeAttributes(HTMLAttributes),
      // NEVER return empty text nodes
      "",
    ]
  },

  addCommands() {
    return {
      insertByline:
        ({ authorName, avatarUrl, readTime, publishedDate }) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { authorName, avatarUrl, readTime, publishedDate },
            })
            .run()
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(BylineComponent)
  },
})

import { Node, mergeAttributes, type CommandProps } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { MediaEmbedNodeView } from "./MediaEmbedNodeView"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mediaEmbed: {
      insertMedia: (src: string) => ReturnType
    }
  }
}

export const MediaEmbedNode = Node.create({
  name: "mediaEmbed",

  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      width: { default: "100%" },
      height: { default: "100%" },
      frameborder: { default: 0 },
      allowfullscreen: { default: "true" },
      float: { default: null }, // ← NEW ("left" | "right" | null)
      editable: { default: true },
      layout: {
        default: "default", // 👈 NEW!
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") || "",
        renderHTML: (attrs) => ({
          "data-caption": attrs.caption,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "iframe[src]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["iframe", mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      insertMedia:
        (src: string) =>
        ({ state, chain }: CommandProps) => {
          const { from } = state.selection

          return (
            chain()
              .insertContentAt(from, {
                type: this.name,
                attrs: { src },
              })
              // 👇 Move cursor AFTER the inserted node
              .setTextSelection(from + 2)
              .run()
          )
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaEmbedNodeView)
  },
})

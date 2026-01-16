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
      frameBorder: { default: 0 },
      allowFullScreen: { default: true },
      editable: { default: true, renderHTML: false },
      layout: {
        default: "default", // 👈 NEW!
        renderHTML: false,
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
    const { editable, layout, ...iframeAttributes } = HTMLAttributes
    return ["iframe", mergeAttributes(iframeAttributes)]
  },

  addCommands() {
    return {
      insertMedia:
        (src: string) =>
        ({ commands }: CommandProps) => {
          // Insert media node followed by an empty paragraph
          const mediaNode = {
            type: this.name,
            attrs: { src },
          }
          const emptyParagraph = {
            type: "paragraph",
          }

          return commands.insertContent([mediaNode, emptyParagraph])
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaEmbedNodeView)
  },
})

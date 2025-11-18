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

export const MediaEmbed = Node.create({
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
    const { float, ...rest } = HTMLAttributes

    return [
      "div",
      {
        style: `
        float: ${float || "none"};
        margin: ${float ? "0 12px 12px 0" : "12px 0"};
      `,
      },
      ["iframe", rest],
    ]
  },

  addCommands() {
    return {
      insertMedia:
        (src: string) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src },
          })
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaEmbedNodeView)
  },
})

import { Node, mergeAttributes, type CommandProps } from "@tiptap/core"

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
      height: { default: "400" },
      frameborder: { default: 0 },
      allowfullscreen: { default: "true" },
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
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src },
          })
        },
    }
  },
})

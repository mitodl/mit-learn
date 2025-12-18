import Blockquote from "@tiptap/extension-blockquote"

export const Callout = Blockquote.extend({
  name: "callout",

  parseHTML() {
    return [
      { tag: "callout" }, // Custom tag
    ]
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderHTML({ HTMLAttributes }: { HTMLAttributes: { [key: string]: any } }) {
    return ["callout", HTMLAttributes, 0]
  },
})

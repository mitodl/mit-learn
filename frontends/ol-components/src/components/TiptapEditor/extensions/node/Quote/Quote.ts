import Blockquote from "@tiptap/extension-blockquote"

export const Quote = Blockquote.extend({
  name: "quote",

  parseHTML() {
    return [
      { tag: "quote" }, // Custom tag
      { tag: "blockquote" }, // Fallback for pasted content
    ]
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderHTML({ HTMLAttributes }: { HTMLAttributes: { [key: string]: any } }) {
    return ["quote", HTMLAttributes, 0]
  },
})

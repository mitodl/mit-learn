import { Node, mergeAttributes } from "@tiptap/core"

export const Description = Node.create({
  name: "description",

  group: "block",
  content: "inline*",

  parseHTML() {
    return [
      {
        tag: "p[data-type='description']",
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, { "data-type": "description" }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      // Prevent Enter from creating a new description
      Enter: ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection

        // Check if we're in a description node
        if ($from.parent.type.name === "description") {
          // Try to move to the next node instead of creating a new line
          return editor.commands.focus("end")
        }

        return false
      },
    }
  },
})


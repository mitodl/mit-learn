import { Node, mergeAttributes, type CommandProps } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { LearningResourceNodeView } from "./LearningResourceListCard"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    learningResource: {
      insertLearningResource: (resourceId: number, href?: string) => ReturnType
    }
  }
}
export interface LearningResourceOptions {
  HTMLAttributes: Record<string, string | number | null | undefined>
}

export const LearningResourceNode = Node.create<LearningResourceOptions>({
  name: "learningResource",

  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      resourceId: {
        default: null,
      },
      href: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [{ tag: "learning-resource" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["learning-resource", mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      insertLearningResource:
        (resourceId: number, href?: string) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: { resourceId, href },
          })
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(LearningResourceNodeView)
  },
})

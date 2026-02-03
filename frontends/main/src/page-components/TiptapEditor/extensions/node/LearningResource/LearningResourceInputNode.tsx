import { Node, mergeAttributes } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { ExtendedNodeConfig } from "../types"

const learningResourceInputConfig: ExtendedNodeConfig = {
  name: "learningResourceInput",

  group: "block",

  content: "paragraph",

  parseHTML() {
    return [{ tag: "learning-resource-input" }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["learning-resource-input", mergeAttributes(HTMLAttributes), 0]
  },

  getPlaceholders: (childNode: ProseMirrorNode) => {
    if (childNode.type.name === "paragraph") {
      return "Paste course url here"
    }
    return null
  },
}

export const LearningResourceInputNode = Node.create(
  learningResourceInputConfig,
)

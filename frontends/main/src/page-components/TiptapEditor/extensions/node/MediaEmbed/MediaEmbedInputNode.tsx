import { Node, mergeAttributes } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { ExtendedNodeConfig } from "../types"

const mediaEmbedInputConfig: ExtendedNodeConfig = {
  name: "mediaEmbedInput",

  group: "block",

  content: "paragraph",

  parseHTML() {
    return [{ tag: "media-embed-input" }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["p", mergeAttributes(HTMLAttributes), 0]
  },

  getPlaceholders: (childNode: ProseMirrorNode) => {
    if (childNode.type.name === "paragraph") {
      return "Paste media URL here"
    }
    return null
  },
}

export const MediaEmbedInputNode = Node.create(mediaEmbedInputConfig)

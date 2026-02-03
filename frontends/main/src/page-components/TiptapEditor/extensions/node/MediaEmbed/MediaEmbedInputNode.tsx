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
    return ["media-embed-input", mergeAttributes(HTMLAttributes), 0]
  },

  getPlaceholders: (childNode: ProseMirrorNode) => {
    if (childNode.type.name === "paragraph") {
      return "Paste media url here"
    }
    return null
  },
}

export const MediaEmbedInputNode = Node.create(mediaEmbedInputConfig)

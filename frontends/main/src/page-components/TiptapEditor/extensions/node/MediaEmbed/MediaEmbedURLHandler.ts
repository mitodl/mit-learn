import { Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"

import { convertToEmbedUrl } from "./lib"
import { createURLToNodeHandler } from "../shared/createURLToNodeHandler"

function extractMediaEmbedUrl(text: string): string | null {
  try {
    // convertToEmbedUrl now handles all validation and returns null for unsupported URLs
    return convertToEmbedUrl(text.trim())
  } catch {
    return null
  }
}

export const MediaEmbedURLHandler = Extension.create({
  name: "mediaEmbedURLHandler",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: createURLToNodeHandler({
            inputNodeName: "mediaEmbedInput",
            outputNodeName: "mediaEmbed",
            extractValue: extractMediaEmbedUrl,
            createNodeAttrs: (src) => ({ src }),
          }),
        },
      }),
    ]
  },
})

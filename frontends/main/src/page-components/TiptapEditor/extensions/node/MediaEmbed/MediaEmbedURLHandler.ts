import { Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"

import { convertToEmbedUrl } from "./lib"

function extractMediaEmbedUrl(text: string): string | null {
  try {
    const trimmed = text.trim()

    // Only process text that looks like a URL (starts with http:// or https://)
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return null
    }

    // Don't match resource URLs - they should be handled by LearningResourceURLHandler
    if (trimmed.includes("resource=")) {
      return null
    }

    const embedUrl = convertToEmbedUrl(trimmed)

    return embedUrl || null
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
          handleKeyDown(view, event) {
            if (event.key !== "Enter") return false

            const { state } = view
            const { $from } = state.selection
            const parent = $from.parent

            // Only transform plain paragraphs
            if (parent.type.name !== "paragraph") return false

            const text = parent.textContent.trim()
            const embedSrc = extractMediaEmbedUrl(text)
            if (!embedSrc) return false

            event.preventDefault()

            const startPos = $from.before()
            const endPos = startPos + parent.nodeSize

            const mediaNode = state.schema.nodes.mediaEmbed.create({
              src: embedSrc,
            })

            const tr = state.tr.replaceWith(startPos, endPos, mediaNode)
            view.dispatch(tr)

            return true
          },
        },
      }),
    ]
  },
})

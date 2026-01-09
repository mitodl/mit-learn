import { Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"

import { convertToEmbedUrl } from "./lib"

function extractMediaEmbedUrl(text: string): string | null {
  try {
    const embedUrl = convertToEmbedUrl(text.trim())
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

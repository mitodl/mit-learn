import { Extension } from "@tiptap/core"
import { NodeSelection, Plugin } from "@tiptap/pm/state"

import { convertToEmbedUrl } from "./lib"

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
          handleKeyDown(view, event) {
            if (event.key !== "Enter") return false

            const { state } = view
            const { $from } = state.selection
            const parent = $from.parent

            // Only transform plain paragraphs
            if (parent.type.name !== "paragraph") return false

            const text = parent.textContent.trim()
            const embedSrc = extractMediaEmbedUrl(text)
            console.log(embedSrc)
            if (!embedSrc) return false

            event.preventDefault()

            // Check if paragraph is inside mediaEmbedInput node
            const grandParent = $from.node($from.depth - 1)
            const isInsideMediaEmbedInput =
              grandParent?.type.name === "mediaEmbedInput"

            let startPos, endPos
            if (isInsideMediaEmbedInput) {
              // Replace the entire mediaEmbedInput node
              startPos = $from.before($from.depth - 1)
              endPos = startPos + grandParent.nodeSize
            } else {
              // Replace just the paragraph
              startPos = $from.before()
              endPos = startPos + parent.nodeSize
            }

            const mediaNode = state.schema.nodes.mediaEmbed.create({
              src: embedSrc,
            })

            const tr = state.tr.replaceWith(startPos, endPos, mediaNode)
            tr.setSelection(NodeSelection.create(tr.doc, startPos))
            view.dispatch(tr)

            return true
          },
        },
      }),
    ]
  },
})

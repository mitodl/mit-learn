import { Extension } from "@tiptap/core"
import { Plugin, TextSelection } from "@tiptap/pm/state"

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

            const startPos = $from.before()
            const endPos = startPos + parent.nodeSize

            const mediaNode = state.schema.nodes.mediaEmbed.create({
              src: embedSrc,
            })

            // Create an empty paragraph for the user to continue typing
            const newParagraph = state.schema.nodes.paragraph.create()

            // Replace the current paragraph with media node + new paragraph
            let tr = state.tr.replaceWith(startPos, endPos, [
              mediaNode,
              newParagraph,
            ])

            // Set cursor at the start of the new paragraph
            const cursorPos = startPos + mediaNode.nodeSize + 1
            tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)))

            view.dispatch(tr)

            return true
          },
        },
      }),
    ]
  },
})

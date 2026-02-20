import { Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"
import { createURLToNodeHandler } from "../shared/createURLToNodeHandler"

function extractResourceId(url: string): number | null {
  const match = url.match(/resource=(\d+)/)
  if (!match) return null
  return Number(match[1])
}

export const LearningResourceURLHandler = Extension.create({
  name: "learningResourceURLHandler",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: createURLToNodeHandler({
            inputNodeName: "learningResourceInput",
            outputNodeName: "learningResource",
            extractValue: extractResourceId,
            createNodeAttrs: (resourceId, text) => ({
              resourceId,
              href: text,
            }),
          }),
        },

        /**
         * 🔥 This part disables the Link toolbar button
         * ONLY for auto-converted resource URLs (where text === URL)
         * Allows user-created links (where text !== URL)
         */
        appendTransaction(transactions, oldState, newState) {
          const tr = newState.tr
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (!node.isText || !node.marks.length) return

            const linkMark = node.marks.find(
              (mark) => mark.type.name === "link",
            )
            if (!linkMark) return

            const href = linkMark.attrs.href
            if (!extractResourceId(href)) return

            // Only remove the link mark if the text is the same as the URL
            // This allows user-created links (where text !== URL) to remain
            const nodeText = node.text || ""
            if (nodeText.trim() !== href.trim()) return

            tr.removeMark(pos, pos + node.nodeSize, linkMark.type)
            modified = true
          })

          return modified ? tr : null
        },
      }),
    ]
  },
})

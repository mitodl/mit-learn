import { Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"
import { createURLToNodeHandler } from "../shared/createURLToNodeHandler"

export function extractResourceId(url: string): number | null {
  const resourceParamMatch = url.match(/[?&]resource=(\d+)\b/)
  if (resourceParamMatch) {
    return Number(resourceParamMatch[1])
  }

  // Support MIT Learn video URLs like:
  // https://rc.learn.mit.edu/video/135366?playlist=128974
  const videoPathMatch = url.match(/\/video\/(\d+)(?:[/?#]|$)/)
  if (videoPathMatch) {
    return Number(videoPathMatch[1])
  }

  // Support MIT Learn podcast episode URLs like:
  // https://rc.learn.mit.edu/podcast/136068/podcast_episode/137277
  const podcastEpisodeMatch = url.match(
    /\/podcast\/\d+\/podcast_episode\/(\d+)(?:[/?#]|$)/,
  )
  if (podcastEpisodeMatch) {
    return Number(podcastEpisodeMatch[1])
  }

  // Support MIT Learn podcast URLs like:
  // https://rc.learn.mit.edu/podcast/136068
  const podcastMatch = url.match(/\/podcast\/(\d+)(?:[/?#]|$)/)
  if (podcastMatch) {
    return Number(podcastMatch[1])
  }

  return null
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

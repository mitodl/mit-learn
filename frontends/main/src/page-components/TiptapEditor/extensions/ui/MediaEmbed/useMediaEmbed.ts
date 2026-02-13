import { useCallback } from "react"
import type { Editor } from "@tiptap/react"
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"
import { Icon } from "./Icon"

export function useMediaEmbed(editor?: Editor | null) {
  const resolved = useTiptapEditor(editor).editor

  const isVisible = !!resolved
  const canInsert = resolved?.isEditable ?? false

  const label = "Embed Media"

  const handleEmbed = useCallback(() => {
    if (!resolved) return

    const { selection, doc } = resolved.state
    const { $from } = selection

    // Check if we're inside a banner node
    const isInBanner =
      $from.node($from.depth - 1)?.type.name === "banner" ||
      $from.node($from.depth)?.type.name === "banner"

    let insertPos = selection.from

    if (isInBanner) {
      // Find the position after banner and byline nodes
      let bannerEnd = -1
      let bylineEnd = -1

      doc.descendants((node, pos) => {
        if (node.type.name === "banner") {
          bannerEnd = pos + node.nodeSize
        } else if (node.type.name === "byline" && bannerEnd !== -1) {
          bylineEnd = pos + node.nodeSize
          return false // Stop searching
        }
        return undefined
      })

      // Insert after byline if found, otherwise after banner
      insertPos = bylineEnd !== -1 ? bylineEnd : bannerEnd
    }

    // Insert mediaEmbedInput node with empty paragraph that will show "Paste media url here" placeholder
    // The MediaEmbedURLHandler extension will automatically
    // convert this to a media embed when user pastes a valid URL and presses Enter
    resolved
      .chain()
      .insertContentAt(insertPos, {
        type: "mediaEmbedInput",
        content: [
          {
            type: "paragraph",
            content: [],
          },
        ],
      })
      .focus(insertPos + 1)
      .run()
  }, [resolved])

  return {
    editor: resolved,
    isVisible,
    canInsert,
    label,
    Icon,
    isActive: false,
    handleEmbed,
  }
}

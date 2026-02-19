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

    // Insert mediaEmbedInput node with empty paragraph that will show "Paste media url here" placeholder
    // The MediaEmbedURLHandler extension will automatically
    // convert this to a media embed when user pastes a valid URL and presses Enter
    resolved
      .chain()
      .focus()
      .insertContent({
        type: "mediaEmbedInput",
        content: [
          {
            type: "paragraph",
            content: [],
          },
        ],
      })
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

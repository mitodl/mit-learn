import { useCallback, useMemo } from "react"
import type { Editor } from "@tiptap/react"
import { useTiptapEditor } from "../../../hooks/use-tiptap-editor"
import { convertToEmbedUrl } from "./lib"
import { Icon } from "./Icon"

export const MEDIA_EMBED_SHORTCUT_KEY = "Mod+Shift+E"

export function useMediaEmbed(editor?: Editor | null) {
  const resolved = useTiptapEditor(editor).editor

  const isVisible = !!resolved
  const canInsert = resolved?.isEditable ?? false

  const label = "Embed Media"

  const handleEmbed = useCallback(() => {
    const url = prompt("Enter a media URL (YouTube, Vimeo, etc)")
    if (!url) return

    resolved?.commands.insertMedia(convertToEmbedUrl(url))
  }, [resolved])

  return {
    editor: resolved,
    isVisible,
    canInsert,
    label,
    Icon,
    isActive: false,
    shortcutKeys: MEDIA_EMBED_SHORTCUT_KEY,
    handleEmbed,
  }
}

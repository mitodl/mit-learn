import { useCallback } from "react"
import type { Editor } from "@tiptap/react"
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"
import { convertToEmbedUrl } from "../../node/MediaEmbed/lib"
import NiceModal from "@ebay/nice-modal-react"
import MediaUrlInputDialog from "./MediaUrlInputDialog"
import { Icon } from "./Icon"

export function useMediaEmbed(editor?: Editor | null) {
  const resolved = useTiptapEditor(editor).editor

  const isVisible = !!resolved
  const canInsert = resolved?.isEditable ?? false

  const label = "Embed Media"

  const handleEmbed = useCallback(async () => {
    try {
      const url: string = await NiceModal.show(MediaUrlInputDialog)
      if (!url) return

      const embedUrl = convertToEmbedUrl(url)
      if (!embedUrl) {
        return
      }

      resolved?.commands.insertMedia(embedUrl)
    } catch {
      // modal was closed / cancelled
    }
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

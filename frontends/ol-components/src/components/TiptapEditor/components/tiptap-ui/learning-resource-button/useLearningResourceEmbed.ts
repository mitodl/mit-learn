import { useCallback } from "react"
import type { Editor } from "@tiptap/react"
import { useTiptapEditor } from "../../../hooks/use-tiptap-editor"
import { Icon } from "./Icon" // you create this SVG

export const LEARNING_RESOURCE_SHORTCUT_KEY = "Mod+Shift+R"

export function useLearningResourceEmbed(editor?: Editor | null) {
  const resolved = useTiptapEditor(editor).editor

  const isVisible = !!resolved
  const canInsert = resolved?.isEditable ?? false
  const label = "Insert Learning Resource"

  const handleEmbed = useCallback(() => {
    const url = prompt("Paste a Learn.MIT resource URL")
    if (!url) return

    // Extract `resource=XYZ`
    const match = url.match(/resource=(\d+)/)
    if (!match) {
      alert("Invalid URL. Must contain ?resource=ID")
      return
    }

    const resourceId = Number(match[1])

    resolved?.commands.insertLearningResource(resourceId, url)
  }, [resolved])

  return {
    editor: resolved,
    isVisible,
    canInsert,
    label,
    Icon, // SVG icon (same as your media embed pattern)
    isActive: false,
    shortcutKeys: LEARNING_RESOURCE_SHORTCUT_KEY,
    handleEmbed,
  }
}

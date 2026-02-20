import { useCallback } from "react"
import type { Editor } from "@tiptap/react"
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"
import { Icon } from "./Icon"

export const LEARNING_RESOURCE_SHORTCUT_KEY = "Mod+Shift+R"

export function useLearningResourceEmbed(editor?: Editor | null) {
  const resolved = useTiptapEditor(editor).editor

  const isVisible = !!resolved
  const canInsert = resolved?.isEditable ?? false
  const label = "Insert Learning Resource"

  const handleEmbed = useCallback(() => {
    if (!resolved) return

    // Insert learningResourceInput node with empty paragraph that will show "Paste course url here" placeholder
    // The LearningResourceURLHandler extension will automatically
    // convert this to a learning resource when user pastes a valid URL and presses Enter
    resolved
      .chain()
      .focus()
      .insertContent({
        type: "learningResourceInput",
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
    shortcutKeys: LEARNING_RESOURCE_SHORTCUT_KEY,
    handleEmbed,
  }
}

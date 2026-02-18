import { useCallback } from "react"
import type { JSONContent } from "@tiptap/core"
import type { Editor } from "@tiptap/react"
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"
import { Icon } from "./Icon"

export const LEARNING_RESOURCE_SHORTCUT_KEY = "Mod+Shift+R"

/**
 * Uses a dry-run transaction and checks tr.docChanged to detect real insertability.
 * editor.can() alone can miss dispatch-time validation that prevents insertion.
 */
const wouldInsertAtPosition = (
  editor: Editor,
  position: number,
  content: JSONContent,
) => {
  let didChange = false

  editor
    .chain()
    .setTextSelection(position)
    .command(({ tr, commands }) => {
      const inserted = commands.insertContent(content)
      didChange = inserted && tr.docChanged
      tr.setMeta("preventDispatch", true)
      return didChange
    })
    .run()

  return didChange
}

/**
 * Finds the first position at or after startPos where a dry-run insertion would actually change the doc.
 * This is more reliable than editor.can() for schema/command checks enforced at dispatch.
 */
const getFirstInsertablePosition = (
  editor: Editor,
  startPos: number,
  content: JSONContent,
) => {
  const { doc } = editor.state
  for (let pos = startPos; pos <= doc.content.size; pos++) {
    if (wouldInsertAtPosition(editor, pos, content)) {
      return pos
    }
  }

  return null
}

export function useLearningResourceEmbed(editor?: Editor | null) {
  const resolved = useTiptapEditor(editor).editor

  const isVisible = !!resolved
  const canInsert = resolved?.isEditable ?? false
  const label = "Insert Learning Resource"

  const handleEmbed = useCallback(() => {
    if (!resolved) return

    const { selection } = resolved.state

    const inputNode: JSONContent = {
      type: "learningResourceInput",
      content: [
        {
          type: "paragraph",
          content: [],
        },
      ],
    }

    const insertPos = getFirstInsertablePosition(
      resolved,
      selection.from,
      inputNode,
    )

    if (insertPos === null) return

    // Insert learningResourceInput node with empty paragraph that will show "Paste course url here" placeholder
    // The LearningResourceURLHandler extension will automatically
    // convert this to a learning resource when user pastes a valid URL and presses Enter
    resolved
      .chain()
      .insertContentAt(insertPos, inputNode)
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
    shortcutKeys: LEARNING_RESOURCE_SHORTCUT_KEY,
    handleEmbed,
  }
}

import { useCallback } from "react"
import type { Editor, JSONContent } from "@tiptap/react"
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"
import { Icon } from "./Icon"

export const LEARNING_RESOURCE_SHORTCUT_KEY = "Mod+Shift+R"

const learningResourceInputContent: JSONContent = {
  type: "learningResourceInput",
  content: [
    {
      type: "paragraph",
      content: [],
    },
  ],
}

const learningResourceProbeContent: JSONContent = {
  type: "learningResource",
  attrs: {
    resourceId: 1,
    href: "https://example.com/learn?resource=1",
  },
}

/**
 * Return `true` if inserting the given content would change the document, `false` if it would be a no-op.
 *
 * NOTE: `editor.can().insertContent()` can be too permissive because insertion
 * logic is largely gated by `dispatch` (not run in `can` branch). We simulate
 * the real command path and set `preventDispatch` so no state is committed, then rely on `tr.docChanged`.
 */
const wouldInsertContentChangeDoc = (
  editor: Editor,
  content: JSONContent,
): boolean => {
  let didChange = false

  editor
    .chain()
    .command(({ tr, commands }) => {
      const inserted = commands.insertContent(content)
      didChange = inserted && tr.docChanged
      tr.setMeta("preventDispatch", true)
      return didChange
    })
    .run()

  return didChange
}

export function useLearningResourceEmbed(editor?: Editor | null) {
  const resolved = useTiptapEditor(editor).editor

  const isVisible = !!resolved
  const canInsert =
    !!resolved?.isEditable &&
    wouldInsertContentChangeDoc(resolved, learningResourceInputContent) &&
    wouldInsertContentChangeDoc(resolved, learningResourceProbeContent)
  const label = "Insert Learning Resource"

  const handleEmbed = useCallback(() => {
    if (!resolved || !canInsert) return

    // Insert learningResourceInput node with empty paragraph that will show "Paste course url here" placeholder
    // The LearningResourceURLHandler extension will automatically
    // convert this to a learning resource when user pastes a valid URL and presses Enter
    resolved.chain().focus().insertContent(learningResourceInputContent).run()
  }, [resolved, canInsert])

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

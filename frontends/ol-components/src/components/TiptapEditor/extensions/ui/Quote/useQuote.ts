"use client"

import { useCallback, useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

// --- Hooks ---
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"

// --- Icons ---
import { BlockquoteIcon } from "../../../vendor/components/tiptap-icons/blockquote-icon"

// --- UI Utils ---
import {
  findNodePosition,
  isNodeInSchema,
  isNodeTypeSelected,
  isValidPosition,
  selectionWithinConvertibleTypes,
} from "../../../vendor/lib/tiptap-utils"

export const QUOTE_SHORTCUT_KEY = "mod+shift+b"

/**
 * Configuration for the quote functionality
 */
export interface UseQuoteConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Whether the button should hide when quote is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback function called after a successful toggle.
   */
  onToggled?: () => void
}

/**
 * Checks if quote can be toggled in the current editor state
 */
export function canToggleQuote(
  editor: Editor | null,
  turnInto: boolean = true,
): boolean {
  if (!editor || !editor.isEditable) return false
  if (!isNodeInSchema("quote", editor) || isNodeTypeSelected(editor, ["image"]))
    return false

  if (!turnInto) {
    return editor.can().toggleWrap("quote")
  }

  // Ensure selection is in nodes we're allowed to convert
  if (
    !selectionWithinConvertibleTypes(editor, [
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "taskList",
      "blockquote",
      "quote",
      "codeBlock",
    ])
  )
    return false

  // Either we can wrap in quote directly on the selection,
  // or we can clear formatting/nodes to arrive at a quote.
  return editor.can().toggleWrap("quote") || editor.can().clearNodes()
}

/**
 * Toggles quote formatting for a specific node or the current selection
 */
export function toggleQuote(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (!canToggleQuote(editor)) return false

  try {
    const view = editor.view
    let state = view.state
    let tr = state.tr

    // No selection, find the the cursor position
    if (state.selection.empty || state.selection instanceof TextSelection) {
      const pos = findNodePosition({
        editor,
        node: state.selection.$anchor.node(1),
      })?.pos
      if (!isValidPosition(pos)) return false

      tr = tr.setSelection(NodeSelection.create(state.doc, pos))
      view.dispatch(tr)
      state = view.state
    }

    const selection = state.selection

    let chain = editor.chain().focus()

    // Handle NodeSelection
    if (selection instanceof NodeSelection) {
      const firstChild = selection.node.firstChild?.firstChild
      const lastChild = selection.node.lastChild?.lastChild

      const from = firstChild
        ? selection.from + firstChild.nodeSize
        : selection.from + 1

      const to = lastChild
        ? selection.to - lastChild.nodeSize
        : selection.to - 1

      const resolvedFrom = state.doc.resolve(from)
      const resolvedTo = state.doc.resolve(to)

      chain = chain
        .setTextSelection(TextSelection.between(resolvedFrom, resolvedTo))
        .clearNodes()
    }

    const toggle = editor.isActive("quote")
      ? chain.lift("quote")
      : chain.wrapIn("quote")

    toggle.run()

    editor.chain().focus().selectTextblockEnd().run()

    return true
  } catch {
    return false
  }
}

/**
 * Determines if the quote button should be shown
 */
export function shouldShowButton(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, hideWhenUnavailable } = props

  if (!editor || !editor.isEditable) return false
  if (!isNodeInSchema("quote", editor)) return false

  if (hideWhenUnavailable && !editor.isActive("code")) {
    return canToggleQuote(editor)
  }

  return true
}

export function useQuote(config?: UseQuoteConfig) {
  const {
    editor: providedEditor,
    hideWhenUnavailable = false,
    onToggled,
  } = config || {}

  const { editor } = useTiptapEditor(providedEditor)
  const [isVisible, setIsVisible] = useState<boolean>(true)
  const canToggle = canToggleQuote(editor)
  const isActive = editor?.isActive("quote") || false

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      setIsVisible(shouldShowButton({ editor, hideWhenUnavailable }))
    }

    handleSelectionUpdate()

    editor.on("selectionUpdate", handleSelectionUpdate)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor, hideWhenUnavailable])

  const handleToggle = useCallback(() => {
    if (!editor) return false

    const success = toggleQuote(editor)
    if (success) {
      onToggled?.()
    }
    return success
  }, [editor, onToggled])

  return {
    isVisible,
    isActive,
    handleToggle,
    canToggle,
    label: "Quote",
    shortcutKeys: QUOTE_SHORTCUT_KEY,
    Icon: BlockquoteIcon,
  }
}

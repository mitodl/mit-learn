import React, { forwardRef } from "react"
import type { Editor } from "@tiptap/core"
import { Button } from "../../../components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "../../../hooks/use-tiptap-editor"

export const InsertBylineButton = forwardRef<
  HTMLButtonElement,
  {
    editor?: Editor
    authorName: string
    publishedDate?: string
    avatarUrl?: string
  }
>(({ editor: providedEditor, authorName, publishedDate, avatarUrl }, ref) => {
  const { editor } = useTiptapEditor(providedEditor)
  if (!editor) return null

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    editor
      .chain()
      .focus()
      .insertByline({ authorName, publishedDate, avatarUrl })
      .run()
  }

  return (
    <Button type="button" data-style="ghost" onClick={handleClick} ref={ref}>
      <span className="tiptap-button-icon">👤</span>
      <span className="tiptap-button-text">Insert Byline</span>
    </Button>
  )
})

InsertBylineButton.displayName = "InsertBylineButton"

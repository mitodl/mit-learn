import React, { forwardRef, useCallback } from "react"
import { Button } from "../../tiptap-ui-primitive/button"
import { Badge } from "../../tiptap-ui-primitive/badge"
import { parseShortcutKeys } from "../../../lib/tiptap-utils"
import {
  useLearningResourceEmbed,
  LEARNING_RESOURCE_SHORTCUT_KEY,
} from "./useLearningResourceEmbed"
import { useTiptapEditor } from "../../../hooks/use-tiptap-editor"

export interface LearningResourceEmbedButtonProps {
  editor?: any
  text?: string
  showShortcut?: boolean
  icon?: React.FC<React.SVGProps<SVGSVGElement>>
  onClick?: (e: React.MouseEvent) => void
}

function LearningResourceShortcutBadge() {
  return (
    <Badge>
      {parseShortcutKeys({ shortcutKeys: LEARNING_RESOURCE_SHORTCUT_KEY })}
    </Badge>
  )
}

export const LearningResourceEmbedButton = forwardRef<
  HTMLButtonElement,
  LearningResourceEmbedButtonProps
>(
  (
    {
      editor: providedEditor,
      text,
      showShortcut,
      icon: CustomIcon,
      onClick,
      ...props
    },
    ref,
  ) => {
    const { editor } = useTiptapEditor(providedEditor)

    const {
      isVisible,
      canInsert,
      label,
      Icon: DefaultIcon,
      shortcutKeys,
      handleEmbed,
    } = useLearningResourceEmbed(editor)

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        handleEmbed()
      },
      [handleEmbed, onClick],
    )

    if (!isVisible) return null

    const RenderIcon = CustomIcon ?? DefaultIcon

    return (
      <Button
        type="button"
        data-style="ghost"
        disabled={!canInsert}
        aria-label={label}
        tooltip={label}
        onClick={handleClick}
        ref={ref}
        {...props}
      >
        <RenderIcon />
        {text && <span className="tiptap-button-text">{text}</span>}
        {showShortcut && <LearningResourceShortcutBadge />}
      </Button>
    )
  },
)

LearningResourceEmbedButton.displayName = "LearningResourceEmbedButton"

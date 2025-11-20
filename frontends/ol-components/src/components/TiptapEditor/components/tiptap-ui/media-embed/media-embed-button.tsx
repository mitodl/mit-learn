import React, { forwardRef, useCallback } from "react"
import { Button } from "../../tiptap-ui-primitive/button"
import { useMediaEmbed } from "./useMediaEmbed"
import { useTiptapEditor } from "../../../hooks/use-tiptap-editor"

export interface MediaEmbedButtonProps {
  editor?: any
  text?: string
  showShortcut?: boolean
  icon?: React.FC<React.SVGProps<SVGSVGElement>>
  onClick?: (e: React.MouseEvent) => void
}

export const MediaEmbedButton = forwardRef<
  HTMLButtonElement,
  MediaEmbedButtonProps
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
      handleEmbed,
    } = useMediaEmbed(editor)

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
      </Button>
    )
  },
)

MediaEmbedButton.displayName = "MediaEmbedButton"

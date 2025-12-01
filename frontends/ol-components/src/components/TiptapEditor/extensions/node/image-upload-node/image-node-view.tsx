import React, { useState } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"

import styled from "@emotion/styled"
import NiceModal from "@ebay/nice-modal-react"
import ImageAltTextInput from "./ImageAltTextInput"
import { DefaultWidth, WideWidth, FullWidth } from "./Icons"

const StyledNodeViewWrapper = styled(NodeViewWrapper)<{
  layout: string
  hovering: boolean
}>`
  position: relative;
  margin: 2rem auto;
  text-align: center;
  width: 100%;

  img {
    width: 100%;
    height: auto;
    aspect-ratio: 16/9;
    border-radius: 6px;
    display: block;
  }

  &.layout-default {
    width: 100%;
  }

  &.layout-wide {
    width: 90vw;
    position: relative;
    left: 50%;
    right: 50%;
    margin-left: -45vw;
    margin-right: -45vw;
  }

  &.layout-full {
    width: 100vw;
    position: relative;
    left: 50%;
    right: 50%;
    margin-left: -50vw;
    margin-right: -50vw;
  }

  .caption-input {
    margin-top: 10px;
    width: 100%;
    border: none;
    outline: none;
    text-align: center;
    background: transparent;
    font-size: 14px;
    padding: 4px 0;

    &:focus {
      border-bottom-color: #999;
    }
  }

  .media-layout-toolbar {
    position: absolute;
    top: -43px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    background-color: rgb(0 0 0 / 85%);
    padding: 6px 10px;
    border-radius: 8px;
    gap: 8px;
    width: 220px;
    justify-content: center;

    &::after {
      content: "";
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid rgb(0 0 0 / 85%);
    }

    button {
      width: 40px;
      height: 28px;
      border-radius: 4px;
      border: none;
      background: transparent;
      filter: brightness(0.9);
      color: white;
      cursor: pointer;

      &.active {
        background: #9be19b;
        color: black;
        font-weight: bold;
      }
    }

    .alt-text-button {
      color: white;
      font-size: 12px;
      border-left: 1px solid rgb(255 255 255 / 50%);
      border-radius: 4px;
      padding: 2px 6px;
      width: 100px;
    }
  }
`

export function ImageUploadNodeComponent({
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const { layout, caption, src, alt } = node.attrs
  const [hovering, setHovering] = useState(false)

  const isEditable = node.attrs.editable

  const openAltTextDialog = async () => {
    try {
      const result = await NiceModal.show(ImageAltTextInput, {
        initialAlt: alt ?? "",
      })
      if (result) updateAttributes({ alt: result as unknown as string })
    } catch {
      await NiceModal.hide(ImageAltTextInput)
    }
  }

  return (
    <StyledNodeViewWrapper
      layout={layout}
      hovering={hovering}
      className={`layout-${layout}`}
      data-type="image-upload"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {isEditable && hovering && (
        <div className="media-layout-toolbar">
          <button
            className={layout === "default" ? "active" : ""}
            onClick={() => updateAttributes({ layout: "default" })}
            title="Default width"
          >
            <DefaultWidth />
          </button>
          <button
            className={layout === "wide" ? "active" : ""}
            onClick={() => updateAttributes({ layout: "wide" })}
            title="Wide"
          >
            <WideWidth />
          </button>
          <button
            className={layout === "full" ? "active" : ""}
            onClick={() => updateAttributes({ layout: "full" })}
            title="Full width"
          >
            <FullWidth />
          </button>
          <button
            onClick={openAltTextDialog}
            title="Edit Alt Text"
            className="alt-text-button"
          >
            Alt Text
          </button>
        </div>
      )}

      <img
        src={src}
        alt={alt || caption || "Image"}
        className="image-content"
      />

      {isEditable ? (
        <input
          type="text"
          className="caption-input"
          placeholder="Add caption…"
          value={caption || ""}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
      ) : (
        caption && <p>{caption}</p>
      )}
    </StyledNodeViewWrapper>
  )
}

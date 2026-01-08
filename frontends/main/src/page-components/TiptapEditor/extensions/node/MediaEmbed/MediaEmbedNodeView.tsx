import React, { useState } from "react"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { FullWidth, WideWidth, DefaultWidth } from "./Icons"
import styled from "@emotion/styled"

const StyledNodeViewWrapper = styled(NodeViewWrapper, {
  shouldForwardProp: (prop) => !["editable", "float", "layout"].includes(prop),
})<{
  layout: string
  hovering: boolean
}>`
  position: relative;
  width: 100%;
  margin: 24px 0;
  text-align: center;

  .media-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;

    iframe {
      width: 100%;
      height: 100%;
      border-radius: 6px;
      display: block;
    }
  }

  .media-caption {
    max-width: 900px;
    margin: 8px auto 0;

    input {
      width: 100%;
      border: none;
      text-align: left;
      outline: none;
      padding: 16px 0;
      font-size: 14px;
      border-bottom: 1px solid #dde1e6;
    }

    p {
      font-size: 14px;
      color: #555;
      text-align: center;
      font-style: italic;
    }
  }

  .media-layout-toolbar {
    position: absolute;
    top: -43px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    display: flex;
    background: rgb(0 0 0 / 85%);
    padding: 6px 10px;
    border-radius: 8px;
    gap: 8px;
    width: 150px;
    justify-content: center;
    cursor: pointer;

    &::after {
      content: "";
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid rgb(0 0 0 / 85%);
    }

    button {
      width: 40px;
      height: 28px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: white;
      cursor: pointer;

      &.active {
        background: #9be19b;
        color: black;
        font-weight: bold;
      }
    }
  }

  /* Layout sizes */
  &.default {
    width: 100%;
  }

  &.wide {
    width: 90vw;
    margin-left: calc(-45vw + 50%);
  }

  &.full {
    width: 100vw;
    margin-left: calc(-50vw + 50%);
  }

  .svg-icon {
    fill: white;
  }

  .remove-button {
    opacity: 0;
    pointer-events: none;
  }

  &:hover .remove-button {
    opacity: 1;
    pointer-events: auto;
  }
`

const RemoveButton = styled("button")(({ theme }) => ({
  position: "absolute",
  top: -7,
  right: -7,
  zIndex: 2,

  background: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "50%",
  width: 24,
  height: 24,

  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,

  opacity: 0, // 👈 hidden
  pointerEvents: "none", // 👈 not clickable when hidden
  transition: "opacity 0.15s ease",

  "&:hover": {
    background: theme.custom.colors.lightGray1,
  },
}))

interface MediaEmbedNodeProps {
  node: NodeViewProps["node"]
  editor: NodeViewProps["editor"]
  getPos: NodeViewProps["getPos"]
  updateAttributes: (attrs: Record<string, string>) => void
}

export const MediaEmbedNodeView = ({
  node,
  editor,
  getPos,
  updateAttributes,
}: MediaEmbedNodeProps) => {
  const [hovering, setHovering] = useState(false)

  const { layout, caption, src, editable } = node.attrs

  const handleRemove = () => {
    const pos = getPos()
    if (typeof pos !== "number") return

    editor.chain().focus().setNodeSelection(pos).deleteSelection().run()
  }

  return (
    <StyledNodeViewWrapper
      layout={layout}
      hovering={hovering}
      className={`layout-${layout} media-embed ${layout}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {editable && (
        <RemoveButton
          type="button"
          aria-label="Remove course card"
          onClick={handleRemove}
          className="remove-button"
        >
          ×
        </RemoveButton>
      )}
      {/* Toolbar — identical to ImageUpload version */}
      {editable && hovering && (
        <div className="media-layout-toolbar">
          <button
            className={layout === "default" ? "active" : ""}
            onClick={() => updateAttributes({ layout: "default" })}
          >
            <DefaultWidth />
          </button>

          <button
            className={layout === "wide" ? "active" : ""}
            onClick={() => updateAttributes({ layout: "wide" })}
          >
            <WideWidth />
          </button>

          <button
            className={layout === "full" ? "active" : ""}
            onClick={() => updateAttributes({ layout: "full" })}
          >
            <FullWidth />
          </button>
        </div>
      )}

      <div className="media-container">
        <iframe src={src} frameBorder="0" allowFullScreen title={caption} />
      </div>

      <div className="media-caption">
        {editable ? (
          <input
            type="text"
            placeholder="Add caption…"
            value={caption || ""}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
        ) : (
          caption && <p>{caption}</p>
        )}
      </div>
    </StyledNodeViewWrapper>
  )
}

import React, { useState } from "react"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { FullWidth, WideWidth, DefaultWidth } from "./Icons"
import styled from "@emotion/styled"

const StyledNodeViewWrapper = styled(NodeViewWrapper, {
  shouldForwardProp: (prop) =>
    !["editable", "hovering", "layout"].includes(prop),
})<{
  layout: string
  hovering: boolean
}>(({ theme }) => ({
  position: "relative",
  width: "100%",
  margin: "24px 0",
  textAlign: "center",

  ".media-container": {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    overflow: "hidden",

    iframe: {
      width: "100%",
      height: "100%",
      borderRadius: "6px",
      display: "block",
    },
  },

  "&.layout-full .media-container iframe": {
    borderRadius: 0,
  },

  ".media-caption": {
    maxWidth: "900px",
    margin: "8px auto 0",

    input: {
      width: "100%",
      border: "none",
      textAlign: "left",
      outline: "none",
      padding: "16px 0",
      fontSize: "14px",
      borderBottom: "1px solid #dde1e6",
    },

    p: {
      fontSize: "14px",
      color: "#555",
      textAlign: "center",
      fontStyle: "italic",
    },
  },

  ".media-layout-toolbar": {
    position: "absolute",
    top: "-38px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 2000,
    display: "flex",
    background: "rgb(0 0 0 / 85%)",
    padding: "6px 10px",
    borderRadius: "8px",
    gap: "8px",
    width: "150px",
    justifyContent: "center",
    cursor: "pointer",

    "&::after": {
      content: '""',
      position: "absolute",
      top: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      borderLeft: "8px solid transparent",
      borderRight: "8px solid transparent",
      borderTop: "8px solid rgb(0 0 0 / 85%)",
    },

    button: {
      width: "40px",
      height: "28px",
      border: "none",
      borderRadius: "4px",
      background: "transparent",
      color: "white",
      cursor: "pointer",

      "&.active": {
        background: "#9be19b",
        color: "black",
        fontWeight: "bold",
      },
    },
  },

  // Layout sizes
  "&.default": {
    width: "100%",
  },

  "&.wide": {
    width: "90vw",
    marginLeft: "calc(-45vw + 50%)",
  },

  "&.full": {
    width: "100vw",
    marginLeft: "calc(-50vw + 50%)",
  },

  ".svg-icon": {
    fill: "white",
  },

  ".remove-button": {
    opacity: 0,
    pointerEvents: "none",
  },

  "&:hover .remove-button": {
    opacity: 1,
    pointerEvents: "auto",
  },

  ".ProseMirror-selectednode &": {
    "&.layout-default": {
      border: `1px solid ${theme.custom.colors.red}`,
      padding: "8px",
      borderRadius: "10px",
    },
    "&.layout-wide .media-container": {
      border: `1px solid ${theme.custom.colors.red}`,
      padding: "8px",
      borderRadius: "10px",
    },
    "&.layout-full .media-container": {
      border: `1px solid ${theme.custom.colors.red}`,
      padding: "8px 0",
      borderWidth: "1px 0",
    },
  },
}))

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

import React, { useState } from "react"
import styled from "@emotion/styled"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { FullWidth, WideWidth, DefaultWidth } from "./Icons"
import { RiCloseLargeLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import { EditableCaption } from "../shared/EditableCaption"
import { MediaDisplay } from "./MediaDisplay"

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

  "&.layout-default": {
    width: "100%",
  },

  "&.layout-wide": {
    width: "90vw",
    marginLeft: "calc(-45vw + 50%)",
  },

  "&.layout-full": {
    width: "100vw",
    marginLeft: "calc(-50vw + 50%)",
  },

  ".svg-icon": {
    fill: "white",
  },

  ".ProseMirror-selectednode &": {
    "&.layout-default": {
      border: `1px solid ${theme.custom.colors.red}`,
      padding: "8px",
      borderRadius: "10px",
    },
  },
  ".node-mediaEmbed &": {
    cursor: "pointer",
  },
}))

const RemoveButton = styled(ActionButton)({
  position: "absolute",
  top: "-7px",
  right: "-7px",
  zIndex: 2,

  display: "none",
  ".node-mediaEmbed:hover &": {
    display: "flex",
  },
  ".ProseMirror-selectednode:hover &": {
    top: "-12px",
    right: "-14px",
  },
  ".layout-full &, .ProseMirror-selectednode .layout-full &": {
    right: "7px",
  },
})

const MediaLayoutToolbar = styled.div({
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
})

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

  const selectNode = () => {
    if (!editable) return
    const pos = getPos()
    if (typeof pos !== "number") return
    editor.chain().focus().setNodeSelection(pos).run()
  }

  return (
    <StyledNodeViewWrapper
      layout={layout}
      hovering={hovering}
      className={`layout-${layout}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseDown={selectNode}
    >
      {editable && (
        <RemoveButton
          variant="primary"
          edge="circular"
          size="small"
          onClick={handleRemove}
          aria-label="Close"
        >
          <RiCloseLargeLine />
        </RemoveButton>
      )}
      {/* Toolbar — identical to ImageUpload version */}
      {editable && hovering && (
        <MediaLayoutToolbar>
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
        </MediaLayoutToolbar>
      )}

      <MediaDisplay src={src} caption={caption} />

      <EditableCaption
        caption={caption}
        isEditable={editable}
        onCaptionChange={(caption) => updateAttributes({ caption })}
      />
    </StyledNodeViewWrapper>
  )
}

import React, { useRef, useState, useEffect } from "react"
import { NodeViewWrapper } from "@tiptap/react"

import "./style.scss"

interface MediaEmbedNodeProps {
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
}

export const MediaEmbedNodeView = ({
  node,
  updateAttributes,
}: MediaEmbedNodeProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(Number(node.attrs.width) || 400)
  const [height, setHeight] = useState(Number(node.attrs.height) || 300)
  const [hover, setHover] = useState(false)

  const isEditable = node.attrs.editable

  useEffect(() => {
    updateAttributes({ width, height })
  }, [width, height])

  // Resize logic
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const startWidth = useRef(0)
  const startHeight = useRef(0)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX
    startY.current = e.clientY
    startWidth.current = width
    startHeight.current = height

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return
    const deltaX = e.clientX - startX.current
    const deltaY = e.clientY - startY.current
    setWidth(startWidth.current + deltaX)
    setHeight(startHeight.current + deltaY)
  }

  const onMouseUp = () => {
    isResizing.current = false
    document.removeEventListener("mousemove", onMouseMove)
    document.removeEventListener("mouseup", onMouseUp)
  }

  return (
    <NodeViewWrapper
      style={{
        float: node.attrs.float || "none",
        margin: node.attrs.float ? "0 12px 12px 0" : "12px 0",
        // display: "inline-block",
        // position: "relative",
      }}
    >
      <div
        ref={containerRef}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Floating toolbar */}
        {isEditable && hover && (
          <div
            title="Float the media"
            style={{
              position: "absolute",
              top: -10,
              left: -10,
              background: "white",
              border: "1px solid #ccc",
              padding: "4px",
              borderRadius: "8px",
              display: "flex",
              gap: "4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              zIndex: 10,
            }}
          >
            <button
              title="Float Left"
              onClick={() => updateAttributes({ float: "left" })}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid #ddd",
                background: node.attrs.float === "left" ? "#eee" : "white",
                cursor: "pointer",
              }}
            >
              ⬅
            </button>

            <button
              title="Float Right"
              onClick={() => updateAttributes({ float: "right" })}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid #ddd",
                background: node.attrs.float === "right" ? "#eee" : "white",
                cursor: "pointer",
              }}
            >
              ➡
            </button>

            <button
              title="No Float"
              onClick={() => updateAttributes({ float: null })}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid #ddd",
                background: node.attrs.float === null ? "#eee" : "white",
                cursor: "pointer",
              }}
            >
              ⭕
            </button>
          </div>
        )}

        {/* Iframe */}
        <iframe
          src={node.attrs.src}
          width={"100%"}
          height={"100%"}
          style={{ display: "block", borderRadius: "6px" }}
          frameBorder={node.attrs.frameborder}
          allowFullScreen={node.attrs.allowfullscreen === "true"}
        />

        {/* Resize handle */}
        {isEditable && (
          <div
            onMouseDown={onMouseDown}
            title="Drag to resize"
            style={{
              position: "absolute",
              width: 16,
              height: 16,
              bottom: 0,
              right: 0,
              background: "rgba(0,0,0,0.3)",
              cursor: "nwse-resize",
              borderRadius: 4,
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}

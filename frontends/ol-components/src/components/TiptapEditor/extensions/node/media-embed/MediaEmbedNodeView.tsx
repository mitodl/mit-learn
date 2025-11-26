import React, { useRef, useState } from "react"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { FullWidth, WideWidth, DefaultWidth } from "./Icons"

import "./style.scss"

interface MediaEmbedNodeProps {
  node: NodeViewProps["node"]
  updateAttributes: (attrs: Record<string, string>) => void
}

export const MediaEmbedNodeView = ({
  node,
  updateAttributes,
}: MediaEmbedNodeProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)

  const isEditable = node.attrs.editable

  const checkHover = (e: React.MouseEvent) => {
    if (isEditable === false) return
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()

    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom

    setHover(inside)
  }
  return (
    <NodeViewWrapper
      className={`media-embed ${node.attrs.layout}`}
      style={{
        float: node.attrs.float || "none",
      }}
    >
      <div
        ref={containerRef}
        onMouseMove={checkHover}
        onMouseLeave={() => {
          if (!hover) return
          setHover(false)
        }}
        className="media-container"
      >
        <div
          className="iframe-shield"
          style={{ pointerEvents: hover ? "auto" : "none" }}
        />
        {isEditable && hover && (
          <>
            <div className="media-layout-toolbar">
              <button
                className={node.attrs.layout === "default" ? "active" : ""}
                onClick={() => updateAttributes({ layout: "default" })}
                title="Default width"
              >
                <DefaultWidth />
              </button>

              <button
                className={node.attrs.layout === "wide" ? "active" : ""}
                onClick={() => updateAttributes({ layout: "wide" })}
                title="Wide"
              >
                <WideWidth />
              </button>

              <button
                className={node.attrs.layout === "full" ? "active" : ""}
                onClick={() => updateAttributes({ layout: "full" })}
                title="Full width"
              >
                <FullWidth />
              </button>
            </div>
          </>
        )}

        {/* Iframe */}
        <iframe
          src={node.attrs.src}
          width={"100%"}
          height={"100%"}
          style={{ display: "block", borderRadius: "6px" }}
          frameBorder={node.attrs.frameborder}
          allowFullScreen={node.attrs.allowfullscreen === "true"}
          title={node.attrs.caption}
        />
      </div>
      <div className="media-caption">
        {isEditable ? (
          <input
            type="text"
            placeholder="Add caption…"
            value={node.attrs.caption || ""}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
        ) : (
          node.attrs.caption && <p>{node.attrs.caption}</p>
        )}
      </div>
    </NodeViewWrapper>
  )
}

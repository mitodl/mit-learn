import React, { useRef, useState, useEffect } from "react"
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react"

interface MediaEmbedNodeProps {
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
}

export const MediaEmbedNodeView = ({
  node,
  updateAttributes,
}: MediaEmbedNodeProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [width, setWidth] = useState(node.attrs.width || 400)
  const [height, setHeight] = useState(node.attrs.height || 300)

  // Whenever width/height change, update node attributes
  useEffect(() => {
    updateAttributes({ width, height })
  }, [width, height, updateAttributes])

  return (
    <NodeViewWrapper className="media-embed-node">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          margin: "8px 0",
        }}
      >
        <iframe
          ref={iframeRef}
          src={node.attrs.src}
          width={width}
          height={height}
          frameBorder={node.attrs.frameborder}
          allowFullScreen={node.attrs.allowfullscreen === "true"}
        />
        <div style={{ marginTop: 4 }}>
          <label>
            Width:{" "}
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: 60 }}
            />
          </label>
          <label style={{ marginLeft: 8 }}>
            Height:{" "}
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              style={{ width: 60 }}
            />
          </label>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

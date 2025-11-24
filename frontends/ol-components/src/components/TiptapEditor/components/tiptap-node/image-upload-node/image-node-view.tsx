// image-node-view.tsx
import React, { useState } from "react"
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react"
import NiceModal from "@ebay/nice-modal-react"
import ImageAltTextInput from "./ImageAltTextInput"
import "./style.scss"
import { DefaultWidth, WideWidth, FullWidth } from "../media-embed/Icons"

interface MediaEmbedNodeProps {
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
}
export function ImageUploadNodeComponent({
  node,
  updateAttributes,
}: MediaEmbedNodeProps) {
  const { layout, caption, src, alt } = node.attrs
  const [hovering, setHovering] = useState(false)

  const isEditable = node.attrs.editable

  const openAltTextDialog = async () => {
    try {
      const result = await NiceModal.show(ImageAltTextInput, {
        initialAlt: alt ?? "",
      })
      if (result) updateAttributes({ alt: result })
    } catch (e) {
      await NiceModal.hide(ImageAltTextInput)
    }
  }
  return (
    <NodeViewWrapper
      className={`image-upload-node layout-${layout}`}
      data-type="image-upload"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {isEditable && hovering && (
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

            <button
              onClick={openAltTextDialog}
              title="Edit Alt Text"
              className="alt-text-button"
            >
              Alt Text
            </button>
          </div>
        </>
      )}

      <img
        src={src}
        alt={alt || caption || "Image"}
        className="image-content"
      />

      {/* Editable Caption */}

      {isEditable ? (
        <input
          type="text"
          className="caption-input"
          placeholder="Add caption…"
          value={node.attrs.caption || ""}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
      ) : (
        node.attrs.caption && <p>{node.attrs.caption}</p>
      )}
    </NodeViewWrapper>
  )
}

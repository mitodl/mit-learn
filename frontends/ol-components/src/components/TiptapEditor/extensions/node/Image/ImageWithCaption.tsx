import React, { useRef, useEffect, useState } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import NiceModal from "@ebay/nice-modal-react"
import ImageAltTextInput from "./ImageAltTextInput"
import { DefaultWidth, WideWidth, FullWidth } from "./Icons"

const ARTICLE_MAX_WIDTH = 890
const CONTAINER_PADDING = 24

const Container = styled.div({
  position: "relative",
  margin: "2rem auto",
  textAlign: "center",
  width: "100%",

  img: {
    width: "100%",
    height: "auto",
    borderRadius: "6px",
    display: "block",
  },

  "&.layout-default img": {
    width: "100%",
  },

  [`@media (min-width: ${ARTICLE_MAX_WIDTH + CONTAINER_PADDING * 2}px)`]: {
    "&.layout-wide img": {
      width: "90vw",
      maxWidth: "90vw",
      position: "relative",
      left: "50%",
      right: "50%",
      marginLeft: "-45vw",
      marginRight: "-45vw",
    },
  },

  "&.layout-full img": {
    width: "100vw",
    maxWidth: "100vw",
    position: "relative",
    left: "50%",
    right: "50%",
    marginLeft: "-50vw",
    marginRight: "-50vw",
  },

  ".caption-input": {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "14px",
    padding: "0",
  },

  ".media-layout-toolbar": {
    display: "none",
    position: "absolute",
    top: "-34px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2000",
    backgroundColor: "rgb(0 0 0 / 85%)",
    padding: "6px 10px",
    borderRadius: "8px",
    gap: "8px",
    justifyContent: "center",

    "&::after": {
      content: '""',
      position: "absolute",
      top: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      width: 0,
      height: 0,
      borderLeft: "8px solid transparent",
      borderRight: "8px solid transparent",
      borderTop: "8px solid rgb(0 0 0 / 85%)",
    },

    button: {
      width: "40px",
      height: "28px",
      borderRadius: "4px",
      border: "none",
      background: "transparent",
      filter: "brightness(0.9)",
      color: "white",
      cursor: "pointer",

      "&.active": {
        background: "#9be19b",
        color: "black",
        fontWeight: "bold",
      },
    },

    ".alt-text-button": {
      color: "white",
      fontSize: "12px",
      borderRadius: "4px",
      padding: "2px 6px",
      width: "100px",
    },
  },

  "&:hover": {
    ".media-layout-toolbar": {
      display: "flex",
    },
  },

  ".svg-icon": {
    fill: "white",
  },
  ".media-toolbar-wide": {
    width: "250px",
  },
  ".media-toolbar-default": {
    width: "150px",
  },

  ".img-contained": {
    width: "auto !important",
    margin: "0 auto",
  },
})

enum Layout {
  default = "default",
  wide = "wide",
  full = "full",
}

const Image = styled.img<{ layout: Layout }>(({ layout }) => ({
  "&&": {
    borderRadius: layout === Layout.full ? 0 : "8px",
  },
}))

const Caption = styled.p(({ theme }) => ({
  "&&&&&": {
    ...theme.typography.body2,
    color: theme.custom.colors.silverGrayDark,
    padding: "16px 0",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    textAlign: "left",
    marginTop: 0,
  },
}))

export function ImageWithCaption({
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [canExpand, setCanExpand] = useState(true)

  const { layout, caption, src, alt } = node.attrs

  const isEditable = node.attrs.editable

  useEffect(() => {
    if (!imgRef.current || !containerRef.current) return

    const img = imgRef.current
    const container = containerRef.current

    const checkSize = () => {
      const containerWidth = container.offsetWidth
      const imageNaturalWidth = img.naturalWidth

      // If the image can't expand beyond the container, disable wide/full
      setCanExpand(imageNaturalWidth > containerWidth)
    }

    // when image loads
    if (img.complete) {
      checkSize()
    } else {
      img.onload = checkSize
    }

    window.addEventListener("resize", checkSize)
    return () => window.removeEventListener("resize", checkSize)
  }, [src])

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
    <NodeViewWrapper data-type="image-upload" ref={containerRef}>
      <Container className={`layout-${layout}`}>
        {isEditable && (
          <div
            className={`media-layout-toolbar ${canExpand ? "media-toolbar-wide" : "media-toolbar-default"}`}
          >
            <button
              className={layout === "default" ? "active" : ""}
              onClick={() => updateAttributes({ layout: "default" })}
              title="Default width"
            >
              <DefaultWidth />
            </button>
            {canExpand && (
              <>
                {" "}
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
              </>
            )}
            <button
              onClick={openAltTextDialog}
              title="Edit Alt Text"
              className="alt-text-button"
            >
              Alt Text
            </button>
          </div>
        )}

        <Image
          src={src}
          alt={alt || caption}
          layout={layout}
          ref={imgRef}
          className={`${!canExpand ? "img-contained" : ""}`}
        />
        {isEditable ? (
          <Caption>
            <input
              type="text"
              className="caption-input"
              placeholder="Add caption…"
              value={caption || ""}
              onChange={(e) => updateAttributes({ caption: e.target.value })}
            />
          </Caption>
        ) : (
          caption && <Caption>{caption}</Caption>
        )}
      </Container>
    </NodeViewWrapper>
  )
}

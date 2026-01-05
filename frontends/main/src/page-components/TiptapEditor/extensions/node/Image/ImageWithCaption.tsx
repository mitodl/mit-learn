import React, { useRef, useEffect, useState } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import NiceModal from "@ebay/nice-modal-react"
import { LoadingSpinner } from "ol-components"
import ImageAltTextInput from "./ImageAltTextInput"
import { DefaultWidth, WideWidth, FullWidth } from "./Icons"

const ARTICLE_MAX_WIDTH = 890
const CONTAINER_PADDING = 24
const WIDE_LAYOUT_MIN_IMG_WIDTH = 900

const Container = styled.div(({ theme }) => ({
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
    width: "auto",
    margin: "0 auto",
  },

  ".image-wrapper": {
    position: "relative",
    margin: "0 auto",
    maxWidth: "100%",
  },

  "&.layout-default .image-wrapper": {
    width: "auto",
    display: "inline-block",
  },

  [`@media (min-width: ${ARTICLE_MAX_WIDTH + CONTAINER_PADDING * 2}px)`]: {
    "&.layout-wide img": {
      width: "92vw",
      maxWidth: "1400px",
      position: "relative",
      left: "50%",
      transform: "translateX(-50%)",
    },

    "&.layout-wide .image-wrapper": {
      width: "92vw",
      maxWidth: "1400px",
      position: "relative",
      left: "50%",
      transform: "translateX(-50%)",
    },
  },
  "&.layout-full .image-wrapper": {
    width: "100vw",
    maxWidth: "100vw",
    position: "relative",
    left: "50%",
    transform: "translateX(-50%)",
  },

  "&.layout-full img": {
    width: "100vw",
    maxWidth: "100vw",
    position: "relative",
    left: "50%",
    right: "50%",
    transform: "translateX(-50%)",
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
    width: "250px",
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
      color: theme.custom.colors.white,
      cursor: "pointer",
      "&:hover": {
        background: theme.custom.colors.darkGray1,
      },

      "&.active": {
        background: "#9be19b",
        color: theme.custom.colors.black,
        fontWeight: "bold",
        cursor: "default",
        svg: {
          fill: theme.custom.colors.black,
        },
      },

      svg: {
        fill: theme.custom.colors.white,
      },
    },

    ".alt-text-button": {
      color: theme.custom.colors.white,
      fontSize: "14px",
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
}))

const Spinner = styled(LoadingSpinner)({
  margin: "auto",
  position: "absolute",
  top: "40%",
  left: "50%",
  transform: "translate(-50%, -50%)",
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
  "& .remove-button": {
    opacity: 0,
    pointerEvents: "none",
  },

  "&:hover .remove-button": {
    opacity: 1,
    pointerEvents: "auto",
  },
}))

const ImageWrapper = styled("div")({
  position: "relative",

  "& .remove-button": {
    opacity: 0,
    pointerEvents: "none",
  },

  "&:hover .remove-button": {
    opacity: 1,
    pointerEvents: "auto",
  },
})

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

const RemoveButton = styled("button")(({ theme }) => ({
  position: "absolute",
  top: -7,
  right: -7,
  zIndex: 999999,

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

export function ImageWithCaption({
  node,
  editor,
  getPos,
  updateAttributes,
}: ReactNodeViewProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [canExpand, setCanExpand] = useState(false)

  const [isLoading, setIsLoading] = useState(true)

  const { layout, caption, src, alt } = node.attrs
  const isEditable = node.attrs.editable

  useEffect(() => {
    if (!imgRef.current || !isEditable) return
    const img = imgRef.current

    const checkSize = () => {
      const imageNaturalWidth = img.naturalWidth
      setCanExpand(imageNaturalWidth > WIDE_LAYOUT_MIN_IMG_WIDTH)
    }

    // when image loads
    if (img.complete) {
      checkSize()
    } else {
      img.onload = checkSize
    }
  }, [src, isEditable, updateAttributes])

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

  const handleRemove = () => {
    const pos = getPos()
    if (typeof pos !== "number") return

    editor.chain().focus().setNodeSelection(pos).deleteSelection().run()
  }

  return (
    <NodeViewWrapper data-type="image-upload">
      {isLoading && <Spinner color="inherit" loading size={32} />}
      <Container className={`layout-${layout}`}>
        {isEditable && (
          <div className="media-layout-toolbar">
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
              title="Set Alt Text"
              className="alt-text-button"
            >
              Set Alt Text
            </button>
          </div>
        )}

        <ImageWrapper className="image-wrapper">
          {isEditable && (
            <RemoveButton
              type="button"
              aria-label="Remove course card"
              onClick={handleRemove}
              className="remove-button"
            >
              ×
            </RemoveButton>
          )}
          <Image
            src={src}
            alt={alt || ""}
            layout={layout}
            ref={imgRef}
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        </ImageWrapper>
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

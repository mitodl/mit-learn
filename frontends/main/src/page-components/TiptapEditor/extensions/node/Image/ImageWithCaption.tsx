import React, { useRef, useEffect, useState } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import NiceModal from "@ebay/nice-modal-react"
import ImageAltTextInput from "./ImageAltTextInput"
import { DefaultWidth, WideWidth, FullWidth } from "./Icons"
import { RiCloseLargeLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import { EditableCaption } from "../shared/EditableCaption"

const ARTICLE_MAX_WIDTH = 890
const CONTAINER_PADDING = 24
const WIDE_LAYOUT_MIN_IMG_WIDTH = 900

const Container = styled.figure(({ theme }) => ({
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

    ".ProseMirror-selectednode &.layout-wide .image-wrapper": {
      border: `1px solid ${theme.custom.colors.red}`,
      padding: "8px",
      borderRadius: "8px",
      img: {
        width: "calc(92vw - 16px)",
        maxWidth: "calc(1400px - 16px)",
      },
    },
  },
  "&.layout-full .image-wrapper": {
    width: "100vw",
    maxWidth: "100vw",
    position: "relative",
    left: "50%",
    transform: "translateX(-50%)",
  },

  ".ProseMirror-selectednode &.layout-full .image-wrapper": {
    border: `1px solid ${theme.custom.colors.red}`,
    borderWidth: "1px 0",
    padding: "8px",
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

  ".ProseMirror-selectednode &.layout-default": {
    border: `1px solid ${theme.custom.colors.red}`,
    padding: "8px",
    borderRadius: "10px",
  },

  ".node-imageWithCaption &": {
    cursor: "pointer",
  },
}))

enum Layout {
  default = "default",
  wide = "wide",
  full = "full",
}

const Image = styled.img<{ layout: Layout; isLoading?: boolean }>(
  ({ layout, isLoading }) => ({
    "&&": {
      borderRadius: layout === Layout.full ? 0 : "8px",
      opacity: isLoading ? 0 : 1,
      transition: "opacity 0.3s ease-in-out",
    },
  }),
)

const ImagePlaceholder = styled.div<{ layout: Layout }>(
  ({ layout, theme }) => ({
    width: "100%",
    aspectRatio: "16 / 9",
    backgroundColor: theme.custom.colors.lightGray1,
    borderRadius: layout === Layout.full ? 0 : "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...(layout === Layout.wide && {
      [`@media (min-width: ${ARTICLE_MAX_WIDTH + CONTAINER_PADDING * 2}px)`]: {
        width: "92vw",
        maxWidth: "1400px",
        position: "relative",
        left: "50%",
        transform: "translateX(-50%)",
      },
    }),
    ...(layout === Layout.full && {
      width: "100vw",
      maxWidth: "100vw",
      position: "relative",
      left: "50%",
      right: "50%",
      transform: "translateX(-50%)",
    }),
    ".ProseMirror-selectednode &": {
      ...(layout === Layout.wide && {
        margin: 0,
        width: "calc(92vw - 16px)",
        maxWidth: "calc(1400px  - 16px)",
      }),
      ...(layout === Layout.full && {
        margin: 0,
      }),
    },
  }),
)

const ImageWrapper = styled("div")({
  position: "relative",
})

const Caption = styled.figcaption(({ theme }) => ({
  "&&&&&": {
    ...theme.typography.body2,
    color: theme.custom.colors.silverGrayDark,
    padding: "16px 0",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    textAlign: "left",
    marginTop: 0,
  },
  ".ProseMirror-selectednode .layout-default&&&&&": {
    border: "none",
  },
}))

export function ImageWithCaptionViewer({
  node,
}: {
  node: {
    attrs: { layout?: Layout; caption?: string; src?: string; alt?: string }
  }
}) {
  const { layout = Layout.default, caption, src, alt } = node.attrs
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  return (
    <Container className={`layout-${layout}`}>
      <div style={{ position: "relative", width: "100%" }}>
        {hasError ? (
          <ImagePlaceholder layout={layout}>
            <span style={{ color: "inherit", fontSize: "14px" }}>
              Failed to load image
            </span>
          </ImagePlaceholder>
        ) : (
          <>
            {isLoading && (
              <ImagePlaceholder layout={layout} aria-label="Loading image" />
            )}
            <Image
              src={src}
              alt={alt}
              layout={layout}
              isLoading={isLoading}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false)
                setHasError(true)
              }}
            />
          </>
        )}
      </div>
      {caption && <Caption>{caption}</Caption>}
    </Container>
  )
}
const RemoveButton = styled(ActionButton)({
  position: "absolute",
  top: "-4px",
  right: "-6px",
  zIndex: 2,
  display: "none",
  ".node-imageWithCaption:hover &": {
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

  const selectNode = () => {
    if (!isEditable) return
    const pos = getPos()
    if (typeof pos !== "number") return
    editor.chain().focus().setNodeSelection(pos).run()
  }

  return (
    <NodeViewWrapper data-type="image-upload" onMouseDown={selectNode}>
      <Container className={`layout-${layout}`}>
        {isEditable && (
          <div className="media-layout-toolbar">
            <button
              className={layout === "default" ? "active" : ""}
              onClick={() => {
                updateAttributes({ layout: "default" })
              }}
              title="Default width"
            >
              <DefaultWidth />
            </button>
            {canExpand && (
              <>
                <button
                  className={layout === "wide" ? "active" : ""}
                  onClick={() => {
                    updateAttributes({ layout: "wide" })
                  }}
                  title="Wide"
                >
                  <WideWidth />
                </button>
                <button
                  className={layout === "full" ? "active" : ""}
                  onClick={() => {
                    updateAttributes({ layout: "full" })
                  }}
                  title="Full width"
                >
                  <FullWidth />
                </button>
              </>
            )}
            <button
              onClick={() => {
                openAltTextDialog()
              }}
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
              variant="primary"
              edge="circular"
              size="small"
              onClick={handleRemove}
              aria-label="Remove"
            >
              <RiCloseLargeLine />
            </RemoveButton>
          )}
          {isLoading && (
            <ImagePlaceholder layout={layout} aria-label="Loading image" />
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
        <EditableCaption
          caption={caption}
          isEditable={isEditable}
          onCaptionChange={(caption) => updateAttributes({ caption })}
        />
      </Container>
    </NodeViewWrapper>
  )
}

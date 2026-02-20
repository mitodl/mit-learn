"use client"

// Based on the TipTap base Simple Editor file, https://tiptap.dev/docs/ui-components/templates/simple-editor.
// https://github.com/ueberdosis/tiptap-ui-components/blob/799929bea4804c73767562b69f8acc2acdb8ac86/apps/web/src/components/tiptap-templates/simple/simple-editor.tsx

import React from "react"
import styled from "@emotion/styled"
import { EditorContent } from "@tiptap/react"
import type { Editor, Extension, JSONContent, Node, Mark } from "@tiptap/core"
import { renderToReactElement } from "@tiptap/static-renderer/pm/react"
import { ImageUploadButton } from "./vendor/components/tiptap-ui/image-upload-button"
import { MediaEmbedButton } from "./extensions/ui/MediaEmbed/MediaEmbedButton"
import { pxToRem } from "ol-components"

import { Spacer } from "./vendor/components/tiptap-ui-primitive/spacer"
import {
  ToolbarGroup,
  ToolbarSeparator,
} from "./vendor/components/tiptap-ui-primitive/toolbar"

import "./vendor/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "./vendor/components/tiptap-node/code-block-node/code-block-node.scss"
import "./vendor/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "./vendor/components/tiptap-node/list-node/list-node.scss"
import "./vendor/components/tiptap-node/heading-node/heading-node.scss"
import "./vendor/components/tiptap-node/paragraph-node/paragraph-node.scss"

import { HeadingDropdownMenu } from "./vendor/components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "./vendor/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "./vendor/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "./vendor/components/tiptap-ui/code-block-button"
import { LinkPopover } from "./vendor/components/tiptap-ui/link-popover"
import { MarkButton } from "./vendor/components/tiptap-ui/mark-button"
import { TextAlignButton } from "./vendor/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "./vendor/components/tiptap-ui/undo-redo-button"
import { Button } from "./vendor/components/tiptap-ui-primitive/button"
import { DividerButton } from "./extensions/ui/Divider/DividerButton"
import { RiArrowDropDownFill } from "@remixicon/react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./vendor/components/tiptap-ui-primitive/dropdown-menu"

import "./vendor/styles/_keyframe-animations.scss"
import "./vendor/styles/_variables.scss"
import "./vendor/components/tiptap-templates/simple/simple-editor.scss"

import "./TiptapEditor.styles.scss"
import { BannerViewer } from "./extensions/node/Banner/BannerNode"
import { ArticleByLineInfoBarViewer } from "./extensions/node/ArticleByLineInfoBar/ArticleByLineInfoBarViewer"
import { ImageWithCaptionViewer } from "./extensions/node/Image/ImageWithCaption"
import { DividerViewer } from "./extensions/node/Divider/DividerNode"
import { LearningResourceButton } from "./extensions/ui/LearningResource/LearningResourceButton"
import { LearningResourceCardViewer } from "./extensions/node/LearningResource/LearningResourceNode"
import { MediaEmbedViewer } from "./extensions/node/MediaEmbed/MediaEmbedViewer"

const Container = styled.div<{
  readOnly: boolean
}>(({ theme, readOnly }) => ({
  maxWidth: "890px",
  minHeight: "calc(100vh - 350px)",
  backgroundColor: theme.custom.colors.white,
  borderRadius: "10px",
  margin: "0 auto",

  ".tiptap.ProseMirror.simple-editor, .tiptap-viewer": {
    padding: "0 24px",
  },
  ...(readOnly
    ? {
        backgroundColor: "transparent",
        ".tiptap.ProseMirror.simple-editor": {
          padding: "0 24px",
          [theme.breakpoints.down("sm")]: {
            padding: "0 16px",
          },
        },
      }
    : {}),
  "&& .tiptap.ProseMirror, && .tiptap-viewer": {
    fontFamily: theme.typography.fontFamily,
    color: theme.custom.colors.darkGray2,
    paddingBottom: "80px",
    h1: {
      ...theme.typography.h1,
    },
    h2: {
      ...theme.typography.h2,
    },
    h3: {
      ...theme.typography.h3,
    },
    h4: {
      ...theme.typography.h4,
    },
    h5: {
      ...theme.typography.h5,
    },
    "h1, h2, h3, h4, h5, h6": {
      marginTop: "40px",
      marginBottom: "40px",
    },
    p: {
      ...theme.typography.body1,
      fontSize: pxToRem(18),
      lineHeight: pxToRem(32),
      marginBottom: "40px",
    },
    a: {
      color: theme.custom.colors.darkGray2,
    },
    ul: {
      ...theme.typography.body1,
    },
    ol: {
      ...theme.typography.body1,
    },
    li: {
      ...theme.typography.body1,
      lineHeight: pxToRem(54),
      p: {
        marginBottom: 0,
      },
    },
    blockquote: {
      backgroundColor: theme.custom.colors.lightGray1,
      padding: "40px",
      borderRadius: "8px",
      marginBottom: "40px",
      borderLeft: `2px solid ${theme.custom.colors.red}`,
      "::before": {
        content: '"“"', // opening inverted comma
        position: "absolute",
        left: "17px",
        fontSize: "64px",
        lineHeight: 1,
        fontWeight: theme.typography.fontWeightRegular,
        top: "-15px",
        color: theme.custom.colors.red,
        fontFamily: theme.typography.fontFamily,
        background: "none",
      },
      p: {
        position: "relative",
      },
      "p:last-child": {
        marginBottom: 0,
      },
    },
  },
}))

const Toolbar = styled.div({
  display: "contents",
  button: {
    cursor: "pointer",
    borderRadius: "6px",
  },
  ".tiptap-card": {
    borderRadius: "8px",
  },
})

const StyledDropdownMenu = styled(DropdownMenuContent)`
  &.tiptap-dropdown-menu {
    background-color: #e1e3ed;
    border-radius: 8px;
    padding: 4px;
  }

  .tiptap-button {
    width: 100%;
  }
`

interface TiptapEditorToolbarProps {
  editor: Editor
}

export function InsertDropdownMenu({ editor }: TiptapEditorToolbarProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          Insert <RiArrowDropDownFill />
        </Button>
      </DropdownMenuTrigger>

      <StyledDropdownMenu side="bottom" align="start">
        <DropdownMenuItem asChild>
          <ImageUploadButton text="Image" />
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <MediaEmbedButton editor={editor} text="Video" />
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <LearningResourceButton editor={editor} text="Course Card" />
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <DividerButton editor={editor} text="Divider" />
        </DropdownMenuItem>
      </StyledDropdownMenu>
    </DropdownMenu>
  )
}
export const MainToolbarContent = ({ editor }: TiptapEditorToolbarProps) => {
  return (
    <Toolbar>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[2, 3, 4]} />
        <ListDropdownMenu types={["bulletList", "orderedList", "taskList"]} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        <LinkPopover />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarGroup>
        <InsertDropdownMenu editor={editor} />
      </ToolbarGroup>

      <Spacer />
    </Toolbar>
  )
}

interface TiptapEditorProps {
  editor: Editor
  readOnly?: boolean
  fullWidth?: boolean
  className?: string
}

const TiptapEditor = ({ editor, className }: TiptapEditorProps) => {
  return (
    <Container readOnly={false} data-testid="editor">
      <EditorContent
        editor={editor}
        role="presentation"
        className={className}
      />
    </Container>
  )
}

const TipTapViewer = ({
  content,
  extensions,
}: {
  content: JSONContent
  extensions: Array<Extension | Node | Mark>
}) => {
  return (
    <Container readOnly data-testid="editor">
      <div className="tiptap ProseMirror tiptap-viewer">
        {renderToReactElement({
          extensions,
          content,
          options: {
            /*
             * Node mappings are required for custom nodes that use ReactNodeViewRenderer.
             * Without these mappings, the static renderer would fall back to renderHTML() output,
             * which would produce unstyled HTML elements (e.g., <banner>, <byline>) instead of
             * the styled React components. Mappings are NOT needed for nodes that only use renderHTML()
             * with standard HTML tags that are styled from wrapping components.
             * See https://tiptap.dev/docs/editor/api/utilities/static-renderer#react-nodeviews
             */
            nodeMapping: {
              banner: BannerViewer,
              byline: ArticleByLineInfoBarViewer,
              divider: DividerViewer,
              imageWithCaption: ImageWithCaptionViewer,
              learningResource: LearningResourceCardViewer,
              mediaEmbed: MediaEmbedViewer,
            },
          },
        })}
      </div>
    </Container>
  )
}

export { TiptapEditor, TipTapViewer }

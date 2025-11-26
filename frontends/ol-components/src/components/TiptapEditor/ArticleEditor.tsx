"use client"

// Based on ./components/tiptap-templates/simple/simple-editor.tsx

import React, { ChangeEventHandler, useState } from "react"
import styled from "@emotion/styled"
import { EditorContext, JSONContent, useEditor } from "@tiptap/react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"

import { Image } from "@tiptap/extension-image"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography as TiptapTypography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"

import { Selection } from "@tiptap/extensions"

// --- UI Primitives ---
import { Toolbar } from "./vendor/components/tiptap-ui-primitive/toolbar"
import { Spacer } from "./vendor/components/tiptap-ui-primitive/spacer"

import TiptapEditor, { MainToolbarContent } from "./TiptapEditor"

// --- Tiptap Node ---
import { ImageUploadNode } from "./extensions/node/image-upload-node/image-upload-node-extension"
import { MediaEmbed } from "./extensions/node/media-embed/media-embed-extension"
import { HorizontalRule } from "./vendor/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"

import "./vendor/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "./vendor/components/tiptap-node/code-block-node/code-block-node.scss"
import "./vendor/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "./vendor/components/tiptap-node/list-node/list-node.scss"
import "./vendor/components/tiptap-node/image-node/image-node.scss"
import "./vendor/components/tiptap-node/heading-node/heading-node.scss"
import "./vendor/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "./vendor/lib/tiptap-utils"

// --- Styles ---
import "./vendor/styles/_keyframe-animations.scss"
import "./vendor/styles/_variables.scss"
import "./vendor/components/tiptap-templates/simple/simple-editor.scss"

import { useArticleCreate, useArticlePartialUpdate } from "api/hooks/articles"
import type { RichTextArticle } from "api/v1"
import { Alert, Button, ButtonLink, Input } from "@mitodl/smoot-design"
import Typography, { TypographyProps } from "@mui/material/Typography"
import Container from "@mui/material/Container"
import { useUserHasPermission, Permission } from "api/hooks/user"

const ViewContainer = styled.div({
  width: "100vw",
  height: "calc(100vh - 204px)",
  overflow: "scroll",
})

const Title = styled(Typography)<TypographyProps>({
  margin: "60px auto",
  maxWidth: "1000px",
})

const TitleInput = styled(Input)({
  width: "100%",
  maxWidth: "1000px",
  margin: "10px auto",
  display: "block-flex",
})

const StyledToolbar = styled(Toolbar)({
  "&&": {
    position: "fixed",
    top: "72px",
  },
})

const StyledContainer = styled(Container)({
  marginTop: "60px",
})

const StyledAlert = styled(Alert)({
  margin: "0 auto 20px",
  maxWidth: "1000px",
})

interface ArticleEditorProps {
  value?: object
  onSave?: (article: RichTextArticle) => void
  readOnly?: boolean
  title?: string
  setTitle?: ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>
  article?: RichTextArticle
}
const ArticleEditor = ({ onSave, readOnly, article }: ArticleEditorProps) => {
  const [title, setTitle] = React.useState(article?.title || "")
  const {
    mutate: createArticle,
    isPending: isCreating,
    isError: isCreateError,
    error: createError,
  } = useArticleCreate()
  const {
    mutate: updateArticle,
    isPending: isUpdating,
    isError: isUpdateError,
    error: updateError,
  } = useArticlePartialUpdate()
  const isArticleEditor = useUserHasPermission(Permission.ArticleEditor)

  const [content, setContent] = useState<JSONContent>(
    article?.content || {
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    },
  )
  const [touched, setTouched] = useState(false)

  const handleSave = () => {
    if (article) {
      updateArticle(
        {
          id: article.id,
          title: title.trim(),
          content,
        },
        {
          onSuccess: onSave,
        },
      )
    } else {
      createArticle(
        {
          title: title.trim(),
          content,
        },
        {
          onSuccess: onSave,
        },
      )
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      setTouched(true)
      setContent(json)
    },
    onCreate: ({ editor }) => {
      editor.commands.updateAttributes("mediaEmbed", {
        editable: !readOnly,
      })
    },
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      TiptapTypography,
      Superscript,
      Subscript,
      Selection,
      Image,
      MediaEmbed,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
  })

  React.useEffect(() => {
    if (!editor) return

    editor
      .chain()
      .command(({ tr, state }) => {
        state.doc.descendants((node, pos) => {
          if (node.type.name === "mediaEmbed") {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              editable: !readOnly,
            })
          }
        })
        return true
      })
      .run()
  }, [editor, readOnly])

  if (!editor) return null

  const isPending = isCreating || isUpdating
  const isError = isCreateError || isUpdateError
  const error = createError || updateError

  return (
    <ViewContainer data-testid="editor">
      <EditorContext.Provider value={{ editor }}>
        {isArticleEditor ? (
          readOnly ? (
            <StyledToolbar>
              <Spacer />
              <ButtonLink
                variant="primary"
                href={`/articles/${article?.id}/edit`}
                size="small"
              >
                Edit
              </ButtonLink>
            </StyledToolbar>
          ) : (
            <StyledToolbar>
              <MainToolbarContent editor={editor} />
              <Button
                variant="primary"
                disabled={isPending || !title.trim() || !touched}
                onClick={handleSave}
                size="small"
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </StyledToolbar>
          )
        ) : null}
        <StyledContainer>
          {isError && (
            <StyledAlert severity="error" closable>
              <Typography variant="body2" color="textPrimary">
                {error?.message ?? "An error occurred while saving"}
              </Typography>
            </StyledAlert>
          )}
          {readOnly ? (
            <Title variant="h3" component="h1">
              {article?.title}
            </Title>
          ) : (
            <TitleInput
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setTouched(true)
              }}
              placeholder="Article title"
              className="input-field"
            />
          )}
          <TiptapEditor editor={editor} readOnly={readOnly} />
        </StyledContainer>
      </EditorContext.Provider>
    </ViewContainer>
  )
}

export { ArticleEditor }

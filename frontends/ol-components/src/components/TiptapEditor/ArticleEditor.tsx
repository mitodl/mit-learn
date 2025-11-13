"use client"

// Based on ./components/tiptap-templates/simple/simple-editor.tsx

import React, { useEffect, ChangeEventHandler, useState } from "react"
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
import { Toolbar } from "./components/tiptap-ui-primitive/toolbar"

import TiptapEditor, { MainToolbarContent } from "./TiptapEditor"

// --- Tiptap Node ---
import { ImageUploadNode } from "./components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "./components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"

import "./components/tiptap-node/blockquote-node/blockquote-node.scss"
import "./components/tiptap-node/code-block-node/code-block-node.scss"
import "./components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "./components/tiptap-node/list-node/list-node.scss"
import "./components/tiptap-node/image-node/image-node.scss"
import "./components/tiptap-node/heading-node/heading-node.scss"
import "./components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "./lib/tiptap-utils"

// --- Styles ---
import "./styles/_keyframe-animations.scss"
import "./styles/_variables.scss"
import "./components/tiptap-templates/simple/simple-editor.scss"

import { useArticleCreate, useArticlePartialUpdate } from "api/hooks/articles"
import type { RichTextArticle } from "api/v1"
import { Alert, Button, Input } from "@mitodl/smoot-design"
import Typography from "@mui/material/Typography"
import Container from "@mui/material/Container"

const ViewContainer = styled.div({
  width: "100vw",
  height: "calc(100vh - 204px)",
  overflow: "scroll",
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

interface ArticleEditorProps {
  value?: object
  onSave?: (article: RichTextArticle) => void
  readOnly?: boolean
  title?: string
  setTitle?: ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>
  article?: RichTextArticle
}
const ArticleEditor = ({
  value,
  onSave,
  readOnly,
  article,
}: ArticleEditorProps) => {
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

  const [json, setJson] = useState<JSONContent>({
    type: "doc",
    content: article?.content
      ? JSON.parse(article.content)
      : [{ type: "paragraph", content: [] }],
  })
  const [touched, setTouched] = useState(false)

  const handleSave = () => {
    if (article) {
      updateArticle({
        id: article.id,
        title: title.trim(),
        content: json,
      })
    } else {
      createArticle(
        {
          title: title.trim(),
          content: json,
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
    content: value || {
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    },
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      setTouched(true)
      setJson(json)
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
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
  })

  useEffect(() => {
    if (editor && value) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  if (!editor) return null

  const isPending = isCreating || isUpdating
  const isError = isCreateError || isUpdateError
  const error = createError || updateError

  return (
    <ViewContainer data-testid="editor">
      <EditorContext.Provider value={{ editor }}>
        {!readOnly && (
          <StyledToolbar>
            <MainToolbarContent />
            <Button
              variant="primary"
              disabled={isPending || !title.trim() || !touched}
              onClick={handleSave}
              size="small"
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
          </StyledToolbar>
        )}
        <StyledContainer>
          {isError && (
            <Alert severity="error" closable>
              <Typography variant="body2" color="textPrimary">
                {error?.message ?? "An error occurred while saving"}
              </Typography>
            </Alert>
          )}
          {!readOnly && (
            <TitleInput
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
              className="input-field"
            />
          )}

          <TiptapEditor editor={editor} />
        </StyledContainer>
      </EditorContext.Provider>
    </ViewContainer>
  )
}

export { ArticleEditor }

"use client"

// Based on ./components/tiptap-templates/simple/simple-editor.tsx

import React, { ChangeEventHandler, useState } from "react"
import styled from "@emotion/styled"
import { EditorContext, JSONContent, useEditor } from "@tiptap/react"
import Document from "@tiptap/extension-document"
import { Placeholder, Selection } from "@tiptap/extensions"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"

import { Image } from "@tiptap/extension-image"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography as TiptapTypography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"

// --- UI Primitives ---
import { Toolbar } from "./vendor/components/tiptap-ui-primitive/toolbar"
import { Spacer } from "./vendor/components/tiptap-ui-primitive/spacer"

import TiptapEditor, { MainToolbarContent } from "./TiptapEditor"

// --- Tiptap Node ---
import { DividerNode } from "./extensions/node/divider-node-extension/divider-node-extension"
import { BylineNode } from "./extensions/node/byline/byline-node-extension"

import { ImageUploadNode } from "./extensions/node/image-upload-node/image-upload-node-extension"
import { LearningResourceNode } from "./extensions/node/learning-resource-node/learning-resource-node"
import { MediaEmbed } from "./extensions/node/media-embed/media-embed-extension"
import { HorizontalRule } from "./vendor/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { ImageWithCaption } from "./extensions/node/image-upload-node/image-with-caption"

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

import {
  useArticleCreate,
  useArticlePartialUpdate,
  useMediaUpload,
} from "api/hooks/articles"
import type { RichTextArticle } from "api/v1"
import { Alert, Button, ButtonLink } from "@mitodl/smoot-design"
import Typography from "@mui/material/Typography"
import Container from "@mui/material/Container"
import {
  extractFirstH1Title,
  ensureHeadings,
  ensureByline,
} from "./extensions/lib/utils"
import { useUserHasPermission, Permission } from "api/hooks/user"

const ViewContainer = styled.div({
  width: "100vw",
  height: "calc(100vh - 204px)",
  overflow: "scroll",
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

const CustomDocument = Document.extend({
  content: "heading block*",
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

  const [titleError, setTitleError] = React.useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)

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

  const uploadImage = useMediaUpload()

  const isArticleEditor = useUserHasPermission(Permission.ArticleEditor)

  const [content, setContent] = useState<JSONContent>(
    article?.content || {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
        },
        {
          type: "heading",
          attrs: { level: 4 },
        },
      ],
    },
  )
  const [touched, setTouched] = useState(false)

  const handleSave = () => {
    const title = extractFirstH1Title(content, 1)
    const subTitle = extractFirstH1Title(content, 4)
    if (!title?.trim()) {
      setTitleError(
        "Please enter a title. If you removed the title, add it back using the headings h1 controls.",
      )
      return
    }
    if (!subTitle?.trim()) {
      setTitleError(
        "Please enter a subtitle. If you removed the subtitle, add it back using the headings h4 controls.",
      )
      return
    }
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

  const uploadHandler = async (
    file: File,
    onProgress?: (e: { progress: number }) => void,
    abortSignal?: AbortSignal,
  ) => {
    setUploadError(null)
    return handleImageUpload(
      file,
      async (file: File, progressCb?: (percent: number) => void) => {
        try {
          const response = await uploadImage.mutateAsync({
            file,
            onUploadProgress: (e) => {
              const percent = Math.round((e.loaded * 100) / (e.total ?? 1))
              progressCb?.(percent)
            },
          })
          if (!response?.url) throw new Error("Upload failed")
          return response.url
        } catch (error) {
          if (error instanceof Error) {
            setUploadError(error.message)
          } else {
            setUploadError(String(error) || "Upload failed")
          }

          throw error
        }
      },
      onProgress,
      abortSignal,
    )
  }

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content,
    editable: !readOnly,

    onUpdate: ({ editor }) => {
      const json = editor.getJSON()

      ensureHeadings(editor)
      setContent(json)
      setTouched(true)
    },

    onCreate: ({ editor }) => {
      ensureByline(editor)
      ensureHeadings(editor)

      setTimeout(() => {
        editor.commands.setTextSelection(1)
        editor.commands.focus()
      }, 0)

      editor.commands.updateAttributes("mediaEmbed", { editable: !readOnly })
      editor.commands.updateAttributes("byline", { editable: readOnly })
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
      CustomDocument,
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading" && node.attrs.level === 1) {
            return "What’s the title?"
          }
          if (node.type.name === "heading" && node.attrs.level === 4) {
            return "Add a subtitle..."
          }
          return !readOnly ? "Start typing here..." : ""
        },
        showOnlyWhenEditable: false,
      }),
      HorizontalRule,
      LearningResourceNode,
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
      DividerNode,
      BylineNode,
      ImageWithCaption,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: uploadHandler,
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
          if (
            node.type.name === "mediaEmbed" ||
            node.type.name === "imageWithCaption" ||
            node.type.name === "byline"
          ) {
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
                disabled={isPending || !touched}
                onClick={handleSave}
                size="small"
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </StyledToolbar>
          )
        ) : null}
        <StyledContainer>
          {(isError || uploadError || titleError) && (
            <StyledAlert severity="error" closable>
              <Typography variant="body2" color="textPrimary">
                {error?.message ??
                  titleError ??
                  uploadError ??
                  "An error occurred while saving"}
              </Typography>
            </StyledAlert>
          )}
          <TiptapEditor editor={editor} readOnly={readOnly} />
        </StyledContainer>
      </EditorContext.Provider>
    </ViewContainer>
  )
}

export { ArticleEditor }

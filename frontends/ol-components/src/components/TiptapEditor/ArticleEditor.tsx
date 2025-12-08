"use client"

import React, { ChangeEventHandler, useState, useEffect } from "react"
import styled from "@emotion/styled"
import { EditorContext, JSONContent, useEditor } from "@tiptap/react"
import Document from "@tiptap/extension-document"
import { Placeholder, Selection } from "@tiptap/extensions"

import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Heading } from "@tiptap/extension-heading"
import { Image } from "@tiptap/extension-image"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography as TiptapTypography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"

import { Toolbar } from "./vendor/components/tiptap-ui-primitive/toolbar"
import { Spacer } from "./vendor/components/tiptap-ui-primitive/spacer"

import TiptapEditor, { MainToolbarContent } from "./TiptapEditor"

import { DividerNode } from "./extensions/node/Divider/DividerNode"
import { ArticleByLineInfoBarNode } from "./extensions/node/ArticleByLineInfoBar/ArticleByLineInfoBarNode"

import { LearningResourceNode } from "./extensions/node/LearningResource/LearningResourceNode"
import { MediaEmbedNode } from "./extensions/node/MediaEmbed/MediaEmbedNode"
import { HorizontalRule } from "./vendor/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { ImageNode } from "./extensions/node/Image/ImageNode"
import { ImageWithCaptionNode } from "./extensions/node/Image/ImageWithCaptionNode"

import "./vendor/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "./vendor/components/tiptap-node/code-block-node/code-block-node.scss"
import "./vendor/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "./vendor/components/tiptap-node/list-node/list-node.scss"
import "./vendor/components/tiptap-node/image-node/image-node.scss"
import "./vendor/components/tiptap-node/heading-node/heading-node.scss"
import "./vendor/components/tiptap-node/paragraph-node/paragraph-node.scss"

import { handleImageUpload, MAX_FILE_SIZE } from "./vendor/lib/tiptap-utils"

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
import { useUserHasPermission, Permission } from "api/hooks/user"
import { BannerNode } from "./extensions/node/Banner/BannerNode"
import {
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
} from "../../components/ThemeProvider/MITLearnGlobalStyles"

const TOOLBAR_HEIGHT = 43

const ViewContainer = styled.div<{ toolbarVisible: boolean }>(
  ({ toolbarVisible, theme }) => ({
    width: "100vw",
    marginTop: toolbarVisible ? TOOLBAR_HEIGHT : 0,
    backgroundColor: theme.custom.colors.white,
  }),
)

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  "&&": {
    position: "fixed",
    top: HEADER_HEIGHT,
    [theme.breakpoints.down("md")]: {
      top: HEADER_HEIGHT_MD,
    },
  },
}))

const StyledAlert = styled(Alert)({
  margin: "20px auto",
  maxWidth: "1000px",
})

const ArticleDocument = Document.extend({
  content: "banner byline block+",
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
  const [title, setTitle] = React.useState(article?.title)
  const [isPublishing, setIsPublishing] = useState(false)
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
          type: "banner",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [],
            },
            {
              type: "paragraph",
              content: [],
            },
          ],
        },
        {
          type: "byline",
        },
        { type: "paragraph", content: [] },
      ],
    },
  )
  const [touched, setTouched] = useState(false)

  const handleSave = (publish: boolean) => {
    if (!title) return
    if (article) {
      updateArticle(
        {
          id: article.id,
          title: title.trim(),
          content,
          is_published: publish,
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
          is_published: publish,
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

      setContent(json)
      setTouched(true)
    },

    onCreate: ({ editor }) => {
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
      ArticleDocument,
      StarterKit.configure({
        document: false, // Disable default document to use our ArticleDocument
        horizontalRule: false,
        heading: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      Placeholder.configure({
        showOnlyCurrent: false,
        includeChildren: true,
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return "Add heading..."
          }
          return "Add text..."
        },
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
      MediaEmbedNode,
      DividerNode,
      ArticleByLineInfoBarNode,
      ImageWithCaptionNode,
      ImageNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: uploadHandler,
        onError: (error) => console.error("Upload failed:", error),
      }),
      BannerNode,
    ],
  })

  useEffect(() => {
    if (!editor) return
    const title = editor.$node("heading", { level: 1 })?.textContent || ""
    setTitle(title)
  }, [editor, content])

  useEffect(() => {
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

  const publishButtonLabel = (() => {
    if (isPending && article?.is_published) return "Updating..."

    if (isPending && isPublishing && !article?.is_published)
      return "Publishing..."

    if (!isPending && article?.is_published) return "Update"

    return "Publish"
  })()

  return (
    <ViewContainer toolbarVisible={isArticleEditor}>
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
              {(!article || !article?.is_published) && (
                <Button
                  variant="secondary"
                  disabled={isPending || !touched}
                  onClick={() => {
                    handleSave(false)
                    setIsPublishing(false)
                  }}
                  size="small"
                >
                  {isPending && !isPublishing ? "Saving..." : "Save As Draft"}
                </Button>
              )}

              <Button
                variant="primary"
                disabled={isPending || !touched || !title}
                onClick={() => {
                  handleSave(true)
                  setIsPublishing(true)
                }}
                size="small"
              >
                {publishButtonLabel}
              </Button>
            </StyledToolbar>
          )
        ) : null}
        {isError ||
          (uploadError && (
            <StyledAlert severity="error" closable>
              <Typography variant="body2" color="textPrimary">
                {error?.message ??
                  uploadError ??
                  "An error occurred while saving"}
              </Typography>
            </StyledAlert>
          ))}

        <TiptapEditor editor={editor} readOnly={readOnly} fullWidth />
      </EditorContext.Provider>
    </ViewContainer>
  )
}

export { ArticleEditor }

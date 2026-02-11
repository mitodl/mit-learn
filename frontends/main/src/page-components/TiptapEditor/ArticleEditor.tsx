"use client"

import React, { ChangeEventHandler, useState, useEffect } from "react"
import styled from "@emotion/styled"
import { EditorContext, JSONContent, useEditor } from "@tiptap/react"
import type { RichTextArticle } from "api/v1"
import {
  LoadingSpinner,
  Typography,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
} from "ol-components"

import { Toolbar } from "./vendor/components/tiptap-ui-primitive/toolbar"
import { Spacer } from "./vendor/components/tiptap-ui-primitive/spacer"

import { TiptapEditor, MainToolbarContent, TipTapViewer } from "./TiptapEditor"
import { ArticleProvider } from "./ArticleContext"

import { handleImageUpload } from "./vendor/lib/tiptap-utils"
import { useArticleSchema, newArticleDocument } from "./useArticleSchema"

import "./vendor/styles/_keyframe-animations.scss"
import "./vendor/styles/_variables.scss"
import "./vendor/components/tiptap-templates/simple/simple-editor.scss"

import {
  useArticleCreate,
  useArticlePartialUpdate,
  useMediaUpload,
} from "api/hooks/articles"
import { Alert, Button, ButtonLink } from "@mitodl/smoot-design"
import { useUserHasPermission, Permission } from "api/hooks/user"
import dynamic from "next/dynamic"
import { extractLearningResourceIds, contentsMatch } from "./extensions/utils"
import { LearningResourceProvider } from "./extensions/node/LearningResource/LearningResourceDataProvider"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
  { ssr: false },
)

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
  position: "fixed",
  top: "108px",
  left: "50%",
  width: "690px",
  transform: "translateX(-50%)",
  zIndex: 1,
  "p:not(:first-child)": {
    margin: "10px 0",
  },
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
  const [resetAttempted, setResetAttempted] = useState(false)

  const {
    mutate: createArticle,
    isPending: isCreating,
    error: createError,
  } = useArticleCreate()
  const {
    mutate: updateArticle,
    isPending: isUpdating,
    error: updateError,
  } = useArticlePartialUpdate()

  const uploadImage = useMediaUpload()

  const isArticleEditor = useUserHasPermission(Permission.ArticleEditor)

  const [content, setContent] = useState<JSONContent>(
    article?.content || newArticleDocument,
  )
  const [touched, setTouched] = useState(false)

  // Extract author_name from the byline node
  const extractAuthorName = (content: JSONContent): string | "" => {
    const bylineNode = content.content?.find((node) => node.type === "byline")
    return bylineNode?.attrs?.authorName || ""
  }

  const handleSave = (publish: boolean) => {
    if (!title) return
    const authorName = extractAuthorName(content)
    if (article) {
      updateArticle(
        {
          id: article.id,
          title: title.trim(),
          content,
          is_published: publish,
          author_name: authorName,
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
          author_name: authorName,
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
          uploadImage.setNextProgressCallback(progressCb)

          const response = await uploadImage.mutateAsync({ file })

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

  const { extensions, schemaError } = useArticleSchema({
    uploadHandler,
    setUploadError,
    enabled: isArticleEditor,
    content,
  })

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
    extensions,
  })

  useEffect(() => {
    if (!article || !editor) return

    if (article.content) {
      const currentContent = editor.getJSON()
      if (!contentsMatch(article.content, currentContent)) {
        setContent(article.content)
        setTouched(true)
        editor.commands.setContent(article.content)
      }
    }

    if (article.title !== undefined) {
      setTitle(article.title)
    }
  }, [article, editor])

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
            node.type.name === "byline" ||
            node.type.name === "learningResource"
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
  const error = createError || updateError || uploadError || schemaError

  const resourceIds = extractLearningResourceIds(content)

  return (
    <ViewContainer toolbarVisible={isArticleEditor}>
      <ArticleProvider value={{ article }}>
        <LearningResourceProvider resourceIds={resourceIds}>
          <EditorContext.Provider value={{ editor }}>
            {isArticleEditor ? (
              readOnly ? (
                <StyledToolbar>
                  <Spacer />
                  <ButtonLink
                    variant="secondary"
                    href="/articles/draft"
                    size="small"
                  >
                    Drafts
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    href={`/articles/${article?.is_published ? article?.slug : article?.id}/edit`}
                    size="small"
                  >
                    Edit
                  </ButtonLink>
                </StyledToolbar>
              ) : (
                <StyledToolbar>
                  <MainToolbarContent editor={editor} />
                  {!article?.is_published ? (
                    <Button
                      variant="secondary"
                      disabled={isPending || !touched || !title}
                      onClick={() => {
                        setIsPublishing(false)
                        handleSave(false)
                      }}
                      size="small"
                      endIcon={
                        isPending && !isPublishing ? (
                          <LoadingSpinner size={14} color="inherit" loading />
                        ) : null
                      }
                    >
                      Save As Draft
                    </Button>
                  ) : null}

                  <Button
                    variant="primary"
                    disabled={
                      isPending || !title || (!touched && article?.is_published)
                    }
                    onClick={() => {
                      setIsPublishing(true)
                      handleSave(true)
                    }}
                    size="small"
                    endIcon={
                      isPending && isPublishing ? (
                        <LoadingSpinner size={14} color="inherit" loading />
                      ) : null
                    }
                  >
                    Publish
                  </Button>
                </StyledToolbar>
              )
            ) : null}
            {error ? (
              <StyledAlert severity="error" closable>
                <Typography variant="body2" color="textPrimary">
                  {error instanceof Error ? error.message : error}
                </Typography>
                {schemaError && !readOnly ? (
                  <>
                    <Typography variant="body2">
                      Reset to attempt to align the article to the content
                      template.
                    </Typography>
                    {resetAttempted ? (
                      <Typography variant="body2">
                        Reset attempt failed.
                      </Typography>
                    ) : null}
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        /**
                         * setContent() generally does a good job of fixing invalid content to meet the schema.
                         * We want to show schema errors (to editors only), though in most cases this
                         * reset should accommodate changes we make to the schema allowing pre-existing articles
                         * to remain editable.
                         *
                         * This provides a checkpoint for editors to accept schema changes on existing articles
                         * which may otherwise break them.
                         */
                        editor.commands.setContent(article?.content)
                        setResetAttempted(true)
                      }}
                    >
                      Reset
                    </Button>
                  </>
                ) : null}
              </StyledAlert>
            ) : null}
            {readOnly ? (
              <>
                <LearningResourceDrawer />
                <TipTapViewer content={content} extensions={extensions} />
              </>
            ) : (
              <TiptapEditor editor={editor} />
            )}
          </EditorContext.Provider>
        </LearningResourceProvider>
      </ArticleProvider>
    </ViewContainer>
  )
}

export { ArticleEditor }

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
import Document from "@tiptap/extension-document"
import { Placeholder, Selection } from "@tiptap/extensions"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
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
import { ArticleProvider } from "./ArticleContext"

import { DividerNode } from "./extensions/node/Divider/DividerNode"
import { ArticleByLineInfoBarNode } from "./extensions/node/ArticleByLineInfoBar/ArticleByLineInfoBarNode"

import { LearningResourceNode } from "./extensions/node/LearningResource/LearningResourceNode"
import { LearningResourceURLHandler } from "./extensions/node/LearningResource/LearningResourcePaste"
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

import type { ExtendedNodeConfig } from "./extensions/node/types"
import { handleImageUpload, MAX_FILE_SIZE } from "./vendor/lib/tiptap-utils"

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
import { BannerNode } from "./extensions/node/Banner/BannerNode"
import { extractLearningResourceIds } from "./extensions/utils"
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
        trailingNode: {
          node: "paragraph",
        },
      }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      Placeholder.configure({
        showOnlyCurrent: false,
        includeChildren: true,
        placeholder: ({ node, editor }): string => {
          let parentNode: typeof node | null = null

          editor.state.doc.descendants((n: ProseMirrorNode) => {
            n.forEach((childNode: ProseMirrorNode) => {
              if (childNode === node) {
                parentNode = n
              }
            })
            if (parentNode) {
              return false
            }
            return undefined
          })

          if (parentNode) {
            const parentExtension = editor.extensionManager.extensions.find(
              (ext) => ext.name === parentNode!.type.name,
            )

            if (
              parentExtension &&
              "config" in parentExtension &&
              parentExtension.config &&
              typeof (parentExtension.config as ExtendedNodeConfig)
                .getPlaceholders === "function"
            ) {
              const placeholder = (
                parentExtension.config as ExtendedNodeConfig
              ).getPlaceholders(node)
              if (placeholder) {
                return placeholder
              }
            }
          }

          if (node.type.name === "heading") {
            return "Add a heading"
          }
          return "Add some text"
        },
      }),
      HorizontalRule,
      LearningResourceURLHandler,
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
        onError: (error) => setUploadError(error.message),
      }),
      BannerNode,
    ],
  })

  useEffect(() => {
    if (!article || !editor) return

    if (article.content) {
      const currentContent = editor.getJSON()
      if (JSON.stringify(article.content) !== JSON.stringify(currentContent)) {
        setContent(article.content)
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
  const error = createError || updateError || uploadError

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
              </StyledAlert>
            ) : null}
            <LearningResourceDrawer />
            <TiptapEditor editor={editor} readOnly={readOnly} fullWidth />
          </EditorContext.Provider>
        </LearningResourceProvider>
      </ArticleProvider>
    </ViewContainer>
  )
}

export { ArticleEditor }

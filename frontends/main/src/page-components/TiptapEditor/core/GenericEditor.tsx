"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import styled from "@emotion/styled"
import { EditorContext, JSONContent, useEditor } from "@tiptap/react"
import type { Extension, Node, Mark } from "@tiptap/core"
import { getSchema } from "@tiptap/core"
import type { WebsiteContent } from "api/v1"
import {
  LoadingSpinner,
  Typography,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
} from "ol-components"
import { Alert, Button } from "@mitodl/smoot-design"
import { useUserHasPermission, Permission } from "api/hooks/user"
import { useMediaUpload } from "api/hooks/articles"
import dynamic from "next/dynamic"

import { Toolbar } from "../vendor/components/tiptap-ui-primitive/toolbar"
import { TiptapEditor, MainToolbarContent, TipTapViewer } from "../TiptapEditor"
import { handleImageUpload } from "../vendor/lib/tiptap-utils"
import { useSchema } from "../useSchema"
import { ArticleProvider } from "../ArticleContext"
import { extractLearningResourceIds, contentsMatch } from "../extensions/utils"
import { LearningResourceProvider } from "../extensions/node/LearningResource/LearningResourceDataProvider"

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

export type UploadHandler = (
  file: File,
  onProgress?: (e: { progress: number }) => void,
  abortSignal?: AbortSignal,
) => Promise<string>

/**
 * The data shape sent to the create/update API.
 * `[key: string]: unknown` allows per-type extra fields (e.g. author_name).
 */
export interface SavePayload {
  title: string
  content: JSONContent
  is_published: boolean
  [key: string]: unknown
}

/**
 * Per-type save mutations. Each content type owns its own API hooks and passes
 * the resulting mutation objects here, so GenericEditor never imports a
 * specific API hook directly.
 *
 * Example — news type uses websiteContent API:
 *   const create = useArticleCreate()
 *   const update = useArticlePartialUpdate()
 *   <GenericEditor saveMutations={{ create, update }} ... />
 *
 * A future user-article type could use a completely different API hook:
 *   const create = useUserArticleCreate()
 *   const update = useUserArticlePartialUpdate()
 *   <GenericEditor saveMutations={{ create, update }} ... />
 */
export interface SaveMutations {
  create: {
    mutate: (
      data: SavePayload,
      options: { onSuccess?: (result: WebsiteContent) => void },
    ) => void
    isPending: boolean
    error: Error | null | unknown
  }
  update: {
    mutate: (
      data: SavePayload & { id: number },
      options: { onSuccess?: (result: WebsiteContent) => void },
    ) => void
    isPending: boolean
    error: Error | null | unknown
  }
}

/**
 * A factory function that builds the Tiptap extensions for a given content type.
 * Receives upload utilities so extensions that handle image upload can be configured.
 */
export type CreateExtensionsFn = (
  uploadHandler: UploadHandler,
  setUploadError: (error: string | null) => void,
) => (Extension | Node | Mark)[]

export interface GenericEditorProps {
  /**
   * Factory that builds the full extensions list for this content type.
   * Must be a stable reference (module-level function or useCallback).
   */
  createExtensions: CreateExtensionsFn
  /** Initial document structure when no article is provided. */
  initialDoc: JSONContent
  /**
   * Content-type-specific toolbar content.
   * - In read-only mode this slot provides all toolbar items (e.g. Drafts + Edit links).
   * - In edit mode this slot is appended after the Publish button.
   */
  toolbarSlot?: React.ReactNode
  /** Optional CSS class forwarded to the editor container for per-type theming. */
  className?: string
  /**
   * Extract additional fields to include in the save payload.
   * E.g., for news: `(content) => ({ author_name: extractAuthorName(content) })`
   */
  extractExtraFields?: (content: JSONContent) => Record<string, unknown>
  /**
   * Mutations for create and update. Provided by the content-type wrapper so
   * GenericEditor stays decoupled from any specific API endpoint.
   */
  saveMutations: SaveMutations
  onSave?: (article: WebsiteContent) => void
  readOnly?: boolean
  article?: WebsiteContent
}

const GenericEditor = ({
  createExtensions,
  initialDoc,
  toolbarSlot,
  className,
  extractExtraFields,
  saveMutations,
  onSave,
  readOnly,
  article,
}: GenericEditorProps) => {
  const [isPublishing, setIsPublishing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [resetAttempted, setResetAttempted] = useState(false)
  const [content, setContent] = useState<JSONContent>(
    article?.content || initialDoc,
  )
  const [title, setTitle] = useState(article?.title)
  const [touched, setTouched] = useState(false)

  const { create: createMutation, update: updateMutation } = saveMutations
  const isPending = createMutation.isPending || updateMutation.isPending
  const saveError = createMutation.error || updateMutation.error

  const uploadImage = useMediaUpload()
  // Keep a ref so the stable uploadHandler callback always calls the latest mutation.
  const uploadImageRef = useRef(uploadImage)
  uploadImageRef.current = uploadImage

  const isArticleEditor = useUserHasPermission(Permission.ArticleEditor)

  const uploadHandler = useCallback<UploadHandler>(
    async (file, onProgress, abortSignal) => {
      setUploadError(null)
      return handleImageUpload(
        file,
        async (f, progressCb) => {
          try {
            uploadImageRef.current.setNextProgressCallback(progressCb)
            const response = await uploadImageRef.current.mutateAsync({
              file: f,
            })
            if (!response?.url) throw new Error("Upload failed")
            return response.url
          } catch (error) {
            const msg =
              error instanceof Error
                ? error.message
                : String(error) || "Upload failed"
            setUploadError(msg)
            throw error
          }
        },
        onProgress,
        abortSignal,
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const extensions = useMemo(
    () => createExtensions(uploadHandler, setUploadError),
    [createExtensions, uploadHandler],
  )

  const schema = useMemo(() => getSchema(extensions), [extensions])

  const schemaError = useSchema({
    schema,
    content,
    enabled: isArticleEditor,
  })

  const handleSave = (publish: boolean) => {
    if (!title) return
    const extraFields = extractExtraFields?.(content) ?? {}
    if (article) {
      updateMutation.mutate(
        {
          id: article.id,
          title: title.trim(),
          content,
          is_published: publish,
          ...extraFields,
        },
        { onSuccess: onSave },
      )
    } else {
      createMutation.mutate(
        {
          title: title.trim(),
          content,
          is_published: publish,
          ...extraFields,
        },
        { onSuccess: onSave },
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

  // Sync incoming article changes (e.g., after a refetch)
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

  // Keep title in sync with the h1 heading inside the editor
  useEffect(() => {
    if (!editor) return
    const headingTitle =
      editor.$node("heading", { level: 1 })?.textContent || ""
    setTitle(headingTitle)
  }, [editor, content])

  // Propagate readOnly changes to interactive node attrs
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

  const error = saveError || uploadError || schemaError
  const errorMessage =
    error instanceof Error ? error.message : (error as string | null)
  const resourceIds = extractLearningResourceIds(content)

  return (
    <ViewContainer toolbarVisible={!!isArticleEditor}>
      <ArticleProvider value={{ article }}>
        <LearningResourceProvider resourceIds={resourceIds}>
          <EditorContext.Provider value={{ editor }}>
            {isArticleEditor ? (
              readOnly ? (
                <StyledToolbar>{toolbarSlot}</StyledToolbar>
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
                  {toolbarSlot}
                </StyledToolbar>
              )
            ) : null}

            {error ? (
              <StyledAlert severity="error" closable>
                <Typography variant="body2" color="textPrimary">
                  {errorMessage}
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
              <TiptapEditor editor={editor} className={className} />
            )}
          </EditorContext.Provider>
        </LearningResourceProvider>
      </ArticleProvider>
    </ViewContainer>
  )
}

export { GenericEditor }

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import styled from "@emotion/styled"
import { EditorContext, JSONContent, useEditor } from "@tiptap/react"
import type { Extension, Node, Mark } from "@tiptap/core"
import { getSchema } from "@tiptap/core"
import { WebsiteContentContentTypeEnum, type WebsiteContent } from "api/v1"
import {
  LoadingSpinner,
  Typography,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
} from "ol-components"
import { Alert, Button, ButtonLink } from "@mitodl/smoot-design"
import { useUserHasPermission, Permission } from "api/hooks/user"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useRouter } from "next-nprogress-bar"
import {
  RiDeleteBinLine,
  RiEditLine,
  RiEqualizerLine,
  RiSave3Line,
} from "@remixicon/react"
import { showDeleteWebsiteContentDialog } from "@/page-components/WebsiteContentDialogs/DeleteWebsiteContentDialog"
import { ArticleSettingsDrawer } from "@/page-components/ArticleSettings/ArticleSettingsDrawer"

import { Toolbar } from "../vendor/components/tiptap-ui-primitive/toolbar"
import { TiptapEditor, MainToolbarContent, TipTapViewer } from "../TiptapEditor"
import { BannerViewer } from "../extensions/node/Banner/BannerNode"
import { Spacer } from "../vendor/components/tiptap-ui-primitive/spacer"
import { handleImageUpload } from "../vendor/lib/tiptap-utils"
import { useSchema } from "../useSchema"
import { WebsiteContentProvider } from "../WebsiteContentContext"
import { extractLearningResourceIds, contentsMatch } from "../extensions/utils"
import { LearningResourceProvider } from "../extensions/node/LearningResource/LearningResourceDataProvider"
import { websiteContentDraftsView, websiteContentEditView } from "@/common/urls"
import { CONTENT_TYPE_LABELS } from "@/common/website_content"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
  { ssr: false },
)

const TOOLBAR_HEIGHT = 43

const ViewContainer = styled.div<{
  toolbarVisible: boolean
}>(({ toolbarVisible, theme }) => ({
  width: "100vw",
  marginTop: toolbarVisible ? TOOLBAR_HEIGHT : 0,
  backgroundColor: theme.custom.colors.white,
}))

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

/**
 * Publish is green rather than the primary red: red is reserved for the
 * destructive Unpublish action in the same bar. Keeps primary's white label
 * and Shadow/04dp.
 */
const PublishButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.custom.colors.darkGreen,
  ":hover:not(:disabled)": {
    backgroundColor: theme.custom.colors.green,
  },
}))

const StatusText = styled(Typography)(({ theme }) => ({
  paddingLeft: "4px",
  color: theme.custom.colors.silverGrayDark,
  whiteSpace: "nowrap",
}))

const StyledStatusContainer = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  marginRight: "16px",
})

/* The value is darker than its label, but not bolder. */
const StatusValue = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
}))

export type UploadHandler = (
  file: File,
  onProgress?: (e: { progress: number }) => void,
  abortSignal?: AbortSignal,
) => Promise<string>

/**
 * The minimal interface expected from a media upload mutation.
 * Matches the shape returned by `useMediaUpload` from `api/hooks/website_content`,
 * but callers may supply any compatible implementation.
 */
export interface MediaUpload {
  mutateAsync: (data: { file: File }) => Promise<{ url?: string }>
  setNextProgressCallback: (
    callback: ((percent: number) => void) | undefined,
  ) => void
}

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
 * the resulting mutation objects here, so WebsiteContentEditor never imports a
 * specific API hook directly.
 *
 * Example — news type uses websiteContent API:
 *   const create = useWebsiteContentCreate()
 *   const update = useWebsiteContentPartialUpdate()
 *   <WebsiteContentEditor saveMutations={{ create, update }} ... />
 *
 * A future content type could use a different API hook:
 *   const create = useSpecializedContentCreate()    // future hook
 *   const update = useSpecializedContentPartialUpdate()
 *   <WebsiteContentEditor saveMutations={{ create, update }} ... />
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
  queryClient?: QueryClient | null,
) => (Extension | Node | Mark)[]

export interface WebsiteContentEditorProps {
  /**
   * Factory that builds the full extensions list for this content type.
   * Must be a stable reference (module-level function or useCallback).
   */
  createExtensions: CreateExtensionsFn
  /** Initial document structure when no content item is provided. */
  initialDoc: JSONContent
  /** Content type for route generation (Drafts/Edit links in read-only toolbar). */
  contentType: WebsiteContentContentTypeEnum
  /**
   * Optional CSS class applied to the editor root container (covers both edit
   * and read-only). Used by content-type wrappers via `styled(WebsiteContentEditor)`
   * to theme nodes through their hook classes.
   */
  className?: string
  /**
   * Extract additional fields to include in the save payload.
   * E.g., for news: `(content) => ({ author_name: extractAuthorName(content) })`
   */
  extractExtraFields?: (content: JSONContent) => Record<string, unknown>
  /**
   * Mutations for create and update. Provided by the content-type wrapper so
   * WebsiteContentEditor stays decoupled from any specific API endpoint.
   */
  saveMutations: SaveMutations
  /**
   * Upload mutation provided by the content-type wrapper.
   * Pass the return value of `useMediaUpload()` (or a compatible implementation)
   * so WebsiteContentEditor stays decoupled from any specific upload endpoint.
   */
  uploadImage: MediaUpload
  onSave?: (contentItem: WebsiteContent) => void
  readOnly?: boolean
  contentItem?: WebsiteContent
  bannerViewer?: typeof BannerViewer
}

const WebsiteContentEditor = ({
  createExtensions,
  contentType,
  initialDoc,
  className,
  extractExtraFields,
  saveMutations,
  uploadImage,
  onSave,
  readOnly,
  contentItem,
  bannerViewer,
}: WebsiteContentEditorProps) => {
  const [isPublishing, setIsPublishing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [resetAttempted, setResetAttempted] = useState(false)
  const [content, setContent] = useState<JSONContent>(
    contentItem?.content || initialDoc,
  )
  const [title, setTitle] = useState(contentItem?.title)
  const [touched, setTouched] = useState(false)

  const { create: createMutation, update: updateMutation } = saveMutations
  const isPending = createMutation.isPending || updateMutation.isPending
  const saveError = createMutation.error || updateMutation.error

  // Keep a ref so the stable uploadHandler callback always calls the latest mutation.
  const uploadImageRef = useRef(uploadImage)
  uploadImageRef.current = uploadImage

  const queryClient = useQueryClient()
  const router = useRouter()
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
    () => createExtensions(uploadHandler, setUploadError, queryClient),
    [createExtensions, uploadHandler, queryClient],
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
    if (contentItem) {
      updateMutation.mutate(
        {
          id: contentItem.id,
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

  // Sync incoming content changes (e.g., after a refetch)
  useEffect(() => {
    if (!contentItem || !editor) return

    if (contentItem.content) {
      const currentContent = editor.getJSON()
      if (!contentsMatch(contentItem.content, currentContent)) {
        setContent(contentItem.content)
        setTouched(true)
        editor.commands.setContent(contentItem.content)
      }
    }

    if (contentItem.title !== undefined) {
      setTitle(contentItem.title)
    }
  }, [contentItem, editor])

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
  const editIdOrSlug = contentItem?.is_published
    ? (contentItem?.slug ?? contentItem.id)
    : contentItem?.id
  /**
   * The designs are drawn for /articles, but this chrome is shared by every
   * content type this editor serves. The type's display label is substituted
   * into the copy so news reads "News status:" rather than "Article status:".
   */
  const contentLabel = CONTENT_TYPE_LABELS[contentType]

  const statusSlot = (
    <StatusText variant="body2">
      {contentLabel} status:{" "}
      <StatusValue>
        {contentItem?.is_published ? "Published" : "Draft"}
      </StatusValue>
    </StatusText>
  )

  /**
   * "medium" reproduces the design's button box exactly: 40px tall, 14px medium
   * label, 20px icon, 8px gap, and 12px/16px horizontal padding (smoot-design
   * pulls the icon side in by 4px).
   */
  const buttonSize = "medium"

  const settingsButton = (
    <Button
      variant="bordered"
      size={buttonSize}
      startIcon={<RiEqualizerLine />}
      onClick={() => setSettingsOpen(true)}
    >
      Settings
    </Button>
  )

  /**
   * Published view: navigation and settings sit left, the publish-state action
   * and status sit right (the Spacer splits them).
   */
  const readOnlyToolbarSlot = (
    <>
      <ButtonLink
        variant="bordered"
        href={websiteContentDraftsView(contentType)}
        size={buttonSize}
        startIcon={<RiSave3Line />}
      >
        Draft
      </ButtonLink>
      {editIdOrSlug !== undefined ? (
        <ButtonLink
          variant="bordered"
          href={websiteContentEditView(contentType, editIdOrSlug)}
          size={buttonSize}
          startIcon={<RiEditLine />}
        >
          Edit
        </ButtonLink>
      ) : null}
      {settingsButton}
      <Spacer />
      {contentItem?.is_published ? (
        <Button
          variant="primary"
          size={buttonSize}
          disabled={isPending || !title}
          onClick={() => {
            setIsPublishing(false)
            handleSave(false)
          }}
          endIcon={
            isPending ? (
              <LoadingSpinner size={14} color="inherit" loading />
            ) : null
          }
        >
          Unpublish {contentLabel}
        </Button>
      ) : null}
      {statusSlot}
    </>
  )

  return (
    <ViewContainer toolbarVisible={!!isArticleEditor} className={className}>
      <WebsiteContentProvider value={{ contentItem }}>
        <LearningResourceProvider resourceIds={resourceIds}>
          <EditorContext.Provider value={{ editor }}>
            {isArticleEditor ? (
              readOnly ? (
                <StyledStatusContainer>
                  <StyledToolbar>{readOnlyToolbarSlot}</StyledToolbar>
                </StyledStatusContainer>
              ) : (
                <StyledToolbar>
                  <MainToolbarContent editor={editor} />
                  {/* Splits the formatting controls from the content actions,
                      which are grouped to the right. */}
                  <Spacer />
                  <StyledStatusContainer>
                    {contentItem && !contentItem.is_published ? (
                      <Button
                        variant="bordered"
                        size={buttonSize}
                        disabled={isPending}
                        startIcon={<RiDeleteBinLine />}
                        onClick={() =>
                          showDeleteWebsiteContentDialog(contentItem, () =>
                            router.push(websiteContentDraftsView(contentType)),
                          )
                        }
                      >
                        Delete
                      </Button>
                    ) : null}
                    {settingsButton}
                    {!contentItem?.is_published ? (
                      <Button
                        variant="bordered"
                        disabled={isPending || !touched || !title}
                        onClick={() => {
                          setIsPublishing(false)
                          handleSave(false)
                        }}
                        size={buttonSize}
                        startIcon={<RiEditLine />}
                        endIcon={
                          isPending && !isPublishing ? (
                            <LoadingSpinner size={14} color="inherit" loading />
                          ) : null
                        }
                      >
                        Save as Draft
                      </Button>
                    ) : null}
                    <PublishButton
                      variant="primary"
                      disabled={
                        isPending ||
                        !title ||
                        (!touched && contentItem?.is_published)
                      }
                      onClick={() => {
                        setIsPublishing(true)
                        handleSave(true)
                      }}
                      size={buttonSize}
                      endIcon={
                        isPending && isPublishing ? (
                          <LoadingSpinner size={14} color="inherit" loading />
                        ) : null
                      }
                    >
                      Publish
                    </PublishButton>
                    {statusSlot}
                  </StyledStatusContainer>
                </StyledToolbar>
              )
            ) : null}

            {isArticleEditor ? (
              <ArticleSettingsDrawer
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                contentLabel={contentLabel}
              />
            ) : null}

            {error ? (
              <StyledAlert severity="error" closable>
                <Typography variant="body2" color="textPrimary">
                  {errorMessage}
                </Typography>
                {schemaError && !readOnly ? (
                  <>
                    <Typography variant="body2">
                      Reset to attempt to align the content to the template.
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
                        editor.commands.setContent(contentItem?.content)
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
                <TipTapViewer
                  content={content}
                  extensions={extensions}
                  bannerViewer={bannerViewer}
                />
              </>
            ) : (
              <TiptapEditor editor={editor} />
            )}
          </EditorContext.Provider>
        </LearningResourceProvider>
      </WebsiteContentProvider>
    </ViewContainer>
  )
}

export { WebsiteContentEditor }

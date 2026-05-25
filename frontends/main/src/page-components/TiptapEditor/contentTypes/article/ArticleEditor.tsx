"use client"

import React from "react"
import styled from "@emotion/styled"
import type { WebsiteContent } from "api/v1"
import { ButtonLink } from "@mitodl/smoot-design"
import {
  useWebsiteContentCreate,
  useWebsiteContentPartialUpdate,
  useMediaUpload,
} from "api/hooks/website_content"
import { Spacer } from "../../vendor/components/tiptap-ui-primitive/spacer"
import { WebsiteContentEditor } from "../../core/WebsiteContentEditor"
import {
  createArticleExtensions,
  newArticleDocument,
} from "./articleExtensions"
import { ArticleBannerViewer } from "../../extensions/node/Banner/ArticleBannerNode"

/**
 * Article-specific byline look: merged into the white banner (no bar chrome) with
 * a "·" separator. Styling lives here (not in the byline node) by targeting the
 * node's published hook classes, so the node stays content-type-agnostic.
 */
const StyledWebsiteContentEditor = styled(WebsiteContentEditor)(
  ({ theme }) => ({
    // Article sits on a gray page; the banner + byline render as white islands.
    backgroundColor: theme.custom.colors.lightGray1,
    ".byline-info-bar": {
      boxShadow: "none",
      border: "none",
      marginBottom: "40px",
      paddingTop: 0,
    },
    ".byline-info-bar__separator::before": {
      content: '"·"',
    },
  }),
)

// Article-specific: extract author name from the byline node
const extractArticleExtraFields = (content: {
  content?: Array<{ type?: string; attrs?: Record<string, unknown> }>
}): Record<string, unknown> => {
  const bylineNode = content.content?.find((node) => node.type === "byline")
  return {
    author_name: bylineNode?.attrs?.authorName || "",
    content_type: "article",
  }
}

interface ArticleEditorProps {
  onSave?: (article: WebsiteContent) => void
  readOnly?: boolean
  article?: WebsiteContent
}

/**
 * Editor shell configured for the article content type (served under /articles).
 * Owns its own save mutations so WebsiteContentEditor stays API-agnostic.
 *
 * Currently uses the same websiteContent API as the news editor. If /articles
 * later needs a dedicated endpoint, swap in the new hooks here:
 *
 *   const createMutation = useArticleCreate()    // future hook
 *   const updateMutation = useArticlePartialUpdate()
 *
 * WebsiteContentEditor does not need to change at all.
 */
const ArticleEditor = ({ onSave, readOnly, article }: ArticleEditorProps) => {
  // Swap these hooks when a dedicated article API exists.
  const createMutation = useWebsiteContentCreate()
  const updateMutation = useWebsiteContentPartialUpdate()
  const uploadImage = useMediaUpload()

  const editUrl = article
    ? `/website_content/article/${article.is_published ? article.slug : article.id}/edit`
    : "/website_content/article/new"

  const toolbarSlot = readOnly ? (
    <>
      <Spacer />
      <ButtonLink
        variant="secondary"
        href="/website_content/drafts?content_type=article"
        size="small"
      >
        Drafts
      </ButtonLink>
      <ButtonLink variant="primary" href={editUrl} size="small">
        Edit
      </ButtonLink>
    </>
  ) : null

  return (
    <StyledWebsiteContentEditor
      createExtensions={createArticleExtensions}
      initialDoc={newArticleDocument}
      toolbarSlot={toolbarSlot}
      extractExtraFields={extractArticleExtraFields}
      saveMutations={{ create: createMutation, update: updateMutation }}
      uploadImage={uploadImage}
      onSave={onSave}
      readOnly={readOnly}
      contentItem={article}
      backgroundColor="lightGray1"
      applyViewerTopSpacing
      article={article}
      bannerViewer={ArticleBannerViewer}
    />
  )
}

export { ArticleEditor }
export type { ArticleEditorProps }

"use client"

import React from "react"
import type { ChangeEventHandler } from "react"
import type { WebsiteContent } from "api/v1"
import { ButtonLink } from "@mitodl/smoot-design"
import { useArticleCreate, useArticlePartialUpdate } from "api/hooks/articles"
import { Spacer } from "../../vendor/components/tiptap-ui-primitive/spacer"
import { GenericEditor } from "../../core/GenericEditor"
import { createNewsExtensions, newNewsDocument } from "./newsExtensions"

// News-specific: extract the author name from the byline node in the document
const extractNewsExtraFields = (content: {
  content?: Array<{ type?: string; attrs?: Record<string, unknown> }>
}): Record<string, unknown> => {
  const bylineNode = content.content?.find((node) => node.type === "byline")
  return { author_name: bylineNode?.attrs?.authorName || "" }
}

interface NewsEditorProps {
  /** @deprecated unused, kept for API compatibility */
  value?: object
  onSave?: (article: WebsiteContent) => void
  readOnly?: boolean
  /** @deprecated unused, kept for API compatibility */
  title?: string
  /** @deprecated unused, kept for API compatibility */
  setTitle?: ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>
  article?: WebsiteContent
}

/**
 * Editor shell configured for the news content type (served under /news).
 * Owns its own save mutations (websiteContent API) and passes them to
 * GenericEditor — keeping the generic shell decoupled from any specific API.
 */
const NewsEditor = ({ onSave, readOnly, article }: NewsEditorProps) => {
  // News content type uses the websiteContent (articles) API.
  // A different content type would call different hooks here.
  const createMutation = useArticleCreate()
  const updateMutation = useArticlePartialUpdate()

  const editUrl = article
    ? `/news/${article.is_published ? article.slug : article.id}/edit`
    : "/news/new"

  const toolbarSlot = readOnly ? (
    <>
      <Spacer />
      <ButtonLink variant="secondary" href="/news/draft" size="small">
        Drafts
      </ButtonLink>
      <ButtonLink variant="primary" href={editUrl} size="small">
        Edit
      </ButtonLink>
    </>
  ) : null

  return (
    <GenericEditor
      createExtensions={createNewsExtensions}
      initialDoc={newNewsDocument}
      toolbarSlot={toolbarSlot}
      extractExtraFields={extractNewsExtraFields}
      saveMutations={{ create: createMutation, update: updateMutation }}
      onSave={onSave}
      readOnly={readOnly}
      article={article}
    />
  )
}

export { NewsEditor }
export type { NewsEditorProps }

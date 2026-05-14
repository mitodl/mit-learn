"use client"

import React from "react"
import type { ChangeEventHandler } from "react"
import type { WebsiteContent } from "api/v1"
import { ButtonLink } from "@mitodl/smoot-design"
import { useArticleCreate, useArticlePartialUpdate } from "api/hooks/articles"
import { Spacer } from "../../vendor/components/tiptap-ui-primitive/spacer"
import { GenericEditor } from "../../core/GenericEditor"
import {
  createArticleExtensions,
  newArticleDocument,
} from "./articleExtensions"

// Article-specific: extract author name from the byline node
const extractArticleExtraFields = (content: {
  content?: Array<{ type?: string; attrs?: Record<string, unknown> }>
}): Record<string, unknown> => {
  const bylineNode = content.content?.find((node) => node.type === "byline")
  return { author_name: bylineNode?.attrs?.authorName || "" }
}

interface ArticleEditorProps {
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
 * Editor shell configured for the article content type (served under /articles).
 * Owns its own save mutations so GenericEditor stays API-agnostic.
 *
 * Currently uses the same websiteContent API as the news editor. When /articles
 * gets its own Django model and viewset, swap in the new hooks here:
 *
 *   const createMutation = useUserArticleCreate()    // future hook
 *   const updateMutation = useUserArticlePartialUpdate()
 *
 * GenericEditor does not need to change at all.
 */
const ArticleEditor = ({ onSave, readOnly, article }: ArticleEditorProps) => {
  // Swap these two lines when a dedicated UserArticle API exists.
  const createMutation = useArticleCreate()
  const updateMutation = useArticlePartialUpdate()

  const editUrl = article
    ? `/articles/${article.is_published ? article.slug : article.id}/edit`
    : "/articles/new"

  const toolbarSlot = readOnly ? (
    <>
      <Spacer />
      <ButtonLink variant="secondary" href="/articles/draft" size="small">
        Drafts
      </ButtonLink>
      <ButtonLink variant="primary" href={editUrl} size="small">
        Edit
      </ButtonLink>
    </>
  ) : null

  return (
    <GenericEditor
      createExtensions={createArticleExtensions}
      initialDoc={newArticleDocument}
      toolbarSlot={toolbarSlot}
      extractExtraFields={extractArticleExtraFields}
      saveMutations={{ create: createMutation, update: updateMutation }}
      onSave={onSave}
      readOnly={readOnly}
      article={article}
    />
  )
}

export { ArticleEditor }
export type { ArticleEditorProps }

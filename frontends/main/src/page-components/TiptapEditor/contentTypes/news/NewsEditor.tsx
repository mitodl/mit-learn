"use client"

import React from "react"
import { WebsiteContentContentTypeEnum, type WebsiteContent } from "api/v1"
import {
  useWebsiteContentCreate,
  useWebsiteContentPartialUpdate,
  useMediaUpload,
} from "api/hooks/website_content"
import { WebsiteContentEditor } from "../../core/WebsiteContentEditor"
import { createNewsExtensions, newNewsDocument } from "./newsExtensions"

// News-specific: extract the author name from the byline node in the document
const extractNewsExtraFields = (content: {
  content?: Array<{ type?: string; attrs?: Record<string, unknown> }>
}): Record<string, unknown> => {
  const bylineNode = content.content?.find((node) => node.type === "byline")
  return {
    author_name: bylineNode?.attrs?.authorName || "",
    content_type: "news",
  }
}

interface NewsEditorProps {
  onSave?: (savedContent: WebsiteContent) => void
  readOnly?: boolean
  newsItem?: WebsiteContent
}

/**
 * Editor shell configured for the news content type (served under /news).
 * Owns its own save mutations (websiteContent API) and passes them to
 * WebsiteContentEditor — keeping the generic shell decoupled from any specific API.
 */
const NewsEditor = ({ onSave, readOnly, newsItem }: NewsEditorProps) => {
  // News content type uses the websiteContent API.
  // A different content type would call different hooks here.
  const createMutation = useWebsiteContentCreate()
  const updateMutation = useWebsiteContentPartialUpdate()
  const uploadImage = useMediaUpload()

  return (
    <WebsiteContentEditor
      createExtensions={createNewsExtensions}
      contentType={WebsiteContentContentTypeEnum.News}
      initialDoc={newNewsDocument}
      extractExtraFields={extractNewsExtraFields}
      saveMutations={{ create: createMutation, update: updateMutation }}
      uploadImage={uploadImage}
      onSave={onSave}
      readOnly={readOnly}
      contentItem={newsItem}
    />
  )
}

export { NewsEditor }
export type { NewsEditorProps }

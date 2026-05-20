import React from "react"
import { useWebsiteContent } from "../../../WebsiteContentContext"
import { ByLineInfoBarContent } from "./ByLineInfoBar"
import { ByLineInBanner } from "./ByLineInfoBarInBanner"

const ByLineInfoBarViewer = () => {
  const article = useWebsiteContent()

  const publishedDate = article?.is_published ? article?.created_on : null
  const content = article?.content
  const authorName = article?.author_name ?? null

  return (
    <ByLineInfoBarContent
      publishedDate={publishedDate}
      content={content}
      isEditable={false}
      authorName={authorName}
    />
  )
}

export { ByLineInfoBarViewer }

const ByLineInBannerViewer = () => {
  const article = useWebsiteContent()

  const publishedDate = article?.is_published ? article?.created_on : null
  const content = article?.content
  const authorName = article?.author_name ?? null

  return (
    <ByLineInBanner
      publishedDate={publishedDate}
      content={content}
      authorName={authorName}
    />
  )
}

export { ByLineInBannerViewer }

/** @deprecated Use ByLineInBannerViewer */
export { ByLineInBannerViewer as ArticleByLineInBannerViewer }

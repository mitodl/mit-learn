import React from "react"
import { useWebsiteContent } from "../../../WebsiteContentContext"
import { ByLineInfoBarContent } from "./ByLineInfoBar"

const ByLineInfoBarViewer = () => {
  const article = useWebsiteContent()

  const publishedDate = article?.is_published ? article?.publish_date : null
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

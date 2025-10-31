"use client"
import React from "react"
import { ArticleDetail } from "ol-ckeditor"

const ArticleDetailPage: React.FC<{ articleId: number }> = ({ articleId }) => {
  return <ArticleDetail articleId={articleId} />
}

export { ArticleDetailPage }

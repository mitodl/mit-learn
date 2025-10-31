"use client"
import React from "react"
import { CkeditorArticle } from "ol-ckeditor"

const ArticlesPage: React.FC<{ articleId: number }> = ({ articleId }) => {
  return <CkeditorArticle articleId={articleId} />
}

export { ArticlesPage }

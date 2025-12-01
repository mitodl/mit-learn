"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import { LoadingSpinner, ArticleEditor } from "ol-components"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"

export const ArticleDetailPage = ({ articleId }: { articleId: number }) => {
  // const {
  //   data: article,
  //   isLoading,
  //   isFetching,
  // } = useArticleDetail(Number(articleId))

  // if (isLoading || isFetching) {
  //   return <LoadingSpinner color="inherit" loading size={32} />
  // }
  const article = {
    id: 1,
    title: "TEMP",
    content: {
      type: "doc",
      content: [
        {
          type: "banner",
          content: [
            {
              type: "heading",
              attrs: { textAlign: null, level: 1 },
              content: [
                {
                  type: "text",
                  text: "MITx MicroMasters celebrates 10 years of reimagining graduate-level education",
                },
              ],
            },
            {
              type: "paragraph",
              attrs: { textAlign: null },
              content: [
                {
                  type: "text",
                  text: "From personal stories of achievement to research that has transformed teaching and learning, learn more about the impact of the credential program developed in collaboration with MIT Open Learning and MIT departments.",
                },
              ],
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              text: "This October marks an extraordinary milestone — ten years since MIT announced the groundbreaking MITx MicroMasters program.",
            },
          ],
        },
      ],
    },
  }
  if (!article) {
    return notFound()
  }
  return (
    // <RestrictedRoute requires={Permission.ArticleEditor}>
    <ArticleEditor article={article} readOnly />
    // </RestrictedRoute>
  )
}

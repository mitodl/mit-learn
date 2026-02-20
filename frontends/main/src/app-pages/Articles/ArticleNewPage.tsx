"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { styled } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/ArticleEditor"
import { articlesDraftView, articlesView } from "@/common/urls"
import invariant from "tiny-invariant"

const PageContainer = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  height: "100%",
}))

const ArticleNewPage: React.FC = () => {
  const router = useRouter()

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <ArticleEditor
          onSave={(article) => {
            if (article.is_published) {
              invariant(article.slug, "Published article must have a slug")
              return router.push(articlesView(article.slug))
            } else {
              router.push(articlesDraftView(String(article.id)))
            }
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { ArticleNewPage }

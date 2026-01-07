"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { styled } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/ArticleEditor"
import { articlesView } from "@/common/urls"

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
            if (article.is_published)
              return router.push(articlesView(article.slug!))
            router.push(articlesView(String(article.id)))
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { ArticleNewPage }

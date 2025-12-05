"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import {
  ArticleEditor,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
  styled,
} from "ol-components"
import { articlesView } from "@/common/urls"

const PageContainer = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  minHeight: `calc(100vh - ${HEADER_HEIGHT}px - 132px)`,
  [theme.breakpoints.down("md")]: {
    minHeight: `calc(100vh - ${HEADER_HEIGHT_MD}px - 132px)`,
  },
}))

const ArticleNewPage: React.FC = () => {
  const router = useRouter()

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <ArticleEditor
          onSave={(article) => {
            router.push(articlesView(article.id))
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { ArticleNewPage }

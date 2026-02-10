import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { articleQueries } from "api/hooks/articles/queries"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import { extractLearningResourceIds } from "@/page-components/TiptapEditor/extensions/utils"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import type { RichTextArticle } from "api/v1"
import type { JSONContent } from "@tiptap/react"

// Extracts the banner subheading paragraph at known location
const extractArticleDescription = (
  article: RichTextArticle,
): string | undefined => {
  const banner = article.content?.content?.[0]
  const subheading = banner?.content?.[1]
  const textNode = subheading?.content?.[0]
  return textNode?.text
}

const extractImageMetadata = (
  article: RichTextArticle,
): { src: string; alt: string } | null => {
  const imageWithCaption = article.content?.content?.find(
    (node: JSONContent) => node.type === "imageWithCaption",
  )
  if (!imageWithCaption) {
    return null
  }
  return {
    src: imageWithCaption.attrs.src,
    alt: imageWithCaption.attrs.caption || imageWithCaption.attrs.alt,
  }
}

export const generateMetadata = async (
  props: PageProps<"/articles/[slugOrId]">,
) => {
  const params = await props.params

  const { slugOrId } = await params

  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const article = await queryClient.fetchQuery(
      articleQueries.articlesDetailRetrieve(slugOrId),
    )

    const description = extractArticleDescription(article)
    const leadImage = extractImageMetadata(article)

    return standardizeMetadata({
      title: article.title,
      description,
      image: leadImage?.src,
      imageAlt: leadImage?.alt,
    })
  })
}

const Page: React.FC<PageProps<"/articles/[slugOrId]">> = async (props) => {
  const { slugOrId } = await props.params

  const queryClient = getQueryClient()

  await queryClient.fetchQueryOr404(
    articleQueries.articlesDetailRetrieve(slugOrId),
  )

  const queryKey = articleQueries.articlesDetailRetrieve(slugOrId).queryKey
  const cacheData = queryClient.getQueryData(queryKey)

  const learningResourceIds = cacheData?.content
    ? extractLearningResourceIds(cacheData.content)
    : []

  if (learningResourceIds.length > 0) {
    const bulkQuery = learningResourceQueries.list({
      resource_id: learningResourceIds,
    })
    await queryClient.prefetchQuery(bulkQuery)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticleDetailPage
        articleId={slugOrId}
        learningResourceIds={learningResourceIds}
      />
    </HydrationBoundary>
  )
}
export default Page

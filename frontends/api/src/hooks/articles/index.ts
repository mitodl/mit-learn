import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { articlesApi } from "../../clients"
import type {
  ArticlesApiArticlesListRequest as ArticleListRequest,
  RichTextArticle as Article,
} from "../../generated/v1"
import { articleQueries, articleKeys } from "./queries"

const useArticleList = (
  params: ArticleListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...articleQueries.list(params),
    ...opts,
  })
}

/**
 * Query is disabled if id is undefined.
 */
const useArticleDetail = (id: number | undefined) => {
  return useQuery({
    ...articleQueries.detail(id ?? -1),
    enabled: id !== undefined,
  })
}

const useArticleCreate = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (
      data: Omit<Article, "id" | "user" | "created_on" | "updated_on">,
    ) =>
      articlesApi
        .articlesCreate({ RichTextArticleRequest: data })
        .then((response) => response.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: articleKeys.listRoot() })
    },
  })
}
const useArticleDestroy = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => articlesApi.articlesDestroy({ id }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: articleKeys.listRoot() })
    },
  })
}
const useArticlePartialUpdate = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Article> & Pick<Article, "id">) =>
      articlesApi
        .articlesPartialUpdate({
          id,
          PatchedRichTextArticleRequest: data,
        })
        .then((response) => response.data),
    onSuccess: (article: Article) => {
      client.invalidateQueries({ queryKey: articleKeys.detail(article.id) })
    },
  })
}

export {
  useArticleList,
  useArticleDetail,
  useArticleCreate,
  useArticleDestroy,
  useArticlePartialUpdate,
}

import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AxiosProgressEvent } from "axios"

import { articlesApi, mediaApi } from "../../clients"
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

const useArticleDetailRetrieve = (identifier: string | undefined) => {
  return useQuery({
    ...articleQueries.articlesDetailRetrieve(identifier ?? ""),
    enabled: identifier !== undefined,
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

export const useMediaUpload = () => {
  const nextProgressCb = useRef<((percent: number) => void) | undefined>(
    undefined,
  )

  const mutation = useMutation({
    mutationFn: async (data: { file: File }) => {
      const response = await mediaApi.mediaUpload(
        { image_file: data.file },
        {
          onUploadProgress: (e: AxiosProgressEvent) => {
            const percent = Math.round((e.loaded * 100) / (e.total ?? 1))
            nextProgressCb.current?.(percent)
          },
        },
      )

      return response.data
    },
    onSettled: () => {
      nextProgressCb.current = undefined
    },
  })

  return {
    ...mutation,
    /**
     * Set a callback to be called on the next upload progress event.
     *
     * NOTES:
     * - This callback will be cleared after the mutation settles (either success or error).
     * - This is a separate method, not part of the mutate/mutateAsync options,
     *   to avoid errors with function serialization. (E.g., Tanstack Query
     *   devtools attempt to serialize mutation options.)
     */
    setNextProgressCallback: (
      callback: ((percent: number) => void) | undefined,
    ) => {
      nextProgressCb.current = callback
    },
  }
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
      const identifier = article.slug || article.id.toString()
      client.invalidateQueries({
        queryKey: articleKeys.articlesDetailRetrieve(identifier),
      })
    },
  })
}

export {
  useArticleList,
  useArticleDetail,
  useArticleCreate,
  useArticleDestroy,
  useArticlePartialUpdate,
  articleQueries,
  useArticleDetailRetrieve,
}

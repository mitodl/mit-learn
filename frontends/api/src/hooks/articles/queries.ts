import { queryOptions } from "@tanstack/react-query"
import { articlesApi } from "../../clients"
import type { ArticlesApiArticlesListRequest as ArticleListRequest } from "../../generated/v1"

const articleKeys = {
  root: ["articles"],
  listRoot: () => [...articleKeys.root, "list"],
  list: (params: ArticleListRequest) => [...articleKeys.listRoot(), params],
  detailRoot: () => [...articleKeys.root, "detail"],
  detail: (id: number) => [...articleKeys.detailRoot(), id],
  articlesDetailRetrieve: (identifier: string) => [
    ...articleKeys.detailRoot(),
    identifier,
  ],
}

const articleQueries = {
  list: (params: ArticleListRequest) =>
    queryOptions({
      queryKey: articleKeys.list(params),
      queryFn: () => articlesApi.articlesList(params).then((res) => res.data),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: articleKeys.detail(id),
      queryFn: () =>
        articlesApi.articlesRetrieve({ id }).then((res) => res.data),
    }),
  articlesDetailRetrieve: (identifier: string) =>
    queryOptions({
      queryKey: articleKeys.articlesDetailRetrieve(identifier),
      queryFn: () =>
        articlesApi
          .articlesDetailRetrieve({ identifier })
          .then((res) => res.data),
    }),
}

export { articleQueries, articleKeys }
